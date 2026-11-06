import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '@/generated/prisma/client';

/**
 * Prépare l'URL pour le pilote mariadb (utilisé par Prisma 7 pour MySQL).
 * MySQL 8 authentifie par caching_sha2_password : sans TLS en local, le pilote doit
 * pouvoir récupérer la clé publique du serveur.
 */
const DRIVER_DEFAULTS = {
  allowPublicKeyRetrieval: 'true',
  // Pool explicite : un essai de connexion bloqué échoue vite (connectTimeout) au lieu
  // d'immobiliser le pool ; une requête attend une connexion libre jusqu'à 20 s.
  connectionLimit: '10',
  connectTimeout: '5000',
  acquireTimeout: '20000',
} as const;

export function toDriverUrl(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  for (const [key, value] of Object.entries(DRIVER_DEFAULTS)) {
    if (!url.searchParams.has(key)) url.searchParams.set(key, value);
  }
  return url.toString();
}

export function createPrismaClient(databaseUrl = process.env.DATABASE_URL): PrismaClient {
  if (!databaseUrl) throw new Error('DATABASE_URL manquante (voir .env.example).');
  return new PrismaClient({
    adapter: new PrismaMariaDb(toDriverUrl(databaseUrl)),
    // Transactions : 5 s par défaut, insuffisant sous charge (constaté dans la supervision,
    // Phase 6). Attente d'une connexion libre : 10 s ; durée maximale : 15 s.
    transactionOptions: { maxWait: 10_000, timeout: 15_000 },
  });
}

// Instance unique, créée au premier usage : évite d'ouvrir un nouveau pool à chaque
// rechargement en développement et n'exige DATABASE_URL qu'au moment d'une requête.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export function getPrisma(): PrismaClient {
  globalForPrisma.prisma ??= createPrismaClient();
  return globalForPrisma.prisma;
}
