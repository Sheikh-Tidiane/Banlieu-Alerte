import { createHash } from 'node:crypto';

/**
 * Empreinte non réversible d'un identifiant (IP, appareil) avec un sel serveur.
 * Permet la limitation de débit et le vote unique sans stocker l'identifiant en clair.
 */
export function fingerprint(value: string, purpose: string): string {
  const salt = process.env.HASH_SALT;
  if (!salt) throw new Error('HASH_SALT manquant (voir .env.example).');
  return createHash('sha256').update(`${purpose}:${salt}:${value}`).digest('hex');
}

/** Adresse IP du client d'après les en-têtes du proxy ; jamais journalisée ni stockée. */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || headers.get('x-real-ip') || 'unknown';
}
