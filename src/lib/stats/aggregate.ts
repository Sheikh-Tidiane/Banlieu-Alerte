// Statistiques publiques par quartier et par mois (CDC §4.1-10). Code pur.
// Seules des données réelles sont agrégées ; une ligne trop petite est « données insuffisantes ».

export const MIN_REPORTS_PER_ROW = 5;

export type StatInput = {
  neighborhood: string | null;
  createdAt: Date;
  status: string;
  resolvedAt: Date | null;
  isDemo: boolean;
};

export type StatRow = {
  neighborhood: string | null;
  /** Mois « AAAA-MM » (heure de Dakar = UTC). */
  month: string;
  total: number;
  /** Null si la ligne compte moins de MIN_REPORTS_PER_ROW signalements. */
  resolutionRate: number | null;
  /** Délai moyen de résolution en heures, sur les signalements résolus ; null si insuffisant. */
  averageResolutionHours: number | null;
  insufficient: boolean;
  /** Vrai si toutes les lignes agrégées sont des données de démonstration. */
  onlyDemo: boolean;
};

const monthOf = (date: Date) => date.toISOString().slice(0, 7);

export function aggregateStats(reports: StatInput[]): StatRow[] {
  const groups = new Map<string, StatInput[]>();
  for (const report of reports) {
    const key = `${report.neighborhood ?? ''}|${monthOf(report.createdAt)}`;
    const list = groups.get(key) ?? [];
    list.push(report);
    groups.set(key, list);
  }
  const rows: StatRow[] = [];
  for (const [key, list] of groups) {
    const [neighborhood, month] = key.split('|') as [string, string];
    const insufficient = list.length < MIN_REPORTS_PER_ROW;
    const resolved = list.filter((r) => r.status === 'RESOLVED' && r.resolvedAt);
    const durations = resolved.map(
      (r) => (r.resolvedAt!.getTime() - r.createdAt.getTime()) / 3_600_000,
    );
    rows.push({
      neighborhood: neighborhood || null,
      month,
      total: list.length,
      resolutionRate: insufficient ? null : Math.round((resolved.length / list.length) * 100) / 100,
      averageResolutionHours:
        insufficient || durations.length === 0
          ? null
          : Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10,
      insufficient,
      onlyDemo: list.every((r) => r.isDemo),
    });
  }
  return rows.sort(
    (a, b) =>
      b.month.localeCompare(a.month) ||
      (a.neighborhood ?? '~').localeCompare(b.neighborhood ?? '~', 'fr'),
  );
}
