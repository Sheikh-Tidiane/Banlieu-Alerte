import { describe, expect, it } from 'vitest';
import { escalationDue, ruleFor, DEFAULT_ESCALATION_RULES } from '@/lib/escalation/rules';
import {
  computeMetrics,
  modelPredictsFlood,
  QUALITY_THRESHOLD,
  thresholdReached,
  wilson,
} from '@/lib/risk/evaluation';
import { DEFAULT_RULE_PARAMS } from '@/lib/risk/rules';
import { computeRisk } from '@/lib/risk/score';

describe('seuil de la qualité de l’indice (D-054)', () => {
  it('rien n’est affiché sous le seuil, fixé avant tout résultat', () => {
    expect(QUALITY_THRESHOLD).toEqual({ episodes: 5, labels: 30, flooded: 5 });
    expect(thresholdReached({ episodes: 0, labels: 0, flooded: 0 })).toBe(false);
    expect(thresholdReached({ episodes: 5, labels: 30, flooded: 4 })).toBe(false);
    expect(thresholdReached({ episodes: 4, labels: 60, flooded: 10 })).toBe(false);
    expect(thresholdReached({ episodes: 5, labels: 30, flooded: 5 })).toBe(true);
  });
});

describe('métriques et intervalle de Wilson', () => {
  it('intervalle de Wilson : valeurs de référence', () => {
    expect(wilson(0, 0)).toBeNull();
    const half = wilson(5, 10)!;
    expect(half.value).toBe(0.5);
    expect(half.low).toBeCloseTo(0.237, 2);
    expect(half.high).toBeCloseTo(0.763, 2);
    const none = wilson(0, 10)!;
    expect(none.low).toBe(0);
    expect(none.high).toBeGreaterThan(0.2);
  });

  it('précision, rappel et taux de fausses alertes sur un jeu synthétique', () => {
    const samples = [
      ...Array(6).fill({ flooded: true, predicted: true }),
      ...Array(2).fill({ flooded: false, predicted: true }),
      ...Array(4).fill({ flooded: true, predicted: false }),
      ...Array(18).fill({ flooded: false, predicted: false }),
    ];
    const m = computeMetrics(samples);
    expect([m.truePositives, m.falsePositives, m.falseNegatives, m.trueNegatives]).toEqual([
      6, 2, 4, 18,
    ]);
    expect(m.precision?.value).toBe(0.75);
    expect(m.recall?.value).toBe(0.6);
    expect(m.falseAlarmRatio?.value).toBe(0.25);
  });
});

describe('modèles comparés M0, M1, M2 (CDC §6)', () => {
  const params = DEFAULT_RULE_PARAMS;
  // Pluie modérée sur une cuvette avec caniveaux bouchés.
  const factors = computeRisk(
    {
      rain24h: 12,
      rain6hMax: 6,
      saturation: 6,
      lowArea: -2,
      slope: 0.3,
      drainReports: 7,
      history: null,
    },
    params,
  ).factors;

  it('le relief et les signalements peuvent changer la prévision', () => {
    // M0 : (20 + 10 + 3,3) / 55 ≈ 61 → Élevé ; M1 et M2 aussi, avec plus de facteurs.
    expect(modelPredictsFlood(factors, params, 'M0')).toBe(true);
    const flatDry = computeRisk(
      {
        rain24h: 2,
        rain6hMax: 2,
        saturation: 0,
        lowArea: -2,
        slope: 0.3,
        drainReports: 7,
        history: null,
      },
      params,
    ).factors;
    expect(modelPredictsFlood(flatDry, params, 'M0')).toBe(false);
    expect(modelPredictsFlood(flatDry, params, 'M2')).toBe(true);
  });

  it('par temps sec, aucun modèle ne prévoit d’inondation (plafond D-052)', () => {
    const dry = computeRisk(
      {
        rain24h: 0,
        rain6hMax: 0,
        saturation: 0,
        lowArea: -3,
        slope: 0.1,
        drainReports: 9,
        history: null,
      },
      params,
    ).factors;
    for (const model of ['M0', 'M1', 'M2'] as const) {
      expect(modelPredictsFlood(dry, params, model)).toBe(false);
    }
  });
});

describe('escalade (D-056, EXG-36)', () => {
  const rules = DEFAULT_ESCALATION_RULES;
  const created = new Date('2026-11-05T00:00:00Z');
  const at = (hours: number) => new Date(created.getTime() + hours * 3_600_000);

  it('règle la plus précise', () => {
    expect(ruleFor(rules, 'FLOODING', 'HIGH')?.targetHours).toBe(6);
    expect(ruleFor(rules, 'ROAD_CUT', 'LOW')?.targetHours).toBe(6);
    expect(ruleFor(rules, 'FLOODING', 'LOW')?.targetHours).toBe(24);
    expect(ruleFor(rules, 'WASTE_DUMP', 'HIGH')?.targetHours).toBe(24);
    expect(ruleFor(rules, 'BLOCKED_DRAIN', 'MEDIUM')?.targetHours).toBe(72);
  });

  it('rien avant le délai ; agent après ; administrateur après deux fois le délai ; une seule fois', () => {
    const report = { status: 'NEW', createdAt: created, escalationLevel: 0 };
    expect(escalationDue(report, 6, at(5.9))).toBeNull();
    expect(escalationDue(report, 6, at(6))).toBe(1);
    expect(escalationDue({ ...report, escalationLevel: 1 }, 6, at(7))).toBeNull();
    expect(escalationDue({ ...report, escalationLevel: 1 }, 6, at(12))).toBe(2);
    expect(escalationDue({ ...report, escalationLevel: 2 }, 6, at(100))).toBeNull();
    expect(escalationDue({ ...report, status: 'VERIFIED' }, 6, at(100))).toBeNull();
  });
});

describe('statistiques publiques (CDC §4.1-10)', () => {
  const base = { neighborhood: 'Quartier A', status: 'NEW', resolvedAt: null, isDemo: false };
  const at = (day: number) => new Date(Date.UTC(2026, 10, day));

  it('moins de 5 signalements : « données insuffisantes », aucun taux calculé', async () => {
    const { aggregateStats } = await import('@/lib/stats/aggregate');
    const rows = aggregateStats([
      { ...base, createdAt: at(1) },
      { ...base, createdAt: at(2) },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ total: 2, insufficient: true, resolutionRate: null });
  });

  it('taux de résolution et délai moyen par quartier et par mois', async () => {
    const { aggregateStats } = await import('@/lib/stats/aggregate');
    const reports = [
      ...Array.from({ length: 3 }, (_, i) => ({ ...base, createdAt: at(1 + i) })),
      {
        ...base,
        createdAt: at(5),
        status: 'RESOLVED',
        resolvedAt: new Date(at(5).getTime() + 10 * 3_600_000),
      },
      {
        ...base,
        createdAt: at(6),
        status: 'RESOLVED',
        resolvedAt: new Date(at(6).getTime() + 30 * 3_600_000),
      },
      { ...base, neighborhood: 'Quartier B', createdAt: at(7), isDemo: true },
    ];
    const rows = aggregateStats(reports);
    const a = rows.find((r) => r.neighborhood === 'Quartier A')!;
    expect(a).toMatchObject({
      month: '2026-11',
      total: 5,
      resolutionRate: 0.4,
      averageResolutionHours: 20,
    });
    expect(rows.find((r) => r.neighborhood === 'Quartier B')?.onlyDemo).toBe(true);
  });
});

describe('priorité de curage (D-058)', () => {
  it('indice × gravité ; les signalements sans indice viennent après, par gravité', async () => {
    const { sortByPriority, cleanupPriority } = await import('@/lib/cleanup/priority');
    const d = new Date('2026-11-05T00:00:00Z');
    const items = [
      { id: 'a', severity: 'HIGH' as const, riskScore: 20, createdAt: d },
      { id: 'b', severity: 'LOW' as const, riskScore: 80, createdAt: d },
      { id: 'c', severity: 'HIGH' as const, riskScore: null, createdAt: d },
      { id: 'd', severity: 'MEDIUM' as const, riskScore: 50, createdAt: d },
      { id: 'e', severity: 'LOW' as const, riskScore: null, createdAt: d },
    ];
    expect(sortByPriority(items).map((i) => i.id)).toEqual(['d', 'b', 'a', 'c', 'e']);
    expect(cleanupPriority(items[3]!)).toBe(100);
    expect(cleanupPriority(items[2]!)).toBeNull();
  });
});
