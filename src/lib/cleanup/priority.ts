// Priorité de curage (CDC §4.7, D-058) : indice de risque à 48 h de la case × gravité.

export const SEVERITY_WEIGHT = { LOW: 1, MEDIUM: 2, HIGH: 3 } as const;
export type SeverityCode = keyof typeof SEVERITY_WEIGHT;

export type PriorityInput = {
  severity: SeverityCode;
  /** Indice à 48 h de la case du signalement ; null si indisponible. */
  riskScore: number | null;
  createdAt: Date;
};

export function cleanupPriority(item: PriorityInput): number | null {
  return item.riskScore === null ? null : item.riskScore * SEVERITY_WEIGHT[item.severity];
}

/**
 * Tri : d'abord les signalements dont l'indice est connu, par priorité décroissante ; ensuite
 * ceux sans indice (signalés « indice indisponible »), par gravité. À égalité, le plus ancien.
 */
export function sortByPriority<T extends PriorityInput>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const pa = cleanupPriority(a);
    const pb = cleanupPriority(b);
    if (pa !== null && pb === null) return -1;
    if (pa === null && pb !== null) return 1;
    const byValue =
      pa !== null && pb !== null
        ? pb - pa
        : SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity];
    return byValue || a.createdAt.getTime() - b.createdAt.getTime();
  });
}
