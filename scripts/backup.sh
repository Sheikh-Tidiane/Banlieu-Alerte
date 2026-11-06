#!/usr/bin/env sh
# Sauvegarde chiffrée de la base (CDC §11) : mysqldump → gzip → AES-256 (openssl, PBKDF2).
#
# Usage : BACKUP_PASSPHRASE=… sh scripts/backup.sh [conteneur]
#   conteneur : nom du conteneur MySQL (par défaut banlieue-alerte-db).
# Sortie : backups/banlieue-alerte-AAAAMMJJ-HHMMSS.sql.gz.enc
# La phrase secrète n'est jamais écrite dans le fichier ni dans le dépôt.
set -eu

CONTAINER="${1:-banlieue-alerte-db}"
: "${BACKUP_PASSPHRASE:?Définir BACKUP_PASSPHRASE (phrase secrète de chiffrement).}"
DATABASE="${MYSQL_DATABASE:-banlieue_alerte}"
STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p backups
OUT="backups/banlieue-alerte-${STAMP}.sql.gz.enc"

# Le mot de passe root est lu dans le conteneur (variable d'environnement), jamais ici.
docker exec "$CONTAINER" sh -c \
  'exec mysqldump --single-transaction --routines --no-tablespaces -uroot -p"$MYSQL_ROOT_PASSWORD" "$0"' \
  "$DATABASE" \
  | gzip -9 \
  | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass env:BACKUP_PASSPHRASE -out "$OUT"

echo "Sauvegarde chiffrée : $OUT ($(wc -c < "$OUT") octets)"
