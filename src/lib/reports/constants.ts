// Constantes des signalements, sans dépendance : importables par les composants client sans
// embarquer la bibliothèque de validation (performance, Phase 6). Réexportées par
// src/validators/report.ts.

export const REPORT_TYPES = [
  'FLOODING',
  'BLOCKED_DRAIN',
  'WASTE_DUMP',
  'ROAD_CUT',
  'OTHER',
] as const;
export const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH'] as const;
export const REPORT_STATUSES = [
  'NEW',
  'VERIFIED',
  'ASSIGNED',
  'IN_PROGRESS',
  'RESOLVED',
  'REJECTED',
] as const;

export type ReportType = (typeof REPORT_TYPES)[number];
export type Severity = (typeof SEVERITIES)[number];
export type ReportStatus = (typeof REPORT_STATUSES)[number];

/** Rayons d'abonnement proposés (mètres). */
export const RADIUS_OPTIONS = [500, 1000, 2000, 3000] as const;
