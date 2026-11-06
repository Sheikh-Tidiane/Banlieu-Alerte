import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '@/lib/auth/password';

describe('hachage des mots de passe', () => {
  it('vérifie le bon mot de passe et refuse un mauvais', async () => {
    const stored = await hashPassword('valeur-de-test');
    expect(stored.startsWith('scrypt$')).toBe(true);
    expect(stored).not.toContain('valeur-de-test');
    expect(await verifyPassword('valeur-de-test', stored)).toBe(true);
    expect(await verifyPassword('autre-valeur', stored)).toBe(false);
  });

  it('produit un sel différent à chaque appel', async () => {
    expect(await hashPassword('x')).not.toBe(await hashPassword('x'));
  });

  it('refuse un format inconnu', async () => {
    expect(await verifyPassword('x', 'md5$abc')).toBe(false);
  });
});
