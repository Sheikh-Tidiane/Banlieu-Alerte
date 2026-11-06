import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

// Chiffrement des secrets au repos (secret TOTP, D-064) : AES-256-GCM, clé dérivée de
// TOTP_ENCRYPTION_KEY. Format : « v1:iv:tag:données » en base64url.

function key(): Buffer {
  const raw = process.env.TOTP_ENCRYPTION_KEY;
  if (!raw || raw.length < 16) {
    throw new Error('TOTP_ENCRYPTION_KEY manquante ou trop courte (voir .env.example).');
  }
  return createHash('sha256').update(raw).digest();
}

export function seal(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv, tag, data]
    .map((part) => (typeof part === 'string' ? part : part.toString('base64url')))
    .join(':');
}

export function open(sealed: string): string {
  const [version, iv, tag, data] = sealed.split(':');
  if (version !== 'v1' || !iv || !tag || !data) throw new Error('Secret chiffré illisible.');
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(data, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}
