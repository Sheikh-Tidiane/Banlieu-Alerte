import type { RiskLevelCode } from '@/lib/risk/types';

// Motifs des niveaux de risque sur la carte (DESIGN §2.4) : couleur ET motif, pour rester
// lisible sans distinguer les couleurs. Couleurs lues dans les tokens de globals.css.

const COLOR: Record<RiskLevelCode, string> = {
  LOW: 'var(--safety-green)',
  MODERATE: 'var(--brand-yellow)',
  HIGH: 'var(--vigilance-orange)',
  CRITICAL: 'var(--alert-red)',
};

export const hatchId = (level: RiskLevelCode, prefix = 'ba-hatch') =>
  `${prefix}-${level.toLowerCase()}`;

/** Définition SVG d'un motif : faible = points, modéré = rayures, élevé = croisillons, critique = croisillons serrés. */
export function hatchPattern(level: RiskLevelCode, prefix = 'ba-hatch'): string {
  const color = COLOR[level];
  const size = level === 'CRITICAL' ? 6 : 8;
  const background = `<rect width="${size}" height="${size}" style="fill:${color};fill-opacity:${level === 'LOW' ? 0.2 : 0.3}"/>`;
  const stroke = `style="stroke:${color};stroke-width:${level === 'CRITICAL' ? 2 : 1.5}"`;
  const marks: Record<RiskLevelCode, string> = {
    LOW: `<circle cx="${size / 2}" cy="${size / 2}" r="1.3" style="fill:${color}"/>`,
    MODERATE: `<path d="M0,${size} L${size},0" ${stroke}/>`,
    HIGH: `<path d="M0,${size} L${size},0 M0,0 L${size},${size}" ${stroke}/>`,
    CRITICAL: `<path d="M0,${size} L${size},0 M0,0 L${size},${size}" ${stroke}/>`,
  };
  return `<pattern id="${hatchId(level, prefix)}" patternUnits="userSpaceOnUse" width="${size}" height="${size}">${background}${marks[level]}</pattern>`;
}

export const RISK_COLOR = COLOR;
