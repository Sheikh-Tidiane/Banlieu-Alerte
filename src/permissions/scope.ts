import type { Prisma } from '@/generated/prisma/client';
import type { AuthUser } from './types';

/**
 * Traduction de la portée géographique en filtre Prisma (D-036), appliquée à toutes les
 * requêtes du back-office. Même règle que `isReportInScope`.
 */
export function reportScopeWhere(user: AuthUser): Prisma.ReportWhereInput {
  switch (user.role) {
    case 'ADMIN':
      return {};
    case 'AGENT':
      return {
        OR: [
          { neighborhoodId: null },
          ...(user.communeId ? [{ neighborhood: { communeId: user.communeId } }] : []),
        ],
      };
    case 'DELEGATE':
      return { neighborhoodId: { in: user.neighborhoodIds } };
    default:
      // Un citoyen n'a pas accès au back-office : filtre qui ne renvoie rien.
      return { id: { in: [] } };
  }
}

/** Alertes visibles au back-office : au moins un quartier visé dans la portée (D-049). */
export function alertScopeWhere(user: AuthUser): Prisma.AlertWhereInput {
  switch (user.role) {
    case 'ADMIN':
      return {};
    case 'AGENT':
      return user.communeId
        ? { neighborhoods: { some: { neighborhood: { communeId: user.communeId } } } }
        : { id: { in: [] } };
    case 'DELEGATE':
      return { neighborhoods: { some: { neighborhoodId: { in: user.neighborhoodIds } } } };
    default:
      return { id: { in: [] } };
  }
}
