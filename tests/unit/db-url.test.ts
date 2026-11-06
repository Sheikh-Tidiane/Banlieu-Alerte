import { describe, expect, it } from 'vitest';
import { toDriverUrl } from '@/lib/db';

describe('URL de connexion', () => {
  it('ajoute allowPublicKeyRetrieval pour MySQL 8 en local', () => {
    expect(toDriverUrl('mysql://u:p@127.0.0.1:3307/db')).toContain('allowPublicKeyRetrieval=true');
  });

  it('conserve une valeur explicite', () => {
    expect(toDriverUrl('mysql://u:p@h/db?allowPublicKeyRetrieval=false')).toContain(
      'allowPublicKeyRetrieval=false',
    );
  });
});
