import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { ServiceError } from '@/services/errors';
import type { AuthUser, Role } from './types';

/**
 * Un administrateur n'exerce ses droits qu'après le second facteur (EXG-41, D-064) : sans
 * lui, toute route ou page réservée à l'équipe lui est refusée.
 */
export function needsSecondFactor(user: AuthUser, roles?: readonly Role[]): boolean {
  return user.role === 'ADMIN' && Boolean(roles?.includes('ADMIN')) && user.mfaVerified !== true;
}

/** Route handlers : utilisateur connecté avec l'un des rôles demandés, sinon 401 ou 403. */
export async function requireUser(roles?: readonly Role[]): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) throw new ServiceError('UNAUTHENTICATED', 'Connexion requise.');
  if (roles && !roles.includes(user.role)) {
    throw new ServiceError('FORBIDDEN', 'Accès refusé.');
  }
  if (needsSecondFactor(user, roles)) {
    throw new ServiceError('FORBIDDEN', 'Second facteur requis pour un compte administrateur.');
  }
  return user;
}

/** Pages : redirige vers la connexion (avec retour), ou vers l'accueil si le rôle ne convient pas. */
export async function requirePageUser(path: string, roles?: readonly Role[]): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/connexion?suite=${encodeURIComponent(path)}`);
  if (roles && !roles.includes(user.role)) redirect('/acces-refuse');
  if (needsSecondFactor(user, roles)) {
    redirect(`/connexion/second-facteur?suite=${encodeURIComponent(path)}`);
  }
  return user;
}
