'use client';

// Identifiant aléatoire de l'appareil, pour le vote unique « Je vois aussi » (D-028).
// Il ne contient aucune information personnelle ; le serveur n'en garde qu'une empreinte.
const KEY = 'ba-device-id';

export function getDeviceId(): string {
  try {
    const existing = window.localStorage.getItem(KEY);
    if (existing) return existing;
    const created = crypto.randomUUID();
    window.localStorage.setItem(KEY, created);
    return created;
  } catch {
    // Stockage indisponible (navigation privée) : identifiant de session seulement.
    return crypto.randomUUID();
  }
}
