import { randomInt } from 'node:crypto';

// Numéro de suivi (D-030) : BA-XXXX-XXXX, sans caractères ambigus (0/O, 1/I/L),
// tiré au hasard cryptographique : ~1,1 × 10^12 combinaisons, non devinable.
export const TRACKING_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const TRACKING_CODE_PATTERN = /^BA-[A-HJ-KM-NP-Z2-9]{4}-[A-HJ-KM-NP-Z2-9]{4}$/;

function block(): string {
  return Array.from(
    { length: 4 },
    () => TRACKING_ALPHABET[randomInt(TRACKING_ALPHABET.length)],
  ).join('');
}

export function generateTrackingCode(): string {
  return `BA-${block()}-${block()}`;
}

/** Les codes de démonstration (BA-DEMO-0001) sont aussi acceptés en lecture. */
export function isTrackingCode(value: string): boolean {
  return TRACKING_CODE_PATTERN.test(value) || /^BA-DEMO-\d{4}$/.test(value);
}
