# Banlieue Alerte

PWA de signalement collaboratif, d'indice de risque et d'alerte pour les inondations et l'assainissement à Thiaroye et dans le département de Pikine (Sénégal). Projet présenté au concours Banlieue Smart Genius (catégorie Smart Territory).

> État : **Phase 6** terminée, en attente de validation. Les six phases du Socle et de la Finale sont réalisées. Voir `docs/PROGRESS.md`.

Boucle du produit : **prédire** (indice de risque par quartier) → **alerter** (après approbation humaine) → **signaler** (les habitants, sans compte) → **traiter** (back-office, escalade, curage) → **apprendre** (épisodes, étiquettes, qualité de l'indice). L'indice est un indice **indicatif** par règles, pas une probabilité.

## Prérequis

- Node.js 22.12 ou plus récent, npm 10
- Docker Desktop (base MySQL 8.4 de développement)

## Installation

```bash
npm install
cp .env.example .env          # puis remplacer les valeurs de test
npm run db:up                 # MySQL sur 127.0.0.1:3307
npx prisma migrate dev        # crée les tables
npx prisma db seed            # données de démonstration (toutes marquées « démo »)
npm run dev                   # http://localhost:3000
```

## Commandes

| Commande                              | Rôle                                                                                              |
| ------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `npm run dev`                         | serveur de développement                                                                          |
| `npm run dev:lan`                     | serveur joignable depuis le réseau local (téléphone)                                              |
| `npm run build`                       | build de production                                                                               |
| `npm run lint`                        | ESLint                                                                                            |
| `npm run format:check`                | Prettier (vérification)                                                                           |
| `npm run typecheck`                   | `tsc --noEmit`                                                                                    |
| `npm run test`                        | tests unitaires (Vitest)                                                                          |
| `npm run test:db`                     | tests d'intégration sur la base (après migrate et seed)                                           |
| `npm run test:e2e`                    | tests de parcours et captures (Playwright)                                                        |
| `npx prisma migrate dev`              | migrations                                                                                        |
| `npx prisma db seed`                  | données de démonstration                                                                          |
| `npm run admin:invite -- <e-mail>`    | invitation du premier administrateur (lien affiché une fois)                                      |
| `npm run brand`                       | régénère les fichiers du logo dans `public/brand/`                                                |
| `npm run risk:cells`                  | grille du pilote et altitudes SRTM (réseau requis)                                                |
| `npm run job:risk`                    | recalcul de l'indice et envoi des alertes programmées                                             |
| `npm run jobs`                        | tâche planifiée unique (toutes les 15 min) : escalade, alertes programmées, indice toutes les 3 h |
| `npm run map:offline`                 | fond de plan hors ligne du pilote (données OSM via Overpass)                                      |
| `npm run openapi`                     | régénère `docs/openapi.yaml` à partir des routes                                                  |
| `npm run admin:reset-mfa -- <e-mail>` | réinitialise le second facteur d'un administrateur                                                |

Les tests e2e utilisent le Chrome installé (`E2E_BROWSER_CHANNEL=chromium` + `npx playwright install chromium` pour la CI), avec 2 processus. Ils nécessitent la base (`npm run db:up`, migrations, seed).

Migration en terminal non interactif (D-031) : `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script > prisma/migrations/<date>_<nom>/migration.sql`, relire, puis `npx prisma migrate deploy`.

## Architecture

```
src/
  app/            pages et route handlers (App Router)
  components/     interface, sans logique métier (ui/, brand/, layout/…)
  services/       logique métier par fonctionnalité
  lib/            db, auth, api (erreurs), notifications (simulation), risk, weather, geo
  jobs/           tâches planifiées
  i18n/           traductions (fr, wo)
  validators/     schémas Zod
  permissions/    contrôle des rôles côté serveur
  generated/      client Prisma généré (non versionné)
prisma/           schéma, migrations, seed
public/           manifeste, brand/ (logos)
tests/            unit/, integration/, e2e/
docs/             cahier des charges, design, suivi, décisions
```

Pages publiques : `/` (accueil), `/signaler`, `/carte`, `/carte-risque`, `/alertes`, `/s-abonner`, `/signalements/[code]`, `/statistiques`, `/qualite-indice`, `/apprendre`, `/urgence`, `/hors-ligne`, `/connexion`, `/inscription`, `/brand`, `/design`. Comptes : `/mon-espace`, `/connexion/second-facteur`, `/invitation/[jeton]`, `/reinitialisation/[jeton]`. Back-office (délégués, agents, administrateurs) : `/back-office` (tableau de bord, signalements, modération, alertes, indice, épisodes, curage, zones, utilisateurs, journal, supervision, démonstration).

Schémas : `docs/ARCHITECTURE.md`. API : `docs/openapi.yaml` (généré par `npm run openapi`, vérifié par un test).

## Variables d'environnement

Toutes documentées dans `.env.example`. Aucun secret dans le code. Les notifications sont en **mode simulation** par défaut (`NOTIFICATIONS_MODE=simulation`).

## Tester sur un téléphone

Voir `docs/TEST_TELEPHONE.md`. En résumé :

1. `npm run dev:lan`, puis ouvrir `http://<adresse-du-PC>:3000` sur un téléphone du même Wi-Fi.
2. Ajouter l'adresse dans `DEV_ALLOWED_ORIGINS` (par exemple `192.168.1.20`) si le serveur bloque les ressources de développement.
3. La géolocalisation, la caméra et l'installation de la PWA exigent **HTTPS** : version déployée, Tailscale, tunnel temporaire ou `npx next dev --experimental-https`.

Causes d'échec courantes : pare-feu Windows qui bloque le port 3000, VPN actif sur l'ordinateur, Wi-Fi qui isole les appareils (utiliser alors le partage de connexion d'un téléphone).

## Données de démonstration

Le seed crée des données **fictives**, marquées `isDemo` en base et signalées à l'écran : une commune de démonstration, trois quartiers aux limites approximatives, des repères fictifs, cinq signalements et quatre comptes de test (habitant, délégué, agent, administrateur, adresses en `.test`, mot de passe défini par `SEED_TEST_PASSWORD`). Les noms et limites officiels restent à confirmer.

## Comptes et rôles

- **Habitant** : inscription libre (`/inscription`). Signaler reste possible sans compte.
- **Délégué, agent, administrateur** : uniquement par invitation (`/back-office/utilisateurs`). Le premier administrateur s'invite avec `npm run admin:invite -- adresse@exemple.sn`.
- Pendant le pilote, aucun e-mail n'est envoyé (mode simulation) : les liens d'invitation et de réinitialisation sont affichés une fois à l'administrateur, qui les transmet.
- Comptes de démonstration : voir le seed (`prisma/seed.ts`) ; mot de passe commun `SEED_TEST_PASSWORD` dans `.env`.

## Indice de risque et alertes

- **Indice** : score de 0 à 100 par règles pondérées (pluie Open-Meteo, relief SRTM, caniveaux signalés). C'est un indice indicatif, pas une probabilité. Méthode et limites : `docs/METHODOLOGIE.md`. La grille se règle et se versionne dans `/back-office/indice`.
- **Recalcul** : toutes les 3 heures avec `npm run job:risk` (crontab : `0 */3 * * *`), ou `POST /api/jobs/risk-refresh` avec l'en-tête `Authorization: Bearer $CRON_SECRET`, ou le bouton de l'administrateur. Si la grille change de quartiers pilotes, relancer d'abord `npm run risk:cells`.
- **Alertes** : rien n'est envoyé sans approbation humaine (`/back-office/alertes`). L'indice ne crée que des brouillons indicatifs, à partir du niveau « Élevé » à 24 h. Une alerte officielle est réservée aux agents et aux administrateurs.
- **Abonnements** : `/s-abonner`, avec un compte. Deux canaux : notification dans l'application (réelle) et notification web (mode simulation, `NOTIFICATIONS_MODE`).

## Suivi, apprentissage et terrain (Phase 5)

- **Tâche planifiée** : une seule ligne de crontab, `*/15 * * * * npm run jobs`, ou `POST /api/jobs/run` avec `Authorization: Bearer $CRON_SECRET`.
- **Retour au citoyen** : notifications dans « Mon espace » (consentement dans le profil), question « Le problème est-il résolu ? » ; « non » rouvre le dossier.
- **Escalade** : délais de première réponse réglables par l'administrateur sur le tableau de bord du back-office.
- **Épisodes et étiquettes** : `/back-office/episodes`. La qualité de l'indice (`/qualite-indice`) reste vide tant que le seuil de `docs/METHODOLOGIE.md` §4 n'est pas atteint.
- **Curage** : `/back-office/curage`, liste triée par indice × gravité.
- **Pages publiques** : `/carte-risque`, `/statistiques`, `/apprendre` (contenu à faire relire avant l'ouverture au public).
- **Hors ligne** : le plan de la zone pilote (`public/offline/`) s'affiche quand les tuiles OSM ne chargent pas. À regénérer avec `npm run map:offline` si la zone change.

## Démonstration, sécurité et production (Phase 6)

- **Démonstration** : `DEMO_MODE=true` active le simulateur d'épisode de pluie (`/back-office/demo`, administrateur). Toutes ses données sont marquées « démo » et la réinitialisation les supprime. Script de 5 minutes : `docs/DEMO.md`.
- **Administrateur** : second facteur obligatoire (application d'authentification, QR code, 8 codes de secours). En cas de perte du téléphone : `npm run admin:reset-mfa -- <e-mail>`.
- **Supervision** : `/api/health` et `/back-office/supervision`. Purge automatique des données selon les durées de conservation (D-043, D-065).
- **Sécurité** : revue OWASP et sauvegardes chiffrées dans `docs/SECURITE.md` (`scripts/backup.sh`, `scripts/restore-test.sh`).
- **Production** : `docker compose -f docker-compose.prod.yml up -d --build` (application, MySQL, migrations, tâche planifiée, Caddy pour le HTTPS). Guide : `docs/DEPLOIEMENT.md`.
- **Contribuer** : `CONTRIBUTING.md`.

## Documents

| Document                                     | Contenu                                           |
| -------------------------------------------- | ------------------------------------------------- |
| `docs/CAHIER_DES_CHARGES.md`                 | Ce qu'il faut construire                          |
| `docs/PROGRESS.md`, `docs/DECISIONS.md`      | Avancement, journal des décisions (D-001 à D-068) |
| `docs/TRACABILITE.md`                        | Exigences et preuves                              |
| `docs/METHODOLOGIE.md`                       | Indice de risque, protocole d'évaluation, limites |
| `docs/ARCHITECTURE.md`, `docs/openapi.yaml`  | Architecture, API                                 |
| `docs/DEPLOIEMENT.md`, `docs/SECURITE.md`    | Production, sécurité, sauvegardes                 |
| `docs/DEMO.md`                               | Script de démonstration de 5 minutes              |
| `docs/MARQUE.md`, `docs/DESIGN_ET_MARQUE.md` | Identité visuelle                                 |
| `docs/TEST_TELEPHONE.md`                     | Test sur un vrai téléphone en HTTPS               |
| `docs/screenshots/phase-1/` à `phase-6/`     | Captures à 375 et 1280 px                         |
