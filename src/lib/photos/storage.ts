import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

// Stockage des photos derrière une interface (D-024) : local en Phase 2, compatible S3 plus tard.

export interface PhotoStorage {
  save(data: Buffer): Promise<string>;
  read(key: string): Promise<Buffer | null>;
}

/** Clé : 32 caractères hexadécimaux + .jpg. Toute autre forme est refusée (pas de chemin). */
export const PHOTO_KEY_PATTERN = /^[0-9a-f]{32}\.jpg$/;

export class LocalPhotoStorage implements PhotoStorage {
  // Dossier choisi à l'exécution : exclu de l'analyse statique de Turbopack.
  constructor(
    private readonly directory = resolve(
      /* turbopackIgnore: true */ process.env.UPLOAD_DIR ?? 'uploads',
    ),
  ) {}

  async save(data: Buffer): Promise<string> {
    await mkdir(this.directory, { recursive: true });
    const key = `${randomBytes(16).toString('hex')}.jpg`;
    await writeFile(join(this.directory, key), data);
    return key;
  }

  async read(key: string): Promise<Buffer | null> {
    if (!PHOTO_KEY_PATTERN.test(key)) return null;
    try {
      return await readFile(join(this.directory, key));
    } catch {
      return null;
    }
  }
}

export const photoStorage: PhotoStorage = new LocalPhotoStorage();
