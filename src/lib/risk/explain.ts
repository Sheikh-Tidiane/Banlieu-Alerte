import { translate, type Locale } from '@/i18n';
import type { FactorKey, FactorResult, RiskLevelCode } from './types';

// Facteurs en langage simple (CDC §5.3 : « trois facteurs principaux en langage simple »).

const number = (value: number, digits = 1) =>
  new Intl.NumberFormat('fr-SN', { maximumFractionDigits: digits }).format(value);

function formatValue(key: FactorKey, value: number, locale: Locale): string {
  switch (key) {
    case 'rain24h':
    case 'rain6hMax':
    case 'saturation':
      return `${number(value)} mm`;
    case 'lowArea':
      return value < 0
        ? `${number(-value)} m ${translate('riskFactor.belowSurroundings', locale)}`
        : translate('riskFactor.notBelow', locale);
    case 'slope':
      return `${translate('riskFactor.slopeValue', locale)} ${number(value)} %`;
    case 'drainReports':
      return `${number(value, 0)} ${translate('riskFactor.reportPoints', locale)}`;
    case 'history':
      return number(value, 0);
  }
}

export function factorLabel(key: FactorKey, locale: Locale = 'fr'): string {
  return translate(`riskFactor.${key}`, locale);
}

/** « Pluie prévue sur la période : 35 mm » ; « donnée absente » si la valeur manque. */
export function describeFactor(factor: FactorResult, locale: Locale = 'fr'): string {
  const value =
    factor.value === null
      ? translate('riskFactor.missing', locale)
      : formatValue(factor.key, factor.value, locale);
  return `${factorLabel(factor.key, locale)} : ${value}`;
}

const LEVEL_KEY = {
  LOW: 'risk.low',
  MODERATE: 'risk.moderate',
  HIGH: 'risk.high',
  CRITICAL: 'risk.critical',
} as const;

export function levelLabel(level: RiskLevelCode | null, locale: Locale = 'fr'): string {
  return translate(level ? LEVEL_KEY[level] : 'risk.limitedData', locale);
}

/** Niveau du badge d'interface (`RiskBadge`). */
export function badgeLevel(level: RiskLevelCode | null) {
  return level
    ? ({ LOW: 'low', MODERATE: 'moderate', HIGH: 'high', CRITICAL: 'critical' } as const)[level]
    : ('limitedData' as const);
}
