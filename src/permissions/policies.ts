import type { ReportStatus } from '@/validators/report';
import type { AuthUser, Role, ScopedReport } from './types';

// Politiques d'accès (D-036) : fonctions pures, testées sans base. Toute route sensible
// passe par elles ; l'interface ne fait que refléter leurs décisions.

export const STAFF_ROLES: readonly Role[] = ['DELEGATE', 'AGENT', 'ADMIN'];

export function isStaff(user: AuthUser | null): user is AuthUser {
  return Boolean(user && STAFF_ROLES.includes(user.role));
}

/**
 * Portée géographique (CDC §3) : délégué = ses quartiers ; agent = sa commune, plus les
 * signalements « quartier non identifié » qu'il doit rattacher ; administrateur = tout.
 */
export function isReportInScope(user: AuthUser, report: ScopedReport): boolean {
  switch (user.role) {
    case 'ADMIN':
      return true;
    case 'AGENT':
      return report.neighborhoodId === null || report.neighborhood?.communeId === user.communeId;
    case 'DELEGATE':
      return report.neighborhoodId !== null && user.neighborhoodIds.includes(report.neighborhoodId);
    default:
      return false;
  }
}

/** Graphe des transitions de statut (D-037). */
export const STATUS_TRANSITIONS: Record<ReportStatus, readonly ReportStatus[]> = {
  NEW: ['VERIFIED', 'REJECTED'],
  VERIFIED: ['ASSIGNED', 'IN_PROGRESS', 'REJECTED'],
  ASSIGNED: ['IN_PROGRESS', 'RESOLVED', 'REJECTED'],
  IN_PROGRESS: ['ASSIGNED', 'RESOLVED', 'REJECTED'],
  RESOLVED: ['IN_PROGRESS'],
  REJECTED: ['NEW'],
};

/** Un délégué vérifie ou écarte ; le traitement revient aux agents et administrateurs. */
const DELEGATE_TRANSITIONS: readonly `${ReportStatus}>${ReportStatus}`[] = [
  'NEW>VERIFIED',
  'NEW>REJECTED',
  'VERIFIED>REJECTED',
];

export function allowedTransitions(user: AuthUser, report: ScopedReport): ReportStatus[] {
  if (!isStaff(user) || !isReportInScope(user, report)) return [];
  const next = STATUS_TRANSITIONS[report.status];
  if (user.role === 'DELEGATE') {
    return next.filter((to) => DELEGATE_TRANSITIONS.includes(`${report.status}>${to}`));
  }
  return [...next];
}

export function canChangeStatus(user: AuthUser, report: ScopedReport, to: ReportStatus): boolean {
  return allowedTransitions(user, report).includes(to);
}

export function canAssign(user: AuthUser, report: ScopedReport): boolean {
  return (
    (user.role === 'AGENT' || user.role === 'ADMIN') &&
    isReportInScope(user, report) &&
    !['RESOLVED', 'REJECTED'].includes(report.status)
  );
}

export function canAddNote(user: AuthUser, report: ScopedReport): boolean {
  return isStaff(user) && isReportInScope(user, report);
}

export function canMerge(user: AuthUser, duplicate: ScopedReport, primary: ScopedReport): boolean {
  return (
    (user.role === 'AGENT' || user.role === 'ADMIN') &&
    isReportInScope(user, duplicate) &&
    isReportInScope(user, primary)
  );
}

/** Modération des commentaires et des abus d'un signalement de sa portée. */
export function canModerate(user: AuthUser, report: ScopedReport): boolean {
  return isStaff(user) && isReportInScope(user, report);
}

export const canBlockUsers = (user: AuthUser) => user.role === 'ADMIN';
export const canInvite = (user: AuthUser) => user.role === 'ADMIN';
export const canManageZones = (user: AuthUser) => user.role === 'ADMIN';
export const canViewAudit = (user: AuthUser) => user.role === 'ADMIN';

// --- Indice et alertes (Phase 4, D-049) ----------------------------------------------

export const canManageRules = (user: AuthUser) => user.role === 'ADMIN';

export type AlertTarget = { id: string; communeId: string };

/** Tous les quartiers visés sont dans la portée de l'utilisateur. */
export function areTargetsInScope(user: AuthUser, targets: AlertTarget[]): boolean {
  if (targets.length === 0) return false;
  switch (user.role) {
    case 'ADMIN':
      return true;
    case 'AGENT':
      return targets.every((t) => t.communeId === user.communeId);
    case 'DELEGATE':
      return targets.every((t) => user.neighborhoodIds.includes(t.id));
    default:
      return false;
  }
}

/**
 * Officielle : agent de la commune ou administrateur. Indicative : délégué de ses quartiers,
 * agent ou administrateur. Même règle pour créer, modifier, approuver et annuler.
 */
export function canIssueAlert(
  user: AuthUser,
  type: 'OFFICIAL' | 'INDICATIVE',
  targets: AlertTarget[],
): boolean {
  if (!isStaff(user)) return false;
  if (type === 'OFFICIAL' && user.role === 'DELEGATE') return false;
  return areTargetsInScope(user, targets);
}

/** Lecture au back-office : au moins un quartier visé dans la portée. */
export function canViewAlert(user: AuthUser, targets: AlertTarget[]): boolean {
  if (!isStaff(user)) return false;
  return targets.some((t) => areTargetsInScope(user, [t]));
}
