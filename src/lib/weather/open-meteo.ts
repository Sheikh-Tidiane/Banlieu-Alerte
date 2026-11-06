import { z } from 'zod';
import type { HourlyRain, WeatherForecast, WeatherProvider } from './types';

// Client Open-Meteo (D-045) : API publique sans clé. Pluie horaire en UTC, 3 jours passés
// (saturation) et 3 jours de prévision (l'horizon 48 h dépasse parfois le 2e jour).

const ENDPOINT = 'https://api.open-meteo.com/v1/forecast';
const TIMEOUT_MS = 8_000;

const responseSchema = z.object({
  hourly: z.object({
    time: z.array(z.string()),
    precipitation: z.array(z.number().nullable()),
  }),
});

export class OpenMeteoProvider implements WeatherProvider {
  readonly name = 'Open-Meteo';

  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async fetchForecast(point: { lat: number; lng: number }): Promise<WeatherForecast> {
    const url = new URL(ENDPOINT);
    url.search = new URLSearchParams({
      latitude: point.lat.toFixed(4),
      longitude: point.lng.toFixed(4),
      hourly: 'precipitation',
      past_days: '3',
      forecast_days: '3',
      timezone: 'UTC',
    }).toString();
    const response = await this.fetchImpl(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!response.ok) throw new Error(`Open-Meteo : HTTP ${response.status}`);
    const parsed = responseSchema.safeParse(await response.json());
    if (!parsed.success) throw new Error('Open-Meteo : réponse inattendue');
    const hourly: HourlyRain = {
      times: parsed.data.hourly.time,
      precipitationMm: parsed.data.hourly.precipitation,
    };
    if (hourly.times.length !== hourly.precipitationMm.length) {
      throw new Error('Open-Meteo : séries de longueurs différentes');
    }
    return { lat: point.lat, lng: point.lng, source: this.name, hourly };
  }
}

/**
 * Météo fixée (tests automatisés, et plus tard simulateur de démonstration) : chaque heure
 * reçoit la pluie donnée par `rainAt`. Les relevés produits sont marqués « démo ».
 */
export class FixtureWeatherProvider implements WeatherProvider {
  readonly name = 'Météo injectée (test)';

  constructor(
    private readonly rainAt: (hourFromNow: number) => number | null,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async fetchForecast(point: { lat: number; lng: number }): Promise<WeatherForecast> {
    const start = Math.floor(this.now().getTime() / 3_600_000) - 72;
    const times: string[] = [];
    const precipitationMm: (number | null)[] = [];
    for (let h = 0; h < 72 + 72; h++) {
      times.push(new Date((start + h) * 3_600_000).toISOString().slice(0, 16));
      precipitationMm.push(this.rainAt(h - 72));
    }
    return {
      lat: point.lat,
      lng: point.lng,
      source: this.name,
      hourly: { times, precipitationMm },
    };
  }
}

/** Fournisseur en panne (tests EXG-09). */
export class FailingWeatherProvider implements WeatherProvider {
  readonly name = 'Open-Meteo';
  async fetchForecast(): Promise<WeatherForecast> {
    throw new Error('Open-Meteo : service indisponible (panne simulée)');
  }
}
