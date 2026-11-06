// Escalade des signalements sans première réponse (D-056, EXG-36). Code pur.

export type ReportTypeCode = 'FLOODING' | 'BLOCKED_DRAIN' | 'WASTE_DUMP' | 'ROAD_CUT' | 'OTHER';
export type SeverityCode = 'LOW' | 'MEDIUM' | 'HIGH';

export type EscalationRuleInput = {
  type: ReportTypeCode | null;
  severity: SeverityCode | null;
  targetHours: number;
};

/** Délais de l'équipe : 6 h, 24 h, 72 h (choix du plan de la Phase 5). */
export const DEFAULT_ESCALATION_RULES: (EscalationRuleInput & { scope: string })[] = [
  { scope: 'FLOODING:HIGH', type: 'FLOODING', severity: 'HIGH', targetHours: 6 },
  { scope: 'ROAD_CUT:*', type: 'ROAD_CUT', severity: null, targetHours: 6 },
  { scope: 'FLOODING:*', type: 'FLOODING', severity: null, targetHours: 24 },
  { scope: '*:HIGH', type: null, severity: 'HIGH', targetHours: 24 },
  { scope: '*:*', type: null, severity: null, targetHours: 72 },
];

export const scopeOf = (type: ReportTypeCode | null, severity: SeverityCode | null) =>
  `${type ?? '*'}:${severity ?? '*'}`;

/** Règle la plus précise : type et gravité, puis type, puis gravité, puis règle générale. */
export function ruleFor<T extends EscalationRuleInput>(
  rules: T[],
  type: ReportTypeCode,
  severity: SeverityCode,
): T | null {
  const find = (t: ReportTypeCode | null, s: SeverityCode | null) =>
    rules.find((r) => r.type === t && r.severity === s) ?? null;
  return find(type, severity) ?? find(type, null) ?? find(null, severity) ?? find(null, null);
}

/** Échelons : 1 = agent, 2 = administrateur (au-delà de deux fois le délai). */
export const MAX_ESCALATION_LEVEL = 2;

/**
 * Échelon à atteindre pour un signalement resté « Nouveau », ou null s'il n'y a rien à faire.
 * Un échelon déjà atteint n'est jamais rejoué (une seule escalade par échelon).
 */
export function escalationDue(
  report: { status: string; createdAt: Date; escalationLevel: number },
  targetHours: number,
  now: Date,
): number | null {
  if (report.status !== 'NEW') return null;
  const elapsedHours = (now.getTime() - report.createdAt.getTime()) / 3_600_000;
  const level = Math.min(MAX_ESCALATION_LEVEL, Math.floor(elapsedHours / targetHours));
  return level > report.escalationLevel ? level : null;
}
