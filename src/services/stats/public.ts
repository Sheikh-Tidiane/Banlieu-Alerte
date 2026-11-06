import { getPrisma } from '@/lib/db';
import { aggregateStats, MIN_REPORTS_PER_ROW } from '@/lib/stats/aggregate';

// Statistiques publiques (CDC §4.1-10) : 12 derniers mois, sans rejetés ni doublons fusionnés,
// aucune donnée personnelle. Les chiffres reposant sur la démonstration sont signalés.

export async function getPublicStatistics(now = new Date()) {
  const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
  const reports = await getPrisma().report.findMany({
    where: { createdAt: { gte: since }, status: { not: 'REJECTED' }, duplicateOfId: null },
    select: {
      createdAt: true,
      status: true,
      resolvedAt: true,
      isDemo: true,
      neighborhood: { select: { name: true } },
    },
  });
  const rows = aggregateStats(
    reports.map((r) => ({
      neighborhood: r.neighborhood?.name ?? null,
      createdAt: r.createdAt,
      status: r.status,
      resolvedAt: r.resolvedAt,
      isDemo: r.isDemo,
    })),
  );
  return {
    since: since.toISOString(),
    minReportsPerRow: MIN_REPORTS_PER_ROW,
    total: reports.length,
    onlyDemo: reports.length > 0 && reports.every((r) => r.isDemo),
    rows,
  };
}
