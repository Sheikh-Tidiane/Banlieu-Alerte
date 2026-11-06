// Limitation de débit en mémoire, par fenêtre glissante (D-028). Suffisant pour une
// instance unique pendant le pilote ; à déplacer vers la base ou Redis si l'on passe
// à plusieurs instances.

type Rule = { limit: number; windowMs: number };

export const RATE_LIMITS = {
  createReport: { limit: 5, windowMs: 10 * 60_000 },
  vote: { limit: 30, windowMs: 10 * 60_000 },
  abuse: { limit: 5, windowMs: 60 * 60_000 },
  resolve: { limit: 120, windowMs: 60_000 },
  login: { limit: 10, windowMs: 10 * 60_000 },
  register: { limit: 5, windowMs: 60 * 60_000 },
  token: { limit: 20, windowMs: 10 * 60_000 },
  comment: { limit: 20, windowMs: 10 * 60_000 },
} as const satisfies Record<string, Rule>;

export type RateLimitName = keyof typeof RATE_LIMITS;

const hits = new Map<string, number[]>();

/** Multiplicateur des limites, réservé aux tests automatisés (1 par défaut, jamais moins). */
function rateLimitFactor(): number {
  const factor = Number(process.env.RATE_LIMIT_FACTOR ?? 1);
  return Number.isFinite(factor) && factor >= 1 ? factor : 1;
}

export function checkRateLimit(
  name: RateLimitName,
  key: string,
  now = Date.now(),
): { allowed: boolean; retryAfterSeconds: number } {
  const { windowMs } = RATE_LIMITS[name];
  const limit = RATE_LIMITS[name].limit * rateLimitFactor();
  const bucketKey = `${name}:${key}`;
  const recent = (hits.get(bucketKey) ?? []).filter((time) => now - time < windowMs);
  if (recent.length >= limit) {
    hits.set(bucketKey, recent);
    const oldest = recent[0] ?? now;
    return { allowed: false, retryAfterSeconds: Math.ceil((windowMs - (now - oldest)) / 1000) };
  }
  recent.push(now);
  hits.set(bucketKey, recent);
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Réservé aux tests. */
export function resetRateLimits() {
  hits.clear();
}
