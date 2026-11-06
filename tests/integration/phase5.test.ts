import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createSession, getUserFromToken } from '@/lib/auth/session';
import { getPrisma } from '@/lib/db';
import { photoStorage } from '@/lib/photos/storage';
import type { AuthUser } from '@/permissions/types';
import { changeStatus, assignReport } from '@/services/backoffice/processing';
import {
  addCleanupPhoto,
  createOperation,
  listCleanupPriorities,
  updateOperation,
} from '@/services/cleanup/cleanup';
import {
  answerFeedbackPrompt,
  createEpisode,
  getEpisodeForLabeling,
  listMyFeedbackPrompts,
  setLabels,
  validateEpisode,
} from '@/services/episodes/episodes';
import { ServiceError } from '@/services/errors';
import { runEscalation } from '@/services/escalation/escalation';
import { listMyUserNotifications } from '@/services/notifications/user-notifications';
import { createReport } from '@/services/reports/create';
import { answerResolution, getResolutionFeedbackState } from '@/services/reports/feedback';
import { getIndexQuality } from '@/services/risk/quality';
import { getRiskCells } from '@/services/risk/read';
import { getPublicStatistics } from '@/services/stats/public';
import { createReportSchema } from '@/validators/report';

// Nécessite la base migrée, le seed appliqué et un calcul d'indice (npm run test:db).
const prisma = getPrisma();
const startedAt = new Date();
const codes: string[] = [];
const episodeIds: string[] = [];

async function asUser(email: string): Promise<AuthUser> {
  const user = await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true } });
  const { token } = await createSession(user.id);
  return (await getUserFromToken(token))!;
}

async function expectServiceError(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toSatisfy(
    (error: unknown) => error instanceof ServiceError && error.code === code,
  );
}

let offset = 0;
async function newReport(type: string, severity: string, authorId: string | null) {
  offset += 0.0004;
  const { trackingCode } = await createReport(
    createReportSchema.parse({
      type,
      severity,
      lat: String(14.7488 + offset),
      lng: '-17.3812',
      confirmNotDuplicate: 'true',
    }),
    null,
    authorId,
  );
  codes.push(trackingCode);
  return trackingCode;
}

let admin: AuthUser;
let agent: AuthUser;
let delegate: AuthUser;
let citizen: AuthUser;

beforeAll(async () => {
  admin = await asUser('admin.demo@banlieue-alerte.test');
  agent = await asUser('agent.demo@banlieue-alerte.test');
  delegate = await asUser('delegue.demo@banlieue-alerte.test');
  citizen = await asUser('habitant.demo@banlieue-alerte.test');
});

afterAll(async () => {
  await prisma.rainEpisode.deleteMany({ where: { id: { in: episodeIds } } });
  await prisma.report.deleteMany({ where: { trackingCode: { in: codes } } });
  await prisma.userNotification.deleteMany({ where: { createdAt: { gte: startedAt } } });
  await prisma.user.update({ where: { id: citizen.id }, data: { notifyStatusChanges: true } });
  await prisma.$disconnect();
});

describe('retour au citoyen (EXG-32, D-055)', () => {
  it('notification à chaque changement de statut, seulement avec consentement', async () => {
    const code = await newReport('FLOODING', 'MEDIUM', citizen.id);
    await changeStatus(delegate, code, 'VERIFIED');
    let notes = await listMyUserNotifications(citizen);
    expect(notes.some((n) => n.title.includes(code) && n.title.includes('vérifié'))).toBe(true);

    await prisma.user.update({ where: { id: citizen.id }, data: { notifyStatusChanges: false } });
    const before = (await listMyUserNotifications(citizen)).length;
    await assignReport(agent, code, agent.id);
    notes = await listMyUserNotifications(citizen);
    expect(notes.length).toBe(before);
    await prisma.user.update({ where: { id: citizen.id }, data: { notifyStatusChanges: true } });
  });

  it('« non résolu » rouvre le dossier, avec historique, journal et agent prévenu', async () => {
    const code = await newReport('FLOODING', 'HIGH', citizen.id);
    await changeStatus(delegate, code, 'VERIFIED');
    await assignReport(agent, code, agent.id);
    await changeStatus(agent, code, 'RESOLVED');

    expect((await getResolutionFeedbackState(citizen, code)).canAnswer).toBe(true);
    expect((await getResolutionFeedbackState(delegate, code)).canAnswer).toBe(false);
    expect((await getResolutionFeedbackState(null, code)).canAnswer).toBe(false);
    await expectServiceError(answerResolution(delegate, code, false), 'FORBIDDEN');

    const result = await answerResolution(citizen, code, false);
    expect(result).toEqual({ status: 'IN_PROGRESS', feedback: 'REOPENED' });
    const report = await prisma.report.findUniqueOrThrow({
      where: { trackingCode: code },
      select: {
        id: true,
        status: true,
        resolvedAt: true,
        resolutionFeedback: true,
        statusHistory: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { toStatus: true, note: true, changedById: true },
        },
      },
    });
    expect(report).toMatchObject({
      status: 'IN_PROGRESS',
      resolvedAt: null,
      resolutionFeedback: 'REOPENED',
    });
    expect(report.statusHistory[0]).toMatchObject({
      toStatus: 'IN_PROGRESS',
      changedById: citizen.id,
    });
    expect(report.statusHistory[0]?.note).toMatch(/Réouvert par l’habitant/);
    expect(
      await prisma.auditLog.count({
        where: { action: 'report.reopened_by_author', entityId: report.id },
      }),
    ).toBe(1);
    expect((await listMyUserNotifications(agent)).some((n) => n.title.includes(code))).toBe(true);
    await expectServiceError(answerResolution(citizen, code, true), 'CONFLICT');

    // Nouvelle résolution : la question est reposée ; « oui » confirme.
    await changeStatus(agent, code, 'RESOLVED');
    expect((await answerResolution(citizen, code, true)).feedback).toBe('CONFIRMED');
  });
});

describe('escalade (EXG-36, D-056)', () => {
  it('rien avant le délai ; agent après 6 h ; administrateur après 12 h ; une seule fois', async () => {
    const code = await newReport('FLOODING', 'HIGH', null);
    const report = await prisma.report.findUniqueOrThrow({
      where: { trackingCode: code },
      select: { id: true, createdAt: true },
    });
    const at = (hours: number) => new Date(report.createdAt.getTime() + hours * 3_600_000);
    const level = async () =>
      (
        await prisma.report.findUniqueOrThrow({
          where: { id: report.id },
          select: { escalationLevel: true },
        })
      ).escalationLevel;

    await runEscalation(at(5));
    expect(await level()).toBe(0);
    await runEscalation(at(6.5));
    expect(await level()).toBe(1);
    const agentNotes = await prisma.userNotification.count({
      where: { reportId: report.id, kind: 'ESCALATION', userId: agent.id },
    });
    expect(agentNotes).toBe(1);
    await runEscalation(at(7));
    expect(
      await prisma.userNotification.count({
        where: { reportId: report.id, kind: 'ESCALATION', userId: agent.id },
      }),
    ).toBe(1);
    await runEscalation(at(12.5));
    expect(await level()).toBe(2);
    expect(
      await prisma.userNotification.count({
        where: { reportId: report.id, kind: 'ESCALATION', userId: admin.id },
      }),
    ).toBe(1);
    expect(
      await prisma.auditLog.count({ where: { action: 'report.escalated', entityId: report.id } }),
    ).toBe(2);
  });

  it('un signalement traité n’est plus escaladé', async () => {
    const code = await newReport('ROAD_CUT', 'HIGH', null);
    await changeStatus(delegate, code, 'VERIFIED');
    const report = await prisma.report.findUniqueOrThrow({
      where: { trackingCode: code },
      select: { id: true, createdAt: true },
    });
    await runEscalation(new Date(report.createdAt.getTime() + 100 * 3_600_000));
    expect(
      (
        await prisma.report.findUniqueOrThrow({
          where: { id: report.id },
          select: { escalationLevel: true },
        })
      ).escalationLevel,
    ).toBe(0);
  });
});

describe('épisodes, étiquettes et qualité (D-053, D-054, EXG-12)', () => {
  it('sans épisode réel validé : qualité vide, aucune métrique', async () => {
    const quality = await getIndexQuality();
    expect(quality.reached).toBe(false);
    expect(quality.results).toBeNull();
    // L'épisode et les étiquettes de démonstration du seed ne comptent pas.
    expect(quality.counts).toEqual({ episodes: 0, labels: 0, flooded: 0 });
  });

  it('déclaration, question aux abonnés, étiquettes avec historique, portée, validation', async () => {
    await expectServiceError(
      createEpisode(delegate, {
        name: 'Refusé',
        startsAt: new Date(Date.now() - 7_200_000),
        endsAt: new Date(),
      }),
      'FORBIDDEN',
    );
    const episode = await createEpisode(agent, {
      name: 'Test : pluie d’orage',
      startsAt: new Date(Date.now() - 6 * 3_600_000),
      endsAt: new Date(Date.now() - 3_600_000),
    });
    episodeIds.push(episode.id);
    expect(episode.prompts).toBeGreaterThanOrEqual(1);

    // L'habitant démo, abonné dans l'application, reçoit la question.
    const prompts = await listMyFeedbackPrompts(citizen);
    const prompt = prompts.find((p) => p.episode.name === 'Test : pluie d’orage')!;
    expect(prompt).toBeDefined();
    await answerFeedbackPrompt(citizen, prompt.id, 'FLOODED');
    await expectServiceError(answerFeedbackPrompt(citizen, prompt.id, 'NOT_FLOODED'), 'NOT_FOUND');

    // Le délégué voit les cases de son quartier, avec la réponse agrégée comme indice.
    const sheet = await getEpisodeForLabeling(delegate, episode.id);
    expect(sheet.cells.length).toBeGreaterThan(0);
    expect(sheet.cells.every((c) => c.current === 'UNKNOWN')).toBe(true);
    expect(JSON.stringify(sheet.feedback)).toContain('FLOODED');
    const [first, second] = sheet.cells;
    await setLabels(delegate, episode.id, [
      { cellId: first!.id, label: 'FLOODED' },
      { cellId: second!.id, label: 'NOT_FLOODED' },
    ]);
    await setLabels(delegate, episode.id, [{ cellId: second!.id, label: 'FLOODED' }]);
    const history = await prisma.episodeLabelHistory.findMany({
      where: { label: { episodeId: episode.id, cellId: second!.id } },
      orderBy: { createdAt: 'asc' },
      select: { fromLabel: true, toLabel: true },
    });
    expect(history).toEqual([
      { fromLabel: null, toLabel: 'NOT_FLOODED' },
      { fromLabel: 'NOT_FLOODED', toLabel: 'FLOODED' },
    ]);

    // Case hors du quartier du délégué : refusée.
    const outside = await prisma.riskCell.findFirstOrThrow({
      where: {
        OR: [{ neighborhoodId: null }, { neighborhoodId: { notIn: delegate.neighborhoodIds } }],
      },
      select: { id: true },
    });
    await expectServiceError(
      setLabels(delegate, episode.id, [{ cellId: outside.id, label: 'FLOODED' }]),
      'FORBIDDEN',
    );

    await expectServiceError(validateEpisode(delegate, episode.id), 'FORBIDDEN');
    expect(await validateEpisode(agent, episode.id)).toEqual({ validated: true, labels: 2 });
    await expectServiceError(
      setLabels(delegate, episode.id, [{ cellId: first!.id, label: 'UNKNOWN' }]),
      'CONFLICT',
    );

    // Sous le seuil : toujours aucune métrique publiée.
    const quality = await getIndexQuality();
    expect(quality.counts).toMatchObject({ episodes: 1, labels: 2, flooded: 2 });
    expect(quality.results).toBeNull();
  });

  it('seuil atteint : les prédictions de démonstration sont exclues de l’évaluation', async () => {
    const cells = await prisma.riskCell.findMany({ select: { id: true }, take: 6 });
    for (let e = 0; e < 5; e++) {
      const episode = await prisma.rainEpisode.create({
        data: {
          name: `Test : épisode ${e}`,
          startsAt: new Date(Date.now() + 3_600_000),
          endsAt: new Date(Date.now() + 7_200_000),
          status: 'VALIDATED',
          createdById: agent.id,
          labels: {
            create: cells.map((c, i) => ({
              cellId: c.id,
              label: i === 0 ? ('FLOODED' as const) : ('NOT_FLOODED' as const),
              labeledById: agent.id,
            })),
          },
        },
        select: { id: true },
      });
      episodeIds.push(episode.id);
    }
    const quality = await getIndexQuality();
    expect(quality.reached).toBe(true);
    // Toutes les prédictions existantes portent sur la zone de démonstration : aucune n'est retenue.
    expect(quality.results?.samples).toBe(0);
    expect(quality.results?.withoutPrediction).toBe(quality.counts.labels);
    expect(quality.results?.models.M2.recall).toBeNull();
  });
});

describe('curage (D-058)', () => {
  it('liste priorisée, opération, photo sans EXIF, résolution du signalement', async () => {
    const code = await newReport('BLOCKED_DRAIN', 'HIGH', null);
    const { items } = await listCleanupPriorities(agent);
    const item = items.find((i) => i.trackingCode === code);
    expect(item).toBeDefined();
    // L'indice à 48 h de la case est connu après le calcul : priorité = indice × 3.
    if (item!.riskScore !== null) expect(item!.priority).toBe(item!.riskScore * 3);

    await expectServiceError(
      createOperation(delegate, { trackingCode: code, team: 'Refusée' }),
      'FORBIDDEN',
    );
    const flood = await newReport('FLOODING', 'LOW', null);
    await expectServiceError(
      createOperation(agent, { trackingCode: flood, team: 'Équipe' }),
      'VALIDATION_ERROR',
    );

    const operation = await createOperation(agent, { trackingCode: code, team: 'Équipe test' });
    const image = await sharp({
      create: { width: 80, height: 60, channels: 3, background: '#336699' },
    })
      .jpeg()
      .withExif({ IFD0: { Model: 'Appareil-Secret' } })
      .toBuffer();
    expect((await sharp(image).metadata()).exif).toBeDefined();
    const photo = await addCleanupPhoto(agent, operation.id, 'BEFORE', image);
    const stored = await photoStorage.read(photo.storageKey);
    expect((await sharp(stored!).metadata()).exif).toBeUndefined();

    await changeStatus(delegate, code, 'VERIFIED');
    await updateOperation(agent, operation.id, { status: 'DONE', resolveReport: true });
    const report = await prisma.report.findUniqueOrThrow({
      where: { trackingCode: code },
      select: { status: true },
    });
    expect(report.status).toBe('RESOLVED');
    await expectServiceError(
      updateOperation(agent, operation.id, { status: 'IN_PROGRESS' }),
      'CONFLICT',
    );
  });
});

describe('statistiques et carte de risque (API publiques)', () => {
  it('statistiques calculées sur la base, démonstration signalée, aucune donnée personnelle', async () => {
    const stats = await getPublicStatistics();
    expect(stats.rows.length).toBeGreaterThan(0);
    expect(stats.rows.every((r) => r.total > 0)).toBe(true);
    expect(stats.rows.some((r) => r.insufficient && r.resolutionRate === null)).toBe(true);
    expect(JSON.stringify(stats)).not.toMatch(/email|author|@banlieue-alerte/);
  });

  it('cases de la carte de risque : niveau, facteurs, date, sans donnée personnelle', async () => {
    const data = await getRiskCells(24);
    expect(data?.cells.length).toBeGreaterThan(100);
    expect(data?.weather.fetchedAt).not.toBeNull();
    expect(data?.cells[0]).toHaveProperty('factors');
    expect(JSON.stringify(data)).not.toMatch(/email|author|reportId/);
  });
});
