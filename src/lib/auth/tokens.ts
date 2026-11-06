import { createHash, randomBytes } from 'node:crypto';

// Jetons secrets (sessions, invitations, réinitialisations) : 32 octets aléatoires.
// Seule leur empreinte SHA-256 est stockée en base ; le jeton clair ne vit que dans le
// cookie ou le lien transmis.

export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
