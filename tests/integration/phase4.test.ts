import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createSession, getUserFromToken } from '@/lib/auth/session';
import { getPrisma } from '@/lib/db';
import { DEFAULT_RULE_PARAMS } from '@/lib/risk/rules';
import { FailingWeatherProvider, FixtureWeatherProvider } from '@/lib/weather/open-meteo';
import type { AuthUser } from '@/permissions/types';
import { deleteMyAccount } from '@/services/account/account';
import { register } from '@/services/auth/credentials';
import { dispatchAlert, dispatchDueAlerts } from '@/services/alerts/dispatch';
import {
  approveAlert,
  cancelAlert,
  createAlert,
  rejectAlert,
  updateAlert,
} from '@/services/alerts/manage';
import { listActiveAlerts } from '@/services/alerts/read';
import { ServiceError } from '@/services/errors';
import { refreshRisk } from '@/services/risk/refresh';
import { getRiskOverview } from '@/services/risk/read';
import { activateRuleVersion, createRuleVersion, getActiveRules } from '@/services/risk/rules';
import {
  createSubscription,
  deleteSubscription,
  listMyNotifications,
  listMySubscriptions,
} from '@/services/subscriptions/subscriptions';
import { createAlertSchema } from '@/validators/alerts';

// Nécessite la base migrée et le seed appliqué (npm run test:db).
const prisma = getPrisma();
const startedAt = new Date();
const runIds: string[] = [];
const alertIds: string[] = [];
const ruleVersionIds: string[] = [];
const createdEmails: string[] = [];

async function asUser(email: string): Promise<AuthUser> {
  const user = await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true } });
  const { token } = await createSession(user.id);
  return (await getUserFromToken(token))!;
}

/** Pluie forte injectée : 2 mm/h les 3 jours passés, 5 mm/h les 24 prochaines heures. */
const heavyRain = new FixtureWeatherProvider((h) => (h < 0 ? 2 : h < 24 ? 5 : 0));

async function expectServiceError(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toSatisfy(
    (error: unknown) => error instanceof ServiceError && error.code === code,
  );
}

let admin: AuthUser;
let agent: AuthUser;
let delegate: AuthUser;
let citizen: AuthUser;
let gare: { id: string };
let surMer: { id: string };
let diamaguene: { id: string };

function alertInput(overrides: Record<string, unknown> = {}) {
  return createAlertSchema.parse({
    type: 'INDICATIVE',
    level: 'HIGH',
    issuerName: 'Délégué de quartier (test)',
    title: 'Test : fortes pluies attendues',
    messageFr: 'Test : évitez les zones basses cette nuit.',
    neighborhoodIds: [gare.id],
    validUntil: new Date(Date.now() + 6 * 3_600_000).toISOString(),
    ...overrides,
  });
}

async function track<T extends { id: string }>(promise: Promise<T>): Promise<T> {
  const value = await promise;
  alertIds.push(value.id);
  return value;
}

beforeAll(async () => {
  admin = await asUser('admin.demo@banlieue-alerte.test');
  agent = await asUser('agent.demo@banlieue-alerte.test');
  delegate = await asUser('delegue.demo@banlieue-alerte.test');
  citizen = await asUser('habitant.demo@banlieue-alerte.test');
  const byName = (name: string) =>
    prisma.neighborhood.findFirstOrThrow({ where: { name, isDemo: true }, select: { id: true } });
  [gare, surMer, diamaguene] = await Promise.all([
    byName('Thiaroye Gare'),
    byName('Thiaroye sur Mer'),
    byName('Diamaguène'),
  ]);
  // Un passage précédent interrompu ne doit pas fausser les tests de météo absente.
  await prisma.riskRun.deleteMany({ where: { trigger: 'test' } });
  await prisma.weatherSnapshot.deleteMany({ where: { isDemo: true } });
});

afterAll(async () => {
  await prisma.alert.deleteMany({
    where: { OR: [{ id: { in: alertIds } }, { riskPrediction: { runId: { in: runIds } } }] },
  });
  await prisma.riskRun.deleteMany({ where: { trigger: 'test' } });
  await prisma.weatherSnapshot.deleteMany({ where: { isDemo: true } });
  await prisma.errorLog.deleteMany({
    where: { source: 'weather', createdAt: { gte: startedAt }, message: { contains: 'simulée' } },
  });
  // Retour à la grille v1 active.
  const v1 = await prisma.ruleVersion.findFirst({ where: { number: 1 }, select: { id: true } });
  if (v1) {
    await prisma.ruleVersion.updateMany({ data: { isActive: false } });
    await prisma.ruleVersion.update({ where: { id: v1.id }, data: { isActive: true } });
  }
  await prisma.ruleVersion.deleteMany({ where: { id: { in: ruleVersionIds } } });
  await prisma.subscription.deleteMany({
    where: { user: { isDemo: true }, isDemo: false },
  });
  await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
  await prisma.user.deleteMany({
    where: { status: 'DELETED', isDemo: false, createdAt: { gte: startedAt } },
  });
  await prisma.$disconnect();
});

describe('météo et indice (EXG-08, EXG-09)', () => {
  it('sans aucun relevé : « données limitées », aucun score inventé', async () => {
    const result = await refreshRisk({
      provider: new FailingWeatherProvider(),
      injectedWeather: true,
      trigger: 'test',
    });
    runIds.push(result.runId);
    expect(result.weather.status).toBe('missing');
    const predictions = await prisma.riskPrediction.findMany({
      where: { runId: result.runId, scope: 'NEIGHBORHOOD' },
      select: { score: true, level: true },
    });
    expect(predictions.length).toBe(6);
    expect(predictions.every((p) => p.score === null && p.level === null)).toBe(true);
    expect(result.draftsCreated).toBe(0);
  });

  it('forte pluie injectée : indice élevé, facteurs, date et horizon enregistrés', async () => {
    const result = await refreshRisk({
      provider: heavyRain,
      injectedWeather: true,
      trigger: 'test',
    });
    runIds.push(result.runId);
    expect(result.weather.status).toBe('fresh');
    expect(result.neighborhoods).toBe(3);

    const run = await prisma.riskRun.findUniqueOrThrow({
      where: { id: result.runId },
      select: { isDemo: true, weatherSnapshot: { select: { isDemo: true } } },
    });
    // Météo injectée : jamais présentée comme réelle.
    expect(run.isDemo).toBe(true);
    expect(run.weatherSnapshot?.isDemo).toBe(true);

    const overview = await getRiskOverview();
    expect(overview?.weather.isDemo).toBe(true);
    expect(overview?.weather.fetchedAt).not.toBeNull();
    for (const horizon of [24, 48] as const) {
      expect(overview?.neighborhoods[horizon]).toHaveLength(3);
    }
    const top = overview!.neighborhoods[24][0]!;
    expect(['HIGH', 'CRITICAL']).toContain(top.level);
    expect(top.topFactors.length).toBe(3);
    expect(top.topFactors[0]?.text).toMatch(/mm/);
    expect(top.missing).toContain('history');
    expect(top.horizonHours).toBe(24);
  });

  it('panne météo : dernier relevé utilisé, signalé et journalisé', async () => {
    const result = await refreshRisk({
      provider: new FailingWeatherProvider(),
      injectedWeather: true,
      trigger: 'test',
    });
    runIds.push(result.runId);
    expect(result.weather.status).toBe('stale');
    expect(result.weather.fetchedAt).not.toBeNull();
    const overview = await getRiskOverview();
    expect(overview?.weather.stale).toBe(true);
    const errors = await prisma.errorLog.count({
      where: { source: 'weather', createdAt: { gte: startedAt } },
    });
    expect(errors).toBeGreaterThanOrEqual(2);
  });

  it('l’API publique de l’indice ne contient aucune donnée personnelle', async () => {
    const json = JSON.stringify(await getRiskOverview());
    expect(json).not.toMatch(/email|createdBy|authorId|@banlieue-alerte/);
  });
});

describe('brouillons automatiques (EXG-29)', () => {
  it('un quartier « Élevé » crée un brouillon indicatif, sans aucun envoi', async () => {
    const drafts = await prisma.alert.findMany({
      where: { origin: 'RISK_INDEX', riskPrediction: { runId: { in: runIds } } },
      select: {
        id: true,
        type: true,
        status: true,
        createdById: true,
        _count: { select: { deliveries: true } },
        neighborhoods: { select: { neighborhoodId: true } },
      },
    });
    expect(drafts.length).toBeGreaterThanOrEqual(2);
    for (const draft of drafts) {
      expect(draft.type).toBe('INDICATIVE');
      expect(draft.status).toBe('PENDING_APPROVAL');
      expect(draft.createdById).toBeNull();
      expect(draft._count.deliveries).toBe(0);
    }
    // Thiaroye Gare a déjà un brouillon de démonstration en attente : pas de doublon.
    const targets = drafts.flatMap((d) => d.neighborhoods.map((n) => n.neighborhoodId));
    expect(targets).not.toContain(gare.id);
    expect(targets).toEqual(expect.arrayContaining([surMer.id, diamaguene.id]));
    expect(
      await prisma.auditLog.count({
        where: { action: 'alert.draft_created', entityId: { in: drafts.map((d) => d.id) } },
      }),
    ).toBe(drafts.length);
  });

  it('un nouveau calcul ne recrée pas de brouillon tant que le premier est en attente', async () => {
    const result = await refreshRisk({
      provider: heavyRain,
      injectedWeather: true,
      trigger: 'test',
    });
    runIds.push(result.runId);
    expect(result.draftsCreated).toBe(0);
  });

  it('envoi refusé tant que l’alerte n’est pas approuvée', async () => {
    const draft = await prisma.alert.findFirstOrThrow({
      where: {
        origin: 'RISK_INDEX',
        status: 'PENDING_APPROVAL',
        riskPrediction: { runId: { in: runIds } },
      },
      select: { id: true },
    });
    await expectServiceError(dispatchAlert(draft.id), 'CONFLICT');
    expect(await prisma.alertDelivery.count({ where: { alertId: draft.id } })).toBe(0);
  });
});

describe('habilitations (EXG-30, D-049)', () => {
  it('alerte officielle refusée au délégué ; quartier hors portée refusé', async () => {
    await expectServiceError(
      createAlert(delegate, alertInput({ type: 'OFFICIAL', issuerName: 'Mairie (test)' })),
      'FORBIDDEN',
    );
    await expectServiceError(
      createAlert(delegate, alertInput({ neighborhoodIds: [diamaguene.id] })),
      'FORBIDDEN',
    );
    await expectServiceError(createAlert(citizen, alertInput()), 'FORBIDDEN');
  });

  it('une alerte indicative ne peut pas reprendre le vocabulaire officiel', () => {
    expect(
      createAlertSchema.safeParse({ ...alertInput(), issuerName: 'Préfecture de Pikine' }).success,
    ).toBe(false);
  });

  it('l’agent émet une alerte officielle de sa commune', async () => {
    const alert = await track(
      createAlert(agent, alertInput({ type: 'OFFICIAL', issuerName: 'Mairie (test, fictive)' })),
    );
    expect(alert.status).toBe('PENDING_APPROVAL');
    await expectServiceError(approveAlert(delegate, alert.id, {}), 'FORBIDDEN');
    await cancelAlert(agent, alert.id, 'Test : annulation du brouillon.');
  });
});

describe('approbation et envoi en simulation (EXG-10, EXG-17, EXG-29)', () => {
  it('création sans envoi, approbation journalisée, puis livraisons simulées', async () => {
    const alert = await track(createAlert(delegate, alertInput()));
    expect(await prisma.alertDelivery.count({ where: { alertId: alert.id } })).toBe(0);

    const result = await approveAlert(delegate, alert.id, {
      changes: { level: 'CRITICAL', title: 'Test : pluies très fortes attendues' },
      reason: 'Vu sur place.',
    });
    expect(result.status).toBe('SENT');
    expect(result.delivery?.mode).toBe('simulation');

    const stored = await prisma.alert.findUniqueOrThrow({
      where: { id: alert.id },
      select: {
        status: true,
        level: true,
        sentAt: true,
        approvals: { select: { approverId: true, decision: true, changes: true } },
      },
    });
    expect(stored).toMatchObject({ status: 'SENT', level: 'CRITICAL' });
    expect(stored.sentAt).not.toBeNull();
    expect(stored.approvals).toHaveLength(1);
    expect(stored.approvals[0]).toMatchObject({ approverId: delegate.id, decision: 'APPROVED' });
    expect((stored.approvals[0]?.changes as { fields: string[] }).fields).toEqual(
      expect.arrayContaining(['level', 'title']),
    );

    const audit = await prisma.auditLog.findMany({
      where: { entityId: alert.id },
      select: { action: true, actorId: true },
    });
    expect(audit).toEqual(
      expect.arrayContaining([
        { action: 'alert.created', actorId: delegate.id },
        { action: 'alert.approved', actorId: delegate.id },
        { action: 'alert.sent', actorId: delegate.id },
      ]),
    );

    // L'habitant de démonstration est abonné à Thiaroye Gare (dans l'application + web).
    const deliveries = await prisma.alertDelivery.findMany({
      where: { alertId: alert.id, userId: citizen.id },
      select: { channel: true, status: true, mode: true },
    });
    expect(deliveries).toEqual(
      expect.arrayContaining([
        { channel: 'IN_APP', status: 'DELIVERED', mode: 'in_app' },
        { channel: 'WEB_PUSH', status: 'SIMULATED', mode: 'simulation' },
      ]),
    );
    const notifications = await listMyNotifications(citizen);
    expect(notifications.some((n) => n.alert.id === alert.id)).toBe(true);

    // Publique, sans créateur ni approbateur.
    const active = await listActiveAlerts();
    const shown = active.find((a) => a.id === alert.id);
    expect(shown?.type).toBe('INDICATIVE');
    expect(JSON.stringify(shown)).not.toMatch(/createdBy|approver|email/);

    // Une alerte envoyée ne se renvoie pas et ne s'approuve pas deux fois.
    await expectServiceError(dispatchAlert(alert.id), 'CONFLICT');
    await expectServiceError(approveAlert(delegate, alert.id, {}), 'CONFLICT');

    // Levée : elle quitte les alertes en cours.
    await cancelAlert(delegate, alert.id, 'Test : fin de l’épisode.');
    expect((await listActiveAlerts()).some((a) => a.id === alert.id)).toBe(false);
  });

  it('rejet avec motif ; plus aucune approbation possible ensuite', async () => {
    const alert = await track(createAlert(agent, alertInput()));
    await updateAlert(agent, alert.id, { messageFr: 'Test : message corrigé avant décision.' });
    await rejectAlert(agent, alert.id, 'Test : pas de pluie annoncée.');
    const stored = await prisma.alert.findUniqueOrThrow({
      where: { id: alert.id },
      select: { status: true, approvals: { select: { decision: true, reason: true } } },
    });
    expect(stored.status).toBe('REJECTED');
    expect(stored.approvals[0]).toEqual({
      decision: 'REJECTED',
      reason: 'Test : pas de pluie annoncée.',
    });
    await expectServiceError(approveAlert(agent, alert.id, {}), 'CONFLICT');
    expect(await prisma.alertDelivery.count({ where: { alertId: alert.id } })).toBe(0);
  });

  it('programmation : rien avant l’heure, envoi par la tâche ensuite', async () => {
    const scheduledAt = new Date(Date.now() + 3_600_000);
    const alert = await track(
      createAlert(agent, alertInput({ scheduledAt: scheduledAt.toISOString() })),
    );
    const result = await approveAlert(agent, alert.id, {});
    expect(result.status).toBe('SCHEDULED');
    expect(await dispatchDueAlerts(new Date())).toBe(0);
    expect(await prisma.alertDelivery.count({ where: { alertId: alert.id } })).toBe(0);
    expect(await dispatchDueAlerts(new Date(scheduledAt.getTime() + 60_000))).toBe(1);
    const stored = await prisma.alert.findUniqueOrThrow({
      where: { id: alert.id },
      select: { status: true },
    });
    expect(stored.status).toBe('SENT');
  });
});

describe('abonnements (EXG-11)', () => {
  it('par position et rayon ; suppression par le seul titulaire', async () => {
    const email = `abonne-${randomUUID().slice(0, 8)}@banlieue-alerte.test`;
    createdEmails.push(email);
    await register({ name: 'Abonné Test', email, password: 'mot-de-passe-test-4' });
    const subscriber = await asUser(email);
    const created = await createSubscription(subscriber, {
      mode: 'position',
      lat: 14.7495,
      lng: -17.381,
      radiusMeters: 1000,
      minLevel: 'MODERATE',
      locale: 'fr',
      channelInApp: true,
      channelWebPush: false,
    });
    expect(await listMySubscriptions(subscriber)).toHaveLength(1);
    await expectServiceError(deleteSubscription(citizen, created.id), 'NOT_FOUND');

    // Une alerte sur Thiaroye Gare atteint cet abonné par sa position.
    const alert = await track(createAlert(agent, alertInput()));
    const result = await approveAlert(agent, alert.id, {});
    expect(result.delivery?.matched).toBeGreaterThanOrEqual(2);
    expect(
      await prisma.alertDelivery.count({ where: { alertId: alert.id, userId: subscriber.id } }),
    ).toBe(1);

    // Suppression du compte : abonnements effacés (position privée).
    await deleteMyAccount(subscriber);
    expect(await prisma.subscription.count({ where: { userId: subscriber.id } })).toBe(0);
    expect(await prisma.alertDelivery.count({ where: { userId: subscriber.id } })).toBe(0);
  });
});

describe('grille versionnée (EXG-42)', () => {
  it('création, activation, utilisation par le calcul, retour en arrière, journal', async () => {
    const previous = await getActiveRules();
    const params = structuredClone(DEFAULT_RULE_PARAMS);
    params.factors.rain24h.thresholds = [2, 15, 40];
    const created = await createRuleVersion(admin, {
      name: 'Test : seuils de pluie relevés',
      params,
      activate: true,
    });
    ruleVersionIds.push(created.id);
    expect((await getActiveRules()).id).toBe(created.id);

    const result = await refreshRisk({
      provider: heavyRain,
      injectedWeather: true,
      trigger: 'test',
    });
    runIds.push(result.runId);
    const run = await prisma.riskRun.findUniqueOrThrow({
      where: { id: result.runId },
      select: { ruleVersionId: true },
    });
    expect(run.ruleVersionId).toBe(created.id);

    await activateRuleVersion(admin, previous.id);
    expect((await getActiveRules()).id).toBe(previous.id);
    expect(
      await prisma.auditLog.count({
        where: {
          action: { in: ['risk.rules_created', 'risk.rules_activated'] },
          createdAt: { gte: startedAt },
        },
      }),
    ).toBeGreaterThanOrEqual(2);

    await expectServiceError(
      createRuleVersion(agent, { name: 'Refusé', params, activate: false }),
      'FORBIDDEN',
    );
  });
});
