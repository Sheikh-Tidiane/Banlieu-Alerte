import { randomBytes } from 'node:crypto';
import QRCode from 'qrcode';
import { getPrisma } from '@/lib/db';
import { open, seal } from '@/lib/auth/secret-box';
import { hashToken } from '@/lib/auth/tokens';
import { generateTotpSecret, otpauthUri, verifyTotp } from '@/lib/auth/totp';
import type { AuthUser } from '@/permissions/types';
import { recordAudit } from '@/services/audit';
import { ServiceError } from '@/services/errors';

// Double authentification de l'administrateur (EXG-41, D-064) : application d'authentification
// (TOTP), secret chiffré en base, 8 codes de secours à usage unique, vérification par session.

export const RECOVERY_CODE_COUNT = 8;

function requireAdminSession(user: AuthUser): string {
  if (user.role !== 'ADMIN') throw new ServiceError('FORBIDDEN', 'Réservé aux administrateurs.');
  if (!user.sessionId) throw new ServiceError('UNAUTHENTICATED', 'Session requise.');
  return user.sessionId;
}

/** Code de secours lisible : 10 caractères en deux groupes (sans caractères ambigus). */
function newRecoveryCode(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const chars = [...randomBytes(10)].map((b) => alphabet[b % alphabet.length]).join('');
  return `${chars.slice(0, 5)}-${chars.slice(5)}`;
}

const normalizeRecovery = (code: string) => code.trim().toUpperCase().replace(/\s/g, '');

/**
 * Début d'enrôlement : un secret en attente est créé (ou repris s'il existe déjà), puis
 * renvoyé sous forme de QR code et de clé à saisir. Rien n'est actif avant la confirmation.
 */
export async function startEnrollment(user: AuthUser) {
  requireAdminSession(user);
  const prisma = getPrisma();
  const account = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { email: true, totpSecret: true, totpEnabledAt: true },
  });
  if (account.totpEnabledAt) throw new ServiceError('CONFLICT', 'Second facteur déjà configuré.');
  let secret = account.totpSecret ? open(account.totpSecret) : null;
  if (!secret) {
    secret = generateTotpSecret();
    await prisma.user.update({ where: { id: user.id }, data: { totpSecret: seal(secret) } });
  }
  const uri = otpauthUri(secret, account.email ?? user.name);
  return {
    qrCode: await QRCode.toDataURL(uri, { margin: 1, width: 240 }),
    manualKey: secret.replace(/(.{4})/g, '$1 ').trim(),
  };
}

async function markSessionVerified(sessionId: string) {
  await getPrisma().session.update({
    where: { id: sessionId },
    data: { mfaVerifiedAt: new Date() },
  });
}

/** Confirmation de l'enrôlement par un premier code ; renvoie les codes de secours, une seule fois. */
export async function confirmEnrollment(user: AuthUser, code: string) {
  const sessionId = requireAdminSession(user);
  const prisma = getPrisma();
  const account = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { totpSecret: true, totpEnabledAt: true },
  });
  if (account.totpEnabledAt) throw new ServiceError('CONFLICT', 'Second facteur déjà configuré.');
  if (!account.totpSecret) throw new ServiceError('CONFLICT', 'Enrôlement non commencé.');
  const result = verifyTotp(open(account.totpSecret), code);
  if (!result.ok) {
    await recordAudit({
      actorId: user.id,
      action: 'auth.mfa_failed',
      entityType: 'user',
      entityId: user.id,
    });
    throw new ServiceError('VALIDATION_ERROR', 'Code incorrect.', { code: ['Code incorrect.'] });
  }
  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, newRecoveryCode);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { totpEnabledAt: new Date(), totpLastStep: result.step },
    });
    await tx.recoveryCode.deleteMany({ where: { userId: user.id } });
    await tx.recoveryCode.createMany({
      data: codes.map((c) => ({ userId: user.id, codeHash: hashToken(normalizeRecovery(c)) })),
    });
    await tx.session.update({ where: { id: sessionId }, data: { mfaVerifiedAt: new Date() } });
    await recordAudit(
      { actorId: user.id, action: 'auth.mfa_enrolled', entityType: 'user', entityId: user.id },
      tx,
    );
  });
  return { recoveryCodes: codes };
}

/** Vérification à la connexion : un code déjà utilisé (même période) est refusé. */
export async function verifySecondFactor(user: AuthUser, code: string) {
  const sessionId = requireAdminSession(user);
  const prisma = getPrisma();
  const account = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { totpSecret: true, totpEnabledAt: true, totpLastStep: true },
  });
  if (!account.totpEnabledAt || !account.totpSecret) {
    throw new ServiceError('CONFLICT', 'Second facteur non configuré.');
  }
  const result = verifyTotp(open(account.totpSecret), code, new Date(), account.totpLastStep);
  if (!result.ok) {
    await recordAudit({
      actorId: user.id,
      action: 'auth.mfa_failed',
      entityType: 'user',
      entityId: user.id,
    });
    throw new ServiceError('VALIDATION_ERROR', 'Code incorrect ou déjà utilisé.', {
      code: ['Code incorrect ou déjà utilisé.'],
    });
  }
  // Conditionnel : deux vérifications simultanées ne peuvent pas utiliser la même période.
  const claimed = await prisma.user.updateMany({
    where: {
      id: user.id,
      OR: [{ totpLastStep: null }, { totpLastStep: { lt: result.step } }],
    },
    data: { totpLastStep: result.step },
  });
  if (claimed.count !== 1) {
    throw new ServiceError('VALIDATION_ERROR', 'Code déjà utilisé.', {
      code: ['Code déjà utilisé.'],
    });
  }
  await markSessionVerified(sessionId);
  await recordAudit({
    actorId: user.id,
    action: 'auth.mfa_verified',
    entityType: 'user',
    entityId: user.id,
  });
  return { verified: true };
}

/** Code de secours : accepté une seule fois. */
export async function redeemRecoveryCode(user: AuthUser, code: string) {
  const sessionId = requireAdminSession(user);
  const prisma = getPrisma();
  const used = await prisma.recoveryCode.updateMany({
    where: { userId: user.id, codeHash: hashToken(normalizeRecovery(code)), usedAt: null },
    data: { usedAt: new Date() },
  });
  if (used.count !== 1) {
    await recordAudit({
      actorId: user.id,
      action: 'auth.mfa_failed',
      entityType: 'user',
      entityId: user.id,
    });
    throw new ServiceError('VALIDATION_ERROR', 'Code de secours invalide ou déjà utilisé.', {
      code: ['Code de secours invalide ou déjà utilisé.'],
    });
  }
  await markSessionVerified(sessionId);
  const remaining = await prisma.recoveryCode.count({ where: { userId: user.id, usedAt: null } });
  await recordAudit({
    actorId: user.id,
    action: 'auth.mfa_recovery_used',
    entityType: 'user',
    entityId: user.id,
    metadata: { remaining },
  });
  return { verified: true, remaining };
}

/** Réinitialisation (téléphone perdu) : script d'exploitation, journalisée. */
export async function resetSecondFactor(userId: string, actorId: string | null) {
  const prisma = getPrisma();
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { totpSecret: null, totpEnabledAt: null, totpLastStep: null },
    });
    await tx.recoveryCode.deleteMany({ where: { userId } });
    await tx.session.deleteMany({ where: { userId } });
    await recordAudit(
      { actorId, action: 'auth.mfa_reset', entityType: 'user', entityId: userId },
      tx,
    );
  });
}
