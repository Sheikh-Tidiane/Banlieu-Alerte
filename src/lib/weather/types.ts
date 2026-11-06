// Météo (D-045) : pluie horaire en millimètres, heures en UTC (ISO 8601).

export type HourlyRain = {
  times: string[];
  precipitationMm: (number | null)[];
};

export type WeatherForecast = {
  lat: number;
  lng: number;
  source: string;
  hourly: HourlyRain;
};

/** Fournisseur injectable : Open-Meteo en production, données fixées dans les tests. */
export interface WeatherProvider {
  readonly name: string;
  fetchForecast(point: { lat: number; lng: number }): Promise<WeatherForecast>;
}
