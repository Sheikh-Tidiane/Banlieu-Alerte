/**
 * Documentation OpenAPI (CDC §10) générée à partir des route handlers : chemins, méthodes et
 * résumés (commentaire JSDoc de chaque fonction). Les schémas détaillés sont dans
 * src/validators/ ; les réponses suivent le format { data } / { error: { code, message } }.
 *
 * Usage : npm run openapi   (écrit docs/openapi.yaml ; un test vérifie qu'il est à jour)
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const API_DIR = 'src/app/api';
const METHODS = ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'] as const;

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return routeFiles(path);
    return name === 'route.ts' ? [path] : [];
  });
}

export type ApiRoute = { path: string; method: string; summary: string };

export function collectRoutes(): ApiRoute[] {
  const routes: ApiRoute[] = [];
  for (const file of routeFiles(API_DIR)) {
    const dir = relative(API_DIR, file).split(sep).slice(0, -1);
    const path = `/api/${dir.map((part) => part.replace(/^\[(.+)\]$/, '{$1}')).join('/')}`;
    const source = readFileSync(file, 'utf8');
    for (const method of METHODS) {
      const match = new RegExp(
        // Dernier commentaire avant la fonction (aucun « */ » à l'intérieur).
        `/\\*\\*((?:(?!\\*/)[\\s\\S])*)\\*/\\s*export async function ${method}\\b`,
      ).exec(source);
      if (!match && !new RegExp(`export async function ${method}\\b`).test(source)) continue;
      const summary = (match?.[1] ?? '')
        .split('\n')
        .map((line) => line.replace(/^\s*\*\s?/, '').trim())
        .filter(Boolean)
        .join(' ')
        .replace(/^(GET|POST|PATCH|PUT|DELETE)\s+\S+(\s+\([^)]*\))?\s*[–:]\s*/, '');
      routes.push({ path, method, summary: summary || `${method} ${path}` });
    }
  }
  return routes.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
}

const quote = (value: string) => `'${value.replace(/'/g, "''")}'`;

export function renderOpenApi(routes: ApiRoute[]): string {
  const lines = [
    '# Généré par scripts/build-openapi.ts – ne pas modifier à la main (npm run openapi).',
    'openapi: 3.1.0',
    'info:',
    '  title: API Banlieue Alerte',
    '  version: 1.0.0',
    '  description: >-',
    '    API REST de Banlieue Alerte. Réponses JSON { data } ou { error: { code, message, details } }.',
    '    Les routes qui modifient des données exigent un en-tête Origin du site (CSRF, D-035) ;',
    '    les routes de l’équipe exigent une session (cookie ba_session) et un rôle, et le second',
    '    facteur pour un administrateur. Les schémas des corps sont les validateurs Zod de src/validators/.',
    'servers:',
    '  - url: /',
    'paths:',
  ];
  let current = '';
  for (const route of routes) {
    if (route.path !== current) {
      lines.push(`  ${route.path}:`);
      current = route.path;
    }
    lines.push(`    ${route.method.toLowerCase()}:`);
    lines.push(`      summary: ${quote(route.summary)}`);
    const params = [...route.path.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!);
    if (params.length) {
      lines.push('      parameters:');
      for (const name of params) {
        lines.push(
          `        - { name: ${name}, in: path, required: true, schema: { type: string } }`,
        );
      }
    }
    lines.push('      responses:');
    lines.push("        '200': { description: 'Succès (201 pour une création)' }");
    lines.push("        '4XX': { description: 'Erreur de validation, d’accès ou de débit' }");
  }
  return `${lines.join('\n')}\n`;
}

if (process.argv[1]?.endsWith('build-openapi.ts')) {
  const routes = collectRoutes();
  writeFileSync('docs/openapi.yaml', renderOpenApi(routes), 'utf8');
  console.log(`docs/openapi.yaml : ${routes.length} opérations.`);
}
