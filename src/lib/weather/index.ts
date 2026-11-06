import { OpenMeteoProvider } from './open-meteo';
import type { WeatherProvider } from './types';

export type * from './types';

/**
 * Fournisseur de production : Open-Meteo. Les fournisseurs injectés (tests, simulateur de
 * démonstration de la Phase 6) sont passés explicitement aux services, jamais par défaut.
 */
export function createWeatherProvider(): WeatherProvider {
  return new OpenMeteoProvider();
}
