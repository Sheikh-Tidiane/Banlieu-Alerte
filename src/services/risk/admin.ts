import { getPrisma } from '@/lib/db';
import { describeFactor } from '@/lib/risk/explain';
import type { FactorKey, FactorResult } from '@/lib/risk/types';
import { listRuleVersions } from './rules';

// Données de la page « Indice de risque » du back-office : dernier calcul, cellules les plus
// exposées, erreurs météo récentes et versions de la grille.

export async function getRiskAdminData() {
  const prisma = getPrisma();
  const run = await prisma.riskRun.findFirst({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      createdAt: true,
      trigger: true,
      weatherStale: true,
      draftsCreated: true,
      cellCount: true,
      isDemo: true,
      ruleVersion: { select: { number: true, name: true } },
      weatherSnapshot: { select: { fetchedAt: true, source: true, isDemo: true } },
    },
  });

  const topCells = run
    ? await prisma.riskPrediction.findMany({
        where: { runId: run.id, scope: 'CELL', horizonHours: 24 },
        orderBy: [{ score: 'desc' }],
        take: 10,
        select: {
          id: true,
          score: true,
          level: true,
          factors: true,
          cell: { select: { id: true, row: true, col: true } },
          neighborhood: { select: { name: true } },
        },
      })
    : [];

  const weatherErrors = await prisma.errorLog.findMany({
    where: { source: 'weather' },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { id: true, message: true, createdAt: true },
  });

  return {
    run,
    topCells: topCells.map((row) => {
      const stored = row.factors as { factors: FactorResult[]; topFactors: FactorKey[] };
      return {
        id: row.id,
        cellId: row.cell?.id ?? null,
        label: row.cell ? `${row.cell.row}:${row.cell.col}` : '–',
        neighborhood: row.neighborhood?.name ?? null,
        score: row.score,
        level: row.level,
        factors: stored.factors.map((f) => ({
          key: f.key,
          text: describeFactor(f),
          points: Math.round(f.points * 10) / 10,
          maxPoints: f.maxPoints,
        })),
      };
    }),
    weatherErrors,
    versions: await listRuleVersions(),
  };
}
