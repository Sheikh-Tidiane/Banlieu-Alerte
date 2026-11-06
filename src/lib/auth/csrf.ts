import { ServiceError } from '@/services/errors';

// Protection CSRF (D-035) : une requête qui modifie des données doit venir de l'application.
// Le navigateur envoie toujours l'en-tête Origin sur un POST, PATCH ou DELETE ; on le compare
// à l'hôte de la requête (et à APP_URL derrière un proxy).

function allowedHosts(request: Request): Set<string> {
  const hosts = new Set<string>();
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  if (host) hosts.add(host);
  if (process.env.APP_URL) {
    try {
      hosts.add(new URL(process.env.APP_URL).host);
    } catch {
      // APP_URL invalide : seul l'hôte de la requête est accepté.
    }
  }
  return hosts;
}

export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    return allowedHosts(request).has(new URL(origin).host);
  } catch {
    return false;
  }
}

export function assertSameOrigin(request: Request): void {
  if (!isSameOrigin(request)) {
    throw new ServiceError('FORBIDDEN', 'Requête refusée (origine non reconnue).');
  }
}
