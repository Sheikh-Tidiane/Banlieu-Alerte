// Numéros d'urgence affichés par le bouton Urgence (D-029, EXG-31).
// Source : fournis par l'équipe le 2026-11-04. Toute modification est consignée dans
// docs/DECISIONS.md avec sa source.

export type EmergencyNumber = {
  service: string;
  description: string;
  /** Numéros à composer, dans l'ordre d'affichage. */
  numbers: string[];
};

export const EMERGENCY_NUMBERS_SOURCE = 'Équipe Banlieue Alerte, 2026-11-04';

export const emergencyNumbers: EmergencyNumber[] = [
  {
    service: 'Brigade nationale des sapeurs-pompiers',
    description: 'Incendie et secours',
    numbers: ['18'],
  },
  {
    service: 'SAMU national',
    description: 'Urgences médicales, gratuit, à toute heure',
    numbers: ['15', '1515'],
  },
  {
    service: 'Police nationale',
    description: 'Police secours',
    numbers: ['17'],
  },
  {
    service: 'Police nationale et Gendarmerie',
    description: 'Lignes vertes nationales',
    numbers: ['800 00 20 20', '800 00 17 00'],
  },
];

/** Lien d'appel : chiffres seulement. */
export function telHref(number: string): `tel:${string}` {
  return `tel:${number.replace(/\D/g, '')}`;
}
