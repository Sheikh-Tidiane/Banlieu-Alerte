import { cookies } from 'next/headers';
import { cache } from 'react';
import { getPrisma } from '@/lib/db';
import type { AuthUser } from '@/permissions/types';
import { generateToken, hashToken } from './tokens';

// Sessions maison (D-034) : cookie httpOnly portant un jeton aléatoire, empreinte en base.

export const SESSION_COOKIE = 'ba_session';
export const SESSION_TTL_MS = 30 * 86_400_000;
/** La date d'expiration glisse au plus une fois par jour (évite une écriture par requête). */
const SLIDE_AFTER_MS = 86_400_000;

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await getPrisma().session.create({ data: { tokenHash: hashToken(token), userId, expiresAt } });
  return { token, expiresAt };
}

export async function revokeSession(token: string): Promise<void> {
  await getPrisma().session.deleteMany({ where: { tokenHash: hashToken(token) } });
}

export async function revokeAllSessions(userId: string): Promise<void> {
  await getPrisma().session.deleteMany({ where: { userId } });
}

/** Utilisateur actif lié à un jeton de session, ou null (session absente, expirée, compte bloqué). */
export async function getUserFromToken(token: string | undefined): Promise<AuthUser | null> {
  if (!token) return null;
  const prisma = getPrisma();
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      expiresAt: true,
      lastSeenAt: true,
      mfaVerifiedAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          communeId: true,
          locale: true,
          totpEnabledAt: true,
          delegatedNeighborhood: { select: { id: true } },
        },
      },
    },
  });
  if (!session || session.expiresAt.getTime() <= Date.now() || session.user.status !== 'ACTIVE') {
    return null;
  }
  if (Date.now() - session.lastSeenAt.getTime() > SLIDE_AFTER_MS) {
    await prisma.session.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date(), expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
    });
  }
  const { user } = session;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    communeId: user.communeId,
    locale: user.locale,
    neighborhoodIds: user.delegatedNeighborhood.map((n) => n.id),
    sessionId: session.id,
    mfaEnrolled: user.totpEnabledAt !== null,
    mfaVerified: session.mfaVerifiedAt !== null,
  };
}

/** Utilisateur de la requête en cours (mis en cache pour la durée de la requête). */
export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const store = await cookies();
  return getUserFromToken(store.get(SESSION_COOKIE)?.value);
});

export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    // Chrome accepte les cookies Secure sur http://localhost ; ailleurs, HTTPS est requis.
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  });
}

export async function readSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
