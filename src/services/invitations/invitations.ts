import { hashPassword } from '@/lib/auth/password';
import { createSession, revokeAllSessions } from '@/lib/auth/session';
import { generateToken, hashToken } from '@/lib/auth/tokens';
import { getPrisma } from '@/lib/db';
import { createNotificationTransport } from '@/lib/notifications';
import type { Prisma } from '@/generated/prisma/client';
import { canBlockUsers, canInvite } from '@/permissions/policies';
import type { AuthUser } from '@/permissions/types';
import { recordAudit } from '@/services/audit';
import { ServiceError } from '@/services/errors';
import type { InvitationInput } from '@/validators/auth';

// Comptes sensibles par invitation uniquement (EXG-33) : jeton à usage
// unique, haché, expirant, révocable ; chaque étape est journalisée.

export const INVITATION_TTL_MS = 7 * 86_400_000;
export const PASSWORD_RESET_TTL_MS = 86_400_000;

const appUrl = () => (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');

function assertAdmin(user: AuthUser, check: (u: AuthUser) => boolean) {
  if (!check(user)) throw new ServiceError('FORBIDDEN', 'Action réservée à l’administrateur.');
}

/** Crée l'invitation ; le lien n'est renvoyé qu'une fois (seule l'empreinte est conservée). */
export async function createInvitation(admin: AuthUser | null, input: InvitationInput) {
  if (admin) assertAdmin(admin, canInvite);
  const prisma = getPrisma();

  const existing = await prisma.user.findUnique({
    where: { email: input.email },
    select: { status: true },
  });
  if (existing && existing.status !== 'DELETED') {
    throw new ServiceError('CONFLICT', 'Un compte existe déjà avec cette adresse e-mail.', {
      email: ['Un compte existe déjà avec cette adresse e-mail.'],
    });
  }
  if (
    input.role === 'AGENT' &&
    !(await prisma.commune.findUnique({ where: { id: input.communeId! } }))
  ) {
    throw new ServiceError('VALIDATION_ERROR', 'Commune inconnue.', {
      communeId: ['Commune inconnue.'],
    });
  }
  if (
    input.role === 'DELEGATE' &&
    !(await prisma.neighborhood.findUnique({ where: { id: input.neighborhoodId! } }))
  ) {
    throw new ServiceError('VALIDATION_ERROR', 'Quartier inconnu.', {
      neighborhoodId: ['Quartier inconnu.'],
    });
  }

  const token = generateToken();
  const invitation = await prisma.$transaction(async (tx) => {
    // Une seule invitation en attente par adresse : les précédentes sont révoquées.
    await tx.invitation.updateMany({
      where: { email: input.email, status: 'PENDING' },
      data: { status: 'REVOKED', revokedAt: new Date() },
    });
    const created = await tx.invitation.create({
      data: {
        email: input.email,
        role: input.role,
        scopeCommuneId: input.role === 'AGENT' ? input.communeId : null,
        scopeNeighborhoodId: input.role === 'DELEGATE' ? input.neighborhoodId : null,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
        // Premier administrateur créé par le script : l'invitation est rattachée à elle-même.
        createdById: admin?.id ?? (await systemActorId(tx)),
      },
      select: { id: true, expiresAt: true, role: true },
    });
    await recordAudit(
      {
        actorId: admin?.id ?? null,
        action: 'invitation.created',
        entityType: 'invitation',
        entityId: created.id,
        metadata: { role: input.role },
      },
      tx,
    );
    return created;
  });

  const link = `${appUrl()}/invitation/${token}`;
  // Mode simulation (D-006) : aucun e-mail réel ; le lien est affiché à l'administrateur.
  await createNotificationTransport().send({
    channel: 'email',
    recipientRef: invitation.id,
    message: 'invitation',
  });
  return { id: invitation.id, role: invitation.role, expiresAt: invitation.expiresAt, link };
}

/**
 * Compte technique propriétaire des invitations créées en ligne de commande, quand aucun
 * administrateur n'existe encore. Il ne peut pas se connecter (aucun mot de passe).
 */
async function systemActorId(tx: Prisma.TransactionClient): Promise<string> {
  const system = await tx.user.upsert({
    where: { email: 'systeme@banlieue-alerte.invalid' },
    update: {},
    create: {
      name: 'Système',
      email: 'systeme@banlieue-alerte.invalid',
      role: 'ADMIN',
      status: 'BLOCKED',
    },
    select: { id: true },
  });
  return system.id;
}

/** Invitation valide pour ce jeton, ou null ; une invitation expirée est marquée comme telle. */
export async function findValidInvitation(token: string) {
  const prisma = getPrisma();
  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      expiresAt: true,
      scopeCommune: { select: { name: true } },
      scopeNeighborhood: { select: { name: true } },
    },
  });
  if (!invitation || invitation.status !== 'PENDING') return null;
  if (invitation.expiresAt.getTime() <= Date.now()) {
    await prisma.invitation.update({ where: { id: invitation.id }, data: { status: 'EXPIRED' } });
    return null;
  }
  return invitation;
}

export async function acceptInvitation(token: string, name: string, password: string) {
  const prisma = getPrisma();
  const passwordHash = await hashPassword(password);
  const userId = await prisma.$transaction(async (tx) => {
    const invitation = await tx.invitation.findUnique({ where: { tokenHash: hashToken(token) } });
    if (
      !invitation ||
      invitation.status !== 'PENDING' ||
      invitation.expiresAt.getTime() <= Date.now()
    ) {
      throw new ServiceError('NOT_FOUND', 'Invitation invalide, expirée ou déjà utilisée.');
    }
    // Passage PENDING → ACCEPTED conditionnel : deux acceptations simultanées ne passent pas.
    const claimed = await tx.invitation.updateMany({
      where: { id: invitation.id, status: 'PENDING' },
      data: { status: 'ACCEPTED', acceptedAt: new Date() },
    });
    if (claimed.count !== 1) throw new ServiceError('NOT_FOUND', 'Invitation déjà utilisée.');

    const user = await tx.user.create({
      data: {
        name,
        email: invitation.email,
        passwordHash,
        role: invitation.role,
        communeId: invitation.scopeCommuneId,
      },
      select: { id: true },
    });
    if (invitation.scopeNeighborhoodId) {
      await tx.neighborhood.update({
        where: { id: invitation.scopeNeighborhoodId },
        data: { delegateId: user.id },
      });
    }
    await tx.invitation.update({ where: { id: invitation.id }, data: { acceptedById: user.id } });
    await recordAudit(
      {
        actorId: user.id,
        action: 'invitation.accepted',
        entityType: 'invitation',
        entityId: invitation.id,
        metadata: { role: invitation.role },
      },
      tx,
    );
    return user.id;
  });
  return { userId, session: await createSession(userId) };
}

export async function revokeInvitation(admin: AuthUser, invitationId: string) {
  assertAdmin(admin, canInvite);
  const result = await getPrisma().invitation.updateMany({
    where: { id: invitationId, status: 'PENDING' },
    data: { status: 'REVOKED', revokedAt: new Date() },
  });
  if (result.count === 0)
    throw new ServiceError('NOT_FOUND', 'Invitation introuvable ou déjà traitée.');
  await recordAudit({
    actorId: admin.id,
    action: 'invitation.revoked',
    entityType: 'invitation',
    entityId: invitationId,
  });
  return { revoked: true };
}

export async function listPendingInvitations(admin: AuthUser) {
  assertAdmin(admin, canInvite);
  return getPrisma().invitation.findMany({
    where: { status: 'PENDING', expiresAt: { gt: new Date() } },
    select: {
      id: true,
      email: true,
      role: true,
      expiresAt: true,
      scopeCommune: { select: { name: true } },
      scopeNeighborhood: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

// ---------------------------------------------------------------------------------------
// Gestion des comptes par l'administrateur
// ---------------------------------------------------------------------------------------

export async function listAccounts(admin: AuthUser) {
  assertAdmin(admin, canBlockUsers);
  return getPrisma().user.findMany({
    where: { status: { not: 'DELETED' }, email: { not: 'systeme@banlieue-alerte.invalid' } },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      isDemo: true,
      commune: { select: { name: true } },
      delegatedNeighborhood: { select: { name: true } },
    },
    orderBy: [{ role: 'desc' }, { name: 'asc' }],
  });
}

export async function setUserBlocked(admin: AuthUser, userId: string, blocked: boolean) {
  assertAdmin(admin, canBlockUsers);
  if (userId === admin.id)
    throw new ServiceError('VALIDATION_ERROR', 'Vous ne pouvez pas bloquer votre propre compte.');
  const user = await getPrisma().user.findUnique({
    where: { id: userId },
    select: { status: true },
  });
  if (!user || user.status === 'DELETED')
    throw new ServiceError('NOT_FOUND', 'Compte introuvable.');
  await getPrisma().user.update({
    where: { id: userId },
    data: { status: blocked ? 'BLOCKED' : 'ACTIVE' },
  });
  // Blocage immédiat : toutes les sessions du compte sont fermées.
  if (blocked) await revokeAllSessions(userId);
  await recordAudit({
    actorId: admin.id,
    action: blocked ? 'user.blocked' : 'user.unblocked',
    entityType: 'user',
    entityId: userId,
  });
  return { blocked };
}

/** Lien de réinitialisation (24 h, usage unique) : pas d'e-mail réel pendant le pilote. */
export async function createPasswordReset(admin: AuthUser, userId: string) {
  assertAdmin(admin, canBlockUsers);
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { status: true } });
  if (!user || user.status === 'DELETED')
    throw new ServiceError('NOT_FOUND', 'Compte introuvable.');
  const token = generateToken();
  const reset = await prisma.passwordReset.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
      createdById: admin.id,
    },
    select: { id: true, expiresAt: true },
  });
  await recordAudit({
    actorId: admin.id,
    action: 'auth.password_reset_created',
    entityType: 'user',
    entityId: userId,
  });
  return { link: `${appUrl()}/reinitialisation/${token}`, expiresAt: reset.expiresAt };
}

export async function findValidPasswordReset(token: string) {
  const reset = await getPrisma().passwordReset.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, usedAt: true, expiresAt: true, user: { select: { status: true } } },
  });
  if (
    !reset ||
    reset.usedAt ||
    reset.expiresAt.getTime() <= Date.now() ||
    reset.user.status === 'DELETED'
  )
    return null;
  return reset;
}

export async function consumePasswordReset(token: string, password: string) {
  const prisma = getPrisma();
  const passwordHash = await hashPassword(password);
  const userId = await prisma.$transaction(async (tx) => {
    const reset = await tx.passwordReset.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!reset || reset.usedAt || reset.expiresAt.getTime() <= Date.now()) {
      throw new ServiceError('NOT_FOUND', 'Lien invalide, expiré ou déjà utilisé.');
    }
    const claimed = await tx.passwordReset.updateMany({
      where: { id: reset.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (claimed.count !== 1) throw new ServiceError('NOT_FOUND', 'Lien déjà utilisé.');
    await tx.user.update({ where: { id: reset.userId }, data: { passwordHash } });
    await tx.session.deleteMany({ where: { userId: reset.userId } });
    await recordAudit(
      {
        actorId: reset.userId,
        action: 'auth.password_reset_used',
        entityType: 'user',
        entityId: reset.userId,
      },
      tx,
    );
    return reset.userId;
  });
  return { userId, session: await createSession(userId) };
}
