import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { afterAll, describe, expect, it } from 'vitest';
import { getPrisma } from '@/lib/db';
import { photoStorage } from '@/lib/photos/storage';
import { ServiceError } from '@/services/errors';
import { createReport } from '@/services/reports/create';
import { confirmReport, flagReport } from '@/services/reports/engagement';
import { getPublicReport, listPublicReports } from '@/services/reports/read';
import { createReportSchema } from '@/validators/report';

// Nécessite la base de développement migrée et le seed appliqué (npm run test:db).
const prisma = getPrisma();
const created: string[] = [];

// Position de test proche d'un repère démo de « Thiaroye Gare », décalée à chaque test
// pour ne pas déclencher la détection de doublons entre tests.
let offset = 0;
function input(extra: Record<string, string> = {}) {
  offset += 0.002;
  return createReportSchema.parse({
    type: 'BLOCKED_DRAIN',
    severity: 'MEDIUM',
    lat: String(14.7488 + offset),
    lng: '-17.3812',
    confirmNotDuplicate: 'true',
    ...extra,
  });
}

afterAll(async () => {
  await prisma.report.deleteMany({ where: { trackingCode: { in: created } } });
  await prisma.$disconnect();
});

describe('création de signalement (EXG-02, EXG-03)', () => {
  it('crée un signalement sans compte, rattaché au quartier, avec historique NEW', async () => {
    offset = 0; // position du repère « gare » : rattachement automatique attendu
    const result = await createReport(
      createReportSchema.parse({
        type: 'FLOODING',
        severity: 'HIGH',
        lat: '14.7488',
        lng: '-17.3812',
        confirmNotDuplicate: 'true',
      }),
      null,
    );
    created.push(result.trackingCode);
    expect(result.created).toBe(true);
    const report = await prisma.report.findUniqueOrThrow({
      where: { trackingCode: result.trackingCode },
      include: { neighborhood: true, statusHistory: true },
    });
    expect(report.authorId).toBeNull();
    expect(report.isDemo).toBe(false);
    expect(report.neighborhood?.name).toBe('Thiaroye Gare');
    expect(report.attachment).toBe('AUTOMATIC');
    expect(report.statusHistory.map((h) => h.toStatus)).toEqual(['NEW']);
  });

  it('hors de tout repère : « quartier non identifié », sans erreur', async () => {
    const result = await createReport(
      createReportSchema.parse({
        type: 'OTHER',
        severity: 'LOW',
        lat: '14.9',
        lng: '-17.2',
        confirmNotDuplicate: 'true',
      }),
      null,
    );
    created.push(result.trackingCode);
    const report = await prisma.report.findUniqueOrThrow({
      where: { trackingCode: result.trackingCode },
    });
    expect(report.neighborhoodId).toBeNull();
    expect(report.attachment).toBe('UNIDENTIFIED');
  });

  it('est idempotent sur clientId (resynchronisation hors-ligne, EXG-04)', async () => {
    const clientId = randomUUID();
    const data = input({ clientId });
    const first = await createReport(data, null);
    const second = await createReport(data, null);
    created.push(first.trackingCode);
    expect(second).toEqual({ trackingCode: first.trackingCode, created: false });
    expect(await prisma.report.count({ where: { clientId } })).toBe(1);
  });

  it('propose un doublon proche, sauf si l’habitant confirme', async () => {
    const data = input();
    const first = await createReport(data, null);
    created.push(first.trackingCode);
    const again = { ...data, confirmNotDuplicate: false };
    await expect(createReport(again, null)).rejects.toMatchObject({
      code: 'CONFLICT',
      details: { duplicates: [first.trackingCode] },
    });
    const forced = await createReport({ ...data, confirmNotDuplicate: true }, null);
    created.push(forced.trackingCode);
    expect(forced.created).toBe(true);
  });

  it('refuse un envoi plus rapide que la durée minimale de saisie', async () => {
    await expect(createReport(input({ fillDurationMs: '500' }), null)).rejects.toBeInstanceOf(
      ServiceError,
    );
  });

  it('stocke une photo sans métadonnées (EXG-13)', async () => {
    const photo = await sharp({
      create: { width: 800, height: 600, channels: 3, background: '#1B5E20' },
    })
      .jpeg()
      .withExif({ IFD0: { Model: 'Modele-Secret' } })
      .toBuffer();
    const result = await createReport(input(), photo);
    created.push(result.trackingCode);
    const detail = await getPublicReport(result.trackingCode);
    expect(detail?.photos).toHaveLength(1);
    const key = detail?.photos[0]?.url.split('/').pop() ?? '';
    const stored = await photoStorage.read(key);
    expect(stored).not.toBeNull();
    expect((await sharp(stored!).metadata()).exif).toBeUndefined();
    expect(stored!.toString('latin1')).not.toContain('Modele-Secret');
  });

  it('refuse un faux fichier image sans rien enregistrer', async () => {
    const before = await prisma.report.count();
    await expect(createReport(input(), Buffer.from('pas une image'))).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    expect(await prisma.report.count()).toBe(before);
  });
});

describe('confirmation par les voisins', () => {
  it('un seul « Je vois aussi » par appareil', async () => {
    const { trackingCode } = await createReport(input(), null);
    created.push(trackingCode);
    const device = randomUUID();
    const first = await confirmReport(trackingCode, device);
    const second = await confirmReport(trackingCode, device);
    const other = await confirmReport(trackingCode, randomUUID());
    expect(first).toMatchObject({ confirmed: true, confirmationCount: 1 });
    expect(second).toMatchObject({
      confirmed: false,
      alreadyConfirmed: true,
      confirmationCount: 1,
    });
    expect(other.confirmationCount).toBe(2);
    const votes = await prisma.reportVote.findMany({ where: { report: { trackingCode } } });
    expect(votes.every((vote) => vote.voterKey !== device && vote.voterKey.length === 64)).toBe(
      true,
    );
  });

  it('enregistre un signalement d’abus', async () => {
    const { trackingCode } = await createReport(input(), null);
    created.push(trackingCode);
    await flagReport(trackingCode, 'Photo d’une personne');
    expect(await prisma.abuseFlag.count({ where: { report: { trackingCode } } })).toBe(1);
  });
});

describe('lecture publique (EXG-06, EXG-39)', () => {
  it('liste et détail n’exposent ni position précise ni données personnelles', async () => {
    const list = await listPublicReports();
    expect(list.length).toBeGreaterThan(0);
    for (const report of list) {
      expect(String(report.lat).split('.')[1]?.length ?? 0).toBeLessThanOrEqual(3);
      expect(String(report.lng).split('.')[1]?.length ?? 0).toBeLessThanOrEqual(3);
      expect(Object.keys(report)).not.toEqual(
        expect.arrayContaining(['id', 'authorId', 'clientId']),
      );
    }
    const detail = await getPublicReport(list[0]!.trackingCode);
    const json = JSON.stringify(detail);
    for (const field of [
      'authorId',
      'clientId',
      'changedById',
      'voterKey',
      'email',
      'phone',
      'reportId',
    ]) {
      expect(json).not.toContain(field);
    }
  });

  it('les signalements démo restent marqués (EXG-16)', async () => {
    const demo = await getPublicReport('BA-DEMO-0001');
    expect(demo?.isDemo).toBe(true);
  });
});
