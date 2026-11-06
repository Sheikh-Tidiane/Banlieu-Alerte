import type { ReportStatus } from '@/validators/report';

export type Role = 'CITIZEN' | 'DELEGATE' | 'AGENT' | 'ADMIN';

/** Utilisateur connecté, tel que vu par les politiques d'accès. */
export type AuthUser = {
  id: string;
  name: string;
  email: string | null;
  role: Role;
  /** Portée d'un agent : sa commune. */
  communeId: string | null;
  /** Portée d'un délégué : les quartiers dont il est responsable. */
  neighborhoodIds: string[];
  locale: string;
  /** Session de la requête (absente hors requête HTTP, par exemple dans les tests). */
  sessionId?: string;
  /** Second facteur configuré (administrateur, EXG-41). */
  mfaEnrolled?: boolean;
  /** Second facteur vérifié pour cette session. */
  mfaVerified?: boolean;
};

/** Ce dont les politiques ont besoin pour situer un signalement. */
export type ScopedReport = {
  status: ReportStatus;
  neighborhoodId: string | null;
  neighborhood: { communeId: string } | null;
  authorId?: string | null;
};
