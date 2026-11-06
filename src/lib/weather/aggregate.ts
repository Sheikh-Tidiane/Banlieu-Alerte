import type { Horizon } from '@/lib/risk/types';
import type { HourlyRain } from './types';

// Agrégation de la pluie horaire par horizon (D-047). Une heure manquante dans une fenêtre
// rend la valeur absente : on n'invente jamais de pluie (CDC §5.5).

const HOUR_MS = 3_600_000;

export type RainInputs = {
  /** Cumul sur la fenêtre de l'horizon (mm). */
  rainWindow: number | null;
  /** Plus fort cumul sur 6 h consécutives dans la fenêtre (mm). */
  rain6hMax: number | null;
  /** Pluie des 72 h précédant la fenêtre (mm). */
  saturation: number | null;
};

/** Début de l'heure UTC contenant `at`. */
export function floorToHour(at: Date): number {
  return Math.floor(at.getTime() / HOUR_MS) * HOUR_MS;
}

function indexByHour(hourly: HourlyRain): Map<number, number | null> {
  const index = new Map<number, number | null>();
  hourly.times.forEach((time, i) => {
    // Open-Meteo renvoie « 2026-11-04T10:00 » en UTC (timezone=UTC), sans suffixe.
    const ms = Date.parse(time.endsWith('Z') ? time : `${time}Z`);
    if (Number.isFinite(ms)) index.set(ms, hourly.precipitationMm[i] ?? null);
  });
  return index;
}

/** Valeurs horaires de [start, start + hours[ ; null si une heure manque. */
function series(index: Map<number, number | null>, start: number, hours: number): number[] | null {
  const values: number[] = [];
  for (let h = 0; h < hours; h++) {
    const value = index.get(start + h * HOUR_MS);
    if (value === undefined || value === null || !Number.isFinite(value)) return null;
    values.push(Math.max(0, value));
  }
  return values;
}

const sum = (values: number[]) => Math.round(values.reduce((a, b) => a + b, 0) * 10) / 10;

function max6h(values: number[]): number {
  let best = 0;
  for (let i = 0; i + 6 <= values.length; i++) best = Math.max(best, sum(values.slice(i, i + 6)));
  return best;
}

/**
 * Horizon 24 h : fenêtre [maintenant, +24 h[ ; saturation = 72 h passées.
 * Horizon 48 h : fenêtre [+24 h, +48 h[ (« demain ») ; saturation = 72 h passées + 24 h prévues.
 */
export function rainInputs(hourly: HourlyRain, at: Date, horizon: Horizon): RainInputs {
  const index = indexByHour(hourly);
  const now = floorToHour(at);
  const windowStart = horizon === 24 ? now : now + 24 * HOUR_MS;
  const window = series(index, windowStart, 24);
  const past = series(index, now - 72 * HOUR_MS, 72);
  const between = horizon === 48 ? series(index, now, 24) : [];

  return {
    rainWindow: window ? sum(window) : null,
    rain6hMax: window ? max6h(window) : null,
    saturation: past && between ? sum([...past, ...between]) : null,
  };
}

/** Pluie prévue par tranches de 6 h sur 48 h, pour l'affichage (null si absente). */
export function rainOutlook(hourly: HourlyRain, at: Date): { start: string; mm: number | null }[] {
  const index = indexByHour(hourly);
  const now = floorToHour(at);
  return Array.from({ length: 8 }, (_, i) => {
    const start = now + i * 6 * HOUR_MS;
    const values = series(index, start, 6);
    return { start: new Date(start).toISOString(), mm: values ? sum(values) : null };
  });
}
