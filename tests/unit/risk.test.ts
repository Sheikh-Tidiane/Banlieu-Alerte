import { describe, expect, it } from 'vitest';
import { buildGrid, computeTerrain, boundsAround } from '@/lib/geo/cells';
import { cellInputs, drainPressure, type CellForRisk } from '@/lib/risk/inputs';
import { DEFAULT_RULE_PARAMS } from '@/lib/risk/rules';
import { compareLevels, computeRisk, factorTier, levelFor, mostExposed } from '@/lib/risk/score';
import type { FactorInputs } from '@/lib/risk/types';
import { rainInputs, rainOutlook } from '@/lib/weather/aggregate';
import { FixtureWeatherProvider } from '@/lib/weather/open-meteo';
import { ruleParamsSchema } from '@/validators/risk';

const params = DEFAULT_RULE_PARAMS;
const dry: FactorInputs = {
  rain24h: 0,
  rain6hMax: 0,
  saturation: 0,
  lowArea: 0.5,
  slope: 3,
  drainReports: 0,
  history: null,
};

describe('grille v1 (D-046)', () => {
  it('est valide et totalise 100 points', () => {
    expect(ruleParamsSchema.safeParse(params).success).toBe(true);
    const total = Object.values(params.factors).reduce((s, f) => s + f.maxPoints, 0);
    expect(total).toBe(100);
  });

  it('refuse une grille qui ne totalise pas 100 ou dont les paliers sont désordonnés', () => {
    const wrongTotal = structuredClone(params);
    wrongTotal.factors.rain24h.maxPoints = 40;
    expect(ruleParamsSchema.safeParse(wrongTotal).success).toBe(false);
    const wrongOrder = structuredClone(params);
    wrongOrder.factors.slope.thresholds = [0.5, 1, 2];
    expect(ruleParamsSchema.safeParse(wrongOrder).success).toBe(false);
    const wrongLevels = structuredClone(params);
    wrongLevels.levels = { moderate: 50, high: 25, critical: 75 };
    expect(ruleParamsSchema.safeParse(wrongLevels).success).toBe(false);
  });
});

describe('paliers des facteurs (CDC §5.3)', () => {
  it('pluie : bornes incluses vers le haut', () => {
    const rule = params.factors.rain24h;
    expect(factorTier(0.9, rule)).toBe(0);
    expect(factorTier(1, rule)).toBe(1);
    expect(factorTier(9.9, rule)).toBe(1);
    expect(factorTier(10, rule)).toBe(2);
    expect(factorTier(30, rule)).toBe(3);
    expect(factorTier(120, rule)).toBe(3);
  });

  it('zone basse et pente : plus la valeur est basse, plus le palier est haut', () => {
    expect(factorTier(0.2, params.factors.lowArea)).toBe(0);
    expect(factorTier(-0.1, params.factors.lowArea)).toBe(1);
    expect(factorTier(-1, params.factors.lowArea)).toBe(2);
    expect(factorTier(-2, params.factors.lowArea)).toBe(3);
    expect(factorTier(2, params.factors.slope)).toBe(0);
    expect(factorTier(0.3, params.factors.slope)).toBe(3);
  });

  it('chaque palier rapporte 0, un tiers, deux tiers ou tous les points', () => {
    const result = computeRisk({ ...dry, rain24h: 12 }, params);
    const rain = result.factors.find((f) => f.key === 'rain24h');
    expect(rain).toMatchObject({ tier: 2, points: 20, maxPoints: 30, missing: false });
  });
});

describe('score, niveaux et facteurs principaux', () => {
  it('temps sec sur terrain haut : score nul, niveau faible', () => {
    const result = computeRisk(dry, params);
    expect(result.score).toBe(0);
    expect(result.level).toBe('LOW');
    expect(result.topFactors).toEqual([]);
  });

  it('tout au maximum : 95 points sans historique (absent en v1)', () => {
    const result = computeRisk(
      {
        rain24h: 80,
        rain6hMax: 40,
        saturation: 60,
        lowArea: -3,
        slope: 0.1,
        drainReports: 9,
        history: null,
      },
      params,
    );
    expect(result.score).toBe(95);
    expect(result.level).toBe('CRITICAL');
    expect(result.missing).toEqual(['history']);
  });

  it('les trois facteurs principaux sont ceux qui rapportent le plus de points', () => {
    const result = computeRisk(
      { ...dry, rain24h: 35, lowArea: -2, drainReports: 4, saturation: 6 },
      params,
    );
    expect(result.topFactors).toEqual(['rain24h', 'lowArea', 'drainReports']);
  });

  it('niveaux : bornes basses incluses (25, 50, 75)', () => {
    expect(levelFor(24, params.levels)).toBe('LOW');
    expect(levelFor(25, params.levels)).toBe('MODERATE');
    expect(levelFor(50, params.levels)).toBe('HIGH');
    expect(levelFor(75, params.levels)).toBe('CRITICAL');
    expect(compareLevels('HIGH', 'MODERATE')).toBeGreaterThan(0);
  });

  it('sans prévision de pluie : « données limitées », aucun score inventé', () => {
    const result = computeRisk({ ...dry, rain24h: null, rain6hMax: null }, params);
    expect(result.score).toBeNull();
    expect(result.level).toBeNull();
    expect(result.missing).toEqual(['rain24h', 'rain6hMax', 'history']);
  });

  it('une donnée de relief absente compte 0 point et est signalée', () => {
    const result = computeRisk({ ...dry, lowArea: null, rain24h: 15 }, params);
    expect(result.score).toBe(20);
    expect(result.missing).toContain('lowArea');
  });

  it('un quartier prend la valeur de sa cellule la plus exposée', () => {
    const a = { id: 'a', result: computeRisk({ ...dry, rain24h: 15 }, params) };
    const b = { id: 'b', result: computeRisk({ ...dry, rain24h: 15, lowArea: -2 }, params) };
    const c = { id: 'c', result: computeRisk({ ...dry, rain24h: null }, params) };
    expect(mostExposed([a, b, c])?.id).toBe('b');
    expect(mostExposed([c])?.id).toBe('c');
  });
});

describe('pluie par horizon (D-047)', () => {
  const now = new Date('2026-11-04T10:20:00Z');
  const hourly = async (rainAt: (h: number) => number | null) =>
    (await new FixtureWeatherProvider(rainAt, () => now).fetchForecast({ lat: 0, lng: 0 })).hourly;

  it('24 h : cumul, pic sur 6 h et saturation des 72 h passées', async () => {
    const series = await hourly((h) => (h < 0 ? 1 : h < 6 ? 5 : 0));
    expect(rainInputs(series, now, 24)).toEqual({ rainWindow: 30, rain6hMax: 30, saturation: 72 });
  });

  it('48 h : fenêtre de demain, la pluie des prochaines 24 h compte dans la saturation', async () => {
    const series = await hourly((h) => (h >= 0 && h < 24 ? 1 : h >= 24 && h < 48 ? 2 : 0));
    expect(rainInputs(series, now, 48)).toEqual({ rainWindow: 48, rain6hMax: 12, saturation: 24 });
  });

  it('une heure manquante rend la valeur absente', async () => {
    const series = await hourly((h) => (h === 3 ? null : 0));
    expect(rainInputs(series, now, 24)).toEqual({
      rainWindow: null,
      rain6hMax: null,
      saturation: 0,
    });
  });

  it('relevé trop ancien : la fenêtre n’est plus couverte, donc absente', async () => {
    const series = await hourly(() => 0);
    const later = new Date(now.getTime() + 60 * 3_600_000);
    expect(rainInputs(series, later, 48).rainWindow).toBeNull();
  });

  it('prévision par tranches de 6 h sur 48 h', async () => {
    const outlook = rainOutlook(await hourly((h) => (h >= 0 && h < 6 ? 2 : 0)), now);
    expect(outlook).toHaveLength(8);
    expect(outlook[0]).toEqual({ start: '2026-11-04T10:00:00.000Z', mm: 12 });
    expect(outlook[1]?.mm).toBe(0);
  });
});

describe('cellules et signalements (D-044)', () => {
  const grid = buildGrid(boundsAround([{ lat: 14.75, lng: -17.38 }], 300), 250);

  it('construit une grille régulière autour des repères', () => {
    expect(grid.length).toBeGreaterThanOrEqual(9);
    expect(new Set(grid.map((c) => `${c.row}:${c.col}`)).size).toBe(grid.length);
  });

  it('altitude relative et pente ; altitude absente gardée absente', () => {
    const terrain = computeTerrain(
      grid.map((c) => ({ ...c, elevationMeters: c.row === 1 && c.col === 1 ? 2 : 4 })),
    );
    const center = terrain.find((c) => c.row === 1 && c.col === 1);
    expect(center?.relativeElevation).toBe(-2);
    expect(center?.slopePercent).toBeGreaterThan(0);
    const missing = computeTerrain(grid.map((c) => ({ ...c, elevationMeters: null })));
    expect(missing.every((c) => c.relativeElevation === null && c.slopePercent === null)).toBe(
      true,
    );
  });

  it('les signalements de caniveaux comptent dans la cellule et ses voisines', () => {
    const cells: CellForRisk[] = grid.map((c) => ({
      ...c,
      id: `${c.row}:${c.col}`,
      sizeMeters: 250,
      relativeElevation: 0,
      slopePercent: 1,
    }));
    const target = cells.find((c) => c.row === 1 && c.col === 1)!;
    const far = cells.find((c) => c.row === grid.at(-1)!.row && c.col === grid.at(-1)!.col)!;
    const pressure = drainPressure(cells, [
      { lat: target.lat, lng: target.lng, severity: 'HIGH' },
      { lat: target.lat, lng: target.lng, severity: 'LOW' },
      { lat: 10, lng: 10, severity: 'HIGH' }, // hors grille : ignoré
    ]);
    expect(pressure.get(target.id)).toBe(4);
    expect(pressure.get('0:0')).toBe(4);
    if (Math.abs(far.row - 1) > 1 || Math.abs(far.col - 1) > 1) {
      expect(pressure.get(far.id)).toBe(0);
    }
    expect(
      cellInputs(target, { rainWindow: 1, rain6hMax: 1, saturation: 0 }, 4).history,
    ).toBeNull();
  });
});

describe('plafond sans pluie (D-052)', () => {
  const terrain = { ...dry, lowArea: -3, slope: 0.1, drainReports: 9 };

  it('sans pluie prévue, le terrain et les caniveaux seuls restent « Faible »', () => {
    const result = computeRisk(terrain, params);
    expect(result.score).toBe(24);
    expect(result.level).toBe('LOW');
    expect(result.cappedWithoutRain).toBe(true);
    expect(result.topFactors).toEqual(['lowArea', 'drainReports', 'slope']);
  });

  it('dès qu’une pluie est prévue, le plafond ne s’applique plus', () => {
    const result = computeRisk({ ...terrain, rain24h: 2, rain6hMax: 2 }, params);
    expect(result.score).toBe(55);
    expect(result.cappedWithoutRain).toBe(false);
  });

  it('sol saturé par les pluies passées : pas de plafond, même sans pluie prévue', () => {
    const result = computeRisk({ ...terrain, saturation: 60 }, params);
    expect(result.cappedWithoutRain).toBe(false);
    expect(result.score).toBe(50);
    expect(result.level).toBe('HIGH');
  });

  it('plafond désactivable dans la grille', () => {
    const result = computeRisk(terrain, { ...params, noRainMaxScore: null });
    expect(result.score).toBe(40);
    expect(result.level).toBe('MODERATE');
  });
});
