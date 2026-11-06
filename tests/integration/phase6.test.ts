import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { toErrorResponse } from '@/lib/api/handle';
import { createSession, getUserFromToken } from '@/lib/auth/session';
import { base32Decode, hotp, totpStep } from '@/lib/auth/totp';
import { hashToken } from '@/lib/auth/tokens';
import { getPrisma } from '@/lib/db';
import { sanitizeErrorMessage } from '@/lib/supervision/sanitize';
import { FailingWeatherProvider } from '@/lib/weather/open-meteo';
import { purgeExpiredData } from '@/jobs/purge';
import type { AuthUser } from '@/permissions/types';
import {
  confirmEnrollment,
  redeemRecoveryCode,
  startEnrollment,
  verifySecondFactor,
} from '@/services/auth/mfa';
import { resetDemo, simulateRain } from '@/services/demo/simulator';
import { ServiceError } from '@/services/errors';
import { refreshRisk } from '@/services/risk/refresh';
import { getHealth } from '@/services/supervision/health';

// Nécessite la base migrée et le seed appliqué (npm run test:db).
const prisma = getPrisma();
const startedAt = new Date();
const emails: string[] = [];
const testRunIds: string[] = [];

async function expectServiceError(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toSatisfy(
    (error: unknown) => error instanceof ServiceError && error.code === code,
  );
}

async function sessionUser(userId: string): Promise<AuthUser> {
  const { token } = await createSession(userId);
  return (await getUserFromToken(token))!;
}

let admin: AuthUser;

beforeAll(async () => {
  const demoAdmin = await prisma.user.findUniqueOrThrow({
    where: { email: 'admin.demo@banlieue-alerte.test' },
    select: { id: true },
  });
  admin = await sessionUser(demoAdmin.id);
});

afterAll(async () => {
  await prisma.riskRun.deleteMany({ where: { id: { in: testRunIds } } });
  await prisma.weatherSnapshot.deleteMany({ where: { isDemo: true, runs: { none: {} } } });
  await prisma.errorLog.deleteMany({ where: { createdAt: { gte: startedAt } } });
  await prisma.user.deleteMany({ where: { email: { in: emails } } });
  delete process.env.DEMO_MODE;
  await prisma.$disconnect();
});

describe('double authentification de l’administrateur (EXG-41, D-064)', () => {
  it('enrôlement, secret chiffré, code faux et rejoué refusés, code de secours unique', async () => {
    const email = `admin-mfa-${randomUUID().slice(0, 8)}@banlieue-alerte.test`;
    emails.push(email);
    const created = await prisma.user.create({
      data: { name: 'Admin MFA test', email, role: 'ADMIN' },
      select: { id: true },
    });
    let user = await sessionUser(created.id);
    expect(user).toMatchObject({ mfaEnrolled: false, mfaVerified: false });

    const enrollment = await startEnrollment(user);
    expect(enrollment.qrCode).toMatch(/^data:image\/png;base64,/);
    const secret = enrollment.manualKey.replace(/\s/g, '');
    // Secret jamais stocké en clair.
    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: created.id },
      select: { totpSecret: true },
    });
    expect(stored.totpSecret).not.toContain(secret);
    // Reprise de l'enrôlement en attente : même secret.
    expect((await startEnrollment(user)).manualKey).toBe(enrollment.manualKey);

    const code = (offset = 0) => hotp(base32Decode(secret), totpStep(new Date()) + offset);
    await expectServiceError(confirmEnrollment(user, '000000'), 'VALIDATION_ERROR');
    const { recoveryCodes } = await confirmEnrollment(user, code());
    expect(recoveryCodes).toHaveLength(8);
    const hashes = await prisma.recoveryCode.findMany({
      where: { userId: created.id },
      select: { codeHash: true },
    });
    expect(hashes.every((h) => !recoveryCodes.some((c) => h.codeHash.includes(c)))).toBe(true);
    expect(await getUserFromToken(undefined)).toBeNull();

    // Nouvelle session : rien n'est vérifié ; le code déjà utilisé est refusé (rejeu).
    user = await sessionUser(created.id);
    expect(user).toMatchObject({ mfaEnrolled: true, mfaVerified: false });
    await expectServiceError(verifySecondFactor(user, code()), 'VALIDATION_ERROR');
    await verifySecondFactor(user, code(1));
    const session = await prisma.session.findUniqueOrThrow({
      where: { id: user.sessionId! },
      select: { mfaVerifiedAt: true },
    });
    expect(session.mfaVerifiedAt).not.toBeNull();

    // Code de secours : une seule fois.
    const other = await sessionUser(created.id);
    expect((await redeemRecoveryCode(other, recoveryCodes[0]!)).remaining).toBe(7);
    const third = await sessionUser(created.id);
    await expectServiceError(redeemRecoveryCode(third, recoveryCodes[0]!), 'VALIDATION_ERROR');

    const audit = await prisma.auditLog.findMany({
      where: { entityId: created.id, action: { startsWith: 'auth.mfa' } },
      select: { action: true },
    });
    expect(audit.map((a) => a.action)).toEqual(
      expect.arrayContaining([
        'auth.mfa_enrolled',
        'auth.mfa_verified',
        'auth.mfa_failed',
        'auth.mfa_recovery_used',
      ]),
    );
  });

  it('un compte non administrateur ne peut pas s’enrôler', async () => {
    const citizen = await prisma.user.findUniqueOrThrow({
      where: { email: 'habitant.demo@banlieue-alerte.test' },
      select: { id: true },
    });
    await expectServiceError(startEnrollment(await sessionUser(citizen.id)), 'FORBIDDEN');
  });
});

describe('simulateur de démonstration (D-063)', () => {
  it('désactivé par défaut', async () => {
    delete process.env.DEMO_MODE;
    await expectServiceError(simulateRain(admin), 'NOT_FOUND');
    await expectServiceError(resetDemo(admin), 'NOT_FOUND');
  });

  it('épisode simulé : données démo seulement, brouillons non envoyés, réinitialisation précise', async () => {
    process.env.DEMO_MODE = 'true';
    const seedReports = await prisma.report.count({
      where: { trackingCode: { startsWith: 'BA-DEMO-' } },
    });
    const result = await simulateRain(admin);
    expect(result.reports).toBe(8);
    const reports = await prisma.report.findMany({
      where: { simulationRunId: result.runId },
      select: { isDemo: true },
    });
    expect(reports).toHaveLength(8);
    expect(reports.every((r) => r.isDemo)).toBe(true);
    const drafts = await prisma.alert.findMany({
      where: { riskPrediction: { runId: result.runId } },
      select: { status: true, isDemo: true, _count: { select: { deliveries: true } } },
    });
    expect(
      drafts.every((d) => d.status === 'PENDING_APPROVAL' && d.isDemo && d._count.deliveries === 0),
    ).toBe(true);

    const counts = await resetDemo(admin);
    expect(counts.reports).toBe(8);
    expect(await prisma.report.count({ where: { simulationRunId: result.runId } })).toBe(0);
    expect(await prisma.riskRun.count({ where: { trigger: 'demo' } })).toBe(0);
    // Les données du seed ne sont pas touchées.
    expect(await prisma.report.count({ where: { trackingCode: { startsWith: 'BA-DEMO-' } } })).toBe(
      seedReports,
    );
    delete process.env.DEMO_MODE;
  });
});

describe('purge des données (D-043, D-065)', () => {
  it('supprime au-delà de la durée de conservation, conserve en deçà', async () => {
    const email = `purge-${randomUUID().slice(0, 8)}@banlieue-alerte.test`;
    emails.push(email);
    const user = await prisma.user.create({
      data: { name: 'Purge test', email },
      select: { id: true },
    });
    const day = 86_400_000;
    const now = new Date();
    const old = await prisma.session.create({
      data: {
        tokenHash: hashToken(randomUUID()),
        userId: user.id,
        expiresAt: new Date(now.getTime() - 31 * day),
      },
    });
    const recent = await prisma.session.create({
      data: {
        tokenHash: hashToken(randomUUID()),
        userId: user.id,
        expiresAt: new Date(now.getTime() - 5 * day),
      },
    });
    const oldError = await prisma.errorLog.create({
      data: { source: 'test', message: 'ancienne', createdAt: new Date(now.getTime() - 181 * day) },
    });
    const freshError = await prisma.errorLog.create({
      data: { source: 'test', message: 'récente' },
    });

    const counts = await purgeExpiredData(now);
    expect(counts.sessions).toBeGreaterThanOrEqual(1);
    expect(await prisma.session.findUnique({ where: { id: old.id } })).toBeNull();
    expect(await prisma.session.findUnique({ where: { id: recent.id } })).not.toBeNull();
    expect(await prisma.errorLog.findUnique({ where: { id: oldError.id } })).toBeNull();
    expect(await prisma.errorLog.findUnique({ where: { id: freshError.id } })).not.toBeNull();
    expect(
      await prisma.auditLog.count({
        where: { action: 'data.purged', createdAt: { gte: startedAt } },
      }),
    ).toBeGreaterThanOrEqual(1);
  });
});

describe('supervision (EXG-37)', () => {
  it('panne météo simulée visible dans l’état de santé', async () => {
    const result = await refreshRisk({
      provider: new FailingWeatherProvider(),
      injectedWeather: true,
      trigger: 'test',
    });
    testRunIds.push(result.runId);
    const health = await getHealth();
    expect(health.checks.database).toBe('ok');
    expect('details' in health ? health.details?.weatherErrors24h : 0).toBeGreaterThanOrEqual(1);
    expect(health.checks).toMatchObject({ weather: 'warning' });
    expect(JSON.stringify(health)).not.toMatch(/@|email|token/i);
  });

  it('erreurs inattendues journalisées sans donnée personnelle', async () => {
    const response = toErrorResponse(
      new Error(
        'Échec pour fatou.diallo@exemple.sn, tél. +221 77 123 45 67, position 14.748123,-17.381234',
      ),
    );
    expect(response.status).toBe(500);
    await new Promise((r) => setTimeout(r, 200));
    const logged = await prisma.errorLog.findFirst({
      where: { source: 'api', createdAt: { gte: startedAt } },
      orderBy: { createdAt: 'desc' },
      select: { message: true },
    });
    expect(logged?.message).toBeDefined();
    expect(logged!.message).not.toMatch(/fatou|exemple\.sn|77 123|14\.748123/);
    expect(sanitizeErrorMessage('jeton abcdefghijklmnopqrstuvwxyz0123456789ABCD')).toBe(
      'jeton [jeton]',
    );
  });
});
