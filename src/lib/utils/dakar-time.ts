// L'heure de Dakar est l'heure UTC toute l'année (pas d'heure d'été) : une valeur de champ
// datetime-local saisie « à l'heure de Dakar » se convertit sans dépendre du navigateur.

export function toDakarInput(date: Date | string | null): string {
  if (!date) return '';
  return new Date(date).toISOString().slice(0, 16);
}

export function fromDakarInput(value: string): string {
  return new Date(`${value}:00Z`).toISOString();
}

/** Valeur de champ pour « maintenant + n heures ». */
export function dakarInputInHours(hours: number): string {
  return toDakarInput(new Date(Date.now() + hours * 3_600_000));
}
