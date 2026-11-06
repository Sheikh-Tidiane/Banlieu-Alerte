import { describe, expect, it } from 'vitest';
import { open, seal } from '@/lib/auth/secret-box';
import {
  base32Decode,
  base32Encode,
  generateTotpSecret,
  hotp,
  otpauthUri,
  totp,
  totpStep,
  verifyTotp,
} from '@/lib/auth/totp';
import { needsSecondFactor } from '@/permissions/require';
import type { AuthUser } from '@/permissions/types';

// Secret de référence de la RFC 6238 (annexe B) : « 12345678901234567890 » en ASCII.
const RFC_SECRET = Buffer.from('12345678901234567890');

describe('TOTP (RFC 6238, D-064)', () => {
  it('vecteurs officiels SHA-1 (8 chiffres)', () => {
    const cases: [number, string][] = [
      [59, '94287082'],
      [1111111109, '07081804'],
      [1111111111, '14050471'],
      [1234567890, '89005924'],
      [2000000000, '69279037'],
    ];
    for (const [seconds, expected] of cases) {
      expect(hotp(RFC_SECRET, totpStep(new Date(seconds * 1000)), 8)).toBe(expected);
    }
  });

  it('base32 aller-retour ; secret de 160 bits', () => {
    expect(base32Decode(base32Encode(RFC_SECRET)).toString()).toBe('12345678901234567890');
    expect(base32Decode(generateTotpSecret())).toHaveLength(20);
  });

  it('fenêtre de ±30 s, refus hors fenêtre et refus d’un code déjà utilisé', () => {
    const secret = generateTotpSecret();
    const now = new Date('2026-11-05T12:00:10Z');
    const code = totp(secret, now);
    const ok = verifyTotp(secret, code, now);
    expect(ok.ok).toBe(true);
    expect(verifyTotp(secret, code, new Date(now.getTime() + 30_000)).ok).toBe(true);
    expect(verifyTotp(secret, code, new Date(now.getTime() + 95_000)).ok).toBe(false);
    // Même période déjà utilisée : refus (pas de rejeu).
    expect(verifyTotp(secret, code, now, ok.ok ? ok.step : null).ok).toBe(false);
    expect(verifyTotp(secret, '12345', now).ok).toBe(false);
  });

  it('URI d’enrôlement lisible par les applications', () => {
    const uri = otpauthUri('JBSWY3DPEHPK3PXP', 'admin@exemple.test');
    expect(uri).toMatch(/^otpauth:\/\/totp\/Banlieue%20Alerte%3Aadmin%40exemple\.test\?/);
    expect(uri).toContain('secret=JBSWY3DPEHPK3PXP');
  });
});

describe('chiffrement du secret au repos', () => {
  it('aller-retour, chiffré différent à chaque fois, altération détectée', () => {
    process.env.TOTP_ENCRYPTION_KEY = 'cle-de-test-suffisamment-longue';
    const a = seal('JBSWY3DPEHPK3PXP');
    const b = seal('JBSWY3DPEHPK3PXP');
    expect(a).not.toBe(b);
    expect(a).not.toContain('JBSWY3DPEHPK3PXP');
    expect(open(a)).toBe('JBSWY3DPEHPK3PXP');
    const parts = a.split(':');
    parts[3] = `${parts[3]!.slice(0, -2)}AA`;
    expect(() => open(parts.join(':'))).toThrow();
  });
});

describe('accès administrateur sans second facteur (EXG-41)', () => {
  const base = { name: 'T', email: null, locale: 'fr', communeId: null, neighborhoodIds: [] };
  const admin: AuthUser = { ...base, id: 'a', role: 'ADMIN', mfaVerified: false };
  const verified: AuthUser = { ...admin, mfaVerified: true };
  const agent: AuthUser = { ...base, id: 'g', role: 'AGENT' };

  it('refusé pour toute route d’équipe tant que le code n’est pas vérifié', () => {
    expect(needsSecondFactor(admin, ['ADMIN'])).toBe(true);
    expect(needsSecondFactor(admin, ['DELEGATE', 'AGENT', 'ADMIN'])).toBe(true);
    expect(needsSecondFactor(verified, ['ADMIN'])).toBe(false);
    expect(needsSecondFactor(agent, ['AGENT', 'ADMIN'])).toBe(false);
    // Routes sans rôle (compte, second facteur lui-même) : accessibles.
    expect(needsSecondFactor(admin, undefined)).toBe(false);
  });
});
