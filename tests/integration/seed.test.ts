import { afterAll, describe, expect, it } from 'vitest';
import { createPrismaClient } from '@/lib/db';
import { verifyPassword } from '@/lib/auth/password';

// Nécessite : docker compose up -d db, npx prisma migrate dev, npx prisma db seed.
const prisma = createPrismaClient();

afterAll(() => prisma.$disconnect());

describe('seed de démonstration (EXG-16, EXG-40 partiel)', () => {
  it('toutes les lignes de contenu sont marquées isDemo', async () => {
    const counts = await Promise.all([
      prisma.user.count({ where: { isDemo: false } }),
      prisma.commune.count({ where: { isDemo: false } }),
      prisma.neighborhood.count({ where: { isDemo: false } }),
      prisma.neighborhoodLandmark.count({ where: { isDemo: false } }),
      prisma.neighborhoodAlias.count({ where: { isDemo: false } }),
      prisma.report.count({ where: { isDemo: false } }),
    ]);
    expect(counts).toEqual([0, 0, 0, 0, 0, 0]);
    expect(await prisma.report.count({ where: { isDemo: true } })).toBeGreaterThan(0);
  });

  it('les limites de quartier sont « approximatives »', async () => {
    expect(await prisma.neighborhood.count({ where: { boundaryStatus: 'VALIDATED' } })).toBe(0);
  });

  it('crée un compte de test par rôle, avec un mot de passe haché', async () => {
    const users = await prisma.user.findMany({ where: { isDemo: true } });
    expect(users.map((u) => u.role).sort()).toEqual(['ADMIN', 'AGENT', 'CITIZEN', 'DELEGATE']);
    const password = process.env.SEED_TEST_PASSWORD ?? '';
    for (const user of users) {
      expect(user.passwordHash).not.toContain(password);
      expect(await verifyPassword(password, user.passwordHash ?? '')).toBe(true);
    }
  });

  it('chaque signalement a un historique qui aboutit à son statut courant', async () => {
    const reports = await prisma.report.findMany({
      include: { statusHistory: { orderBy: { createdAt: 'asc' } } },
    });
    for (const report of reports) {
      expect(report.statusHistory.at(-1)?.toStatus).toBe(report.status);
    }
  });

  it('prévoit le cas « quartier non identifié »', async () => {
    expect(
      await prisma.report.count({ where: { neighborhoodId: null, attachment: 'UNIDENTIFIED' } }),
    ).toBeGreaterThan(0);
  });
});
