# Guide de déploiement – Banlieue Alerte

Déploiement sur un serveur Linux avec Docker (D-067). L'hébergeur reste à choisir (décision ouverte dans `docs/DECISIONS.md`).

## Prérequis

- Un serveur Linux avec Docker et Docker Compose (2 vCPU et 2 Go de RAM suffisent pour le pilote).
- Un nom de domaine dont l'enregistrement DNS pointe vers le serveur : Caddy obtient le certificat HTTPS seul.
- Les ports 80 et 443 ouverts.

## Installation

```bash
git clone <dépôt> banlieue-alerte && cd banlieue-alerte
cp .env.example .env
```

Dans `.env`, remplacer **toutes** les valeurs de test par des secrets longs et aléatoires, par exemple avec `openssl rand -base64 32` :

| Variable | Rôle |
|---|---|
| `MYSQL_PASSWORD`, `MYSQL_ROOT_PASSWORD` | Base de données |
| `HASH_SALT` | Sel des empreintes (limitation de débit, votes) |
| `TOTP_ENCRYPTION_KEY` | Chiffrement des secrets du second facteur. Ne plus la changer ensuite. |
| `CRON_SECRET` | Accès de la tâche planifiée par HTTP (facultatif ici) |
| `DOMAIN` | Nom de domaine, par exemple `alerte.exemple.sn` |
| `NOTIFICATIONS_MODE` | `simulation` : aucun envoi réel n'est branché |
| `DEMO_MODE` | `false` en production ; `true` seulement pour une démonstration |

Démarrer :

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Ordre de démarrage :
1. `db` démarre et attend d'être prête ;
2. `migrate` applique les migrations, puis s'arrête ;
3. `app` démarre ;
4. `jobs` lance la tâche planifiée toutes les 15 minutes ;
5. `caddy` sert le site en HTTPS.

## Premier administrateur et zones

```bash
# Grille du pilote (après avoir saisi les vrais quartiers et repères dans le back-office)
docker compose -f docker-compose.prod.yml run --rm migrate npm run risk:cells
docker compose -f docker-compose.prod.yml run --rm migrate npm run map:offline
# Invitation du premier administrateur (le lien s'affiche une fois)
docker compose -f docker-compose.prod.yml run --rm migrate npm run admin:invite -- admin@exemple.sn
```

À la première connexion, l'administrateur configure son second facteur (application d'authentification et QR code) et note ses codes de secours.

Le jeu de démonstration (`npx prisma db seed`) est réservé aux démonstrations. Ses données sont marquées « démo ».

## Vérifications

- `https://<domaine>/api/health` : `status` vaut `ok` ou `warning`, et `checks.database` vaut `ok`.
- `/back-office/supervision` (administrateur) : la dernière exécution de la tâche planifiée date de moins de 15 minutes.
- Sur un vrai téléphone : signalement avec position et photo, puis mode avion (voir `docs/TEST_TELEPHONE.md`).

## Sauvegardes

À programmer chaque jour sur le serveur, par exemple avec cron. Le nom du conteneur s'obtient avec `docker compose -f docker-compose.prod.yml ps db`.

```bash
BACKUP_PASSPHRASE=... sh scripts/backup.sh <conteneur_db>
BACKUP_PASSPHRASE=... sh scripts/restore-test.sh backups/<fichier> <conteneur_db>   # chaque mois
```

Copier les sauvegardes hors du serveur. Les photos sont dans le volume `uploads`, à sauvegarder aussi.

## Mise à jour

```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build   # migrate s'exécute avant app
```

## Incidents

| Symptôme | Action |
|---|---|
| Administrateur sans téléphone ni code de secours | `docker compose -f docker-compose.prod.yml run --rm migrate npm run admin:reset-mfa -- <e-mail>` |
| Météo indisponible | L'indice reprend le dernier relevé et l'affiche ; vérifier la supervision |
| Tâche planifiée muette | `docker compose -f docker-compose.prod.yml logs jobs` |
