#!/usr/bin/env sh
# Test de restauration (CDC §11) : déchiffre une sauvegarde, la restaure dans une base
# temporaire, compare le nombre de lignes de tables clés avec la base source, puis supprime
# la base temporaire. La base de production n'est jamais modifiée.
#
# Usage : BACKUP_PASSPHRASE=… sh scripts/restore-test.sh backups/fichier.sql.gz.enc [conteneur]
set -eu

FILE="${1:?Chemin de la sauvegarde à tester.}"
CONTAINER="${2:-banlieue-alerte-db}"
: "${BACKUP_PASSPHRASE:?Définir BACKUP_PASSPHRASE.}"
SOURCE="${MYSQL_DATABASE:-banlieue_alerte}"
TARGET="restore_test_$(date +%s)"

mysql_exec() {
  docker exec -i "$CONTAINER" sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$@"' sh "$@"
}

echo "Restauration dans la base temporaire $TARGET…"
mysql_exec -e "CREATE DATABASE \`$TARGET\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
trap 'mysql_exec -e "DROP DATABASE IF EXISTS \`$TARGET\`" 2>/dev/null || true' EXIT

openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_PASSPHRASE -in "$FILE" \
  | gunzip \
  | mysql_exec "$TARGET"

STATUS=0
for TABLE in users reports report_status_history neighborhoods risk_cells alerts audit_logs; do
  A=$(mysql_exec -N -e "SELECT COUNT(*) FROM \`$SOURCE\`.\`$TABLE\`" 2>/dev/null | tr -d '\r')
  B=$(mysql_exec -N -e "SELECT COUNT(*) FROM \`$TARGET\`.\`$TABLE\`" 2>/dev/null | tr -d '\r')
  if [ "$A" = "$B" ]; then
    echo "  $TABLE : $B ligne(s) – identique"
  else
    echo "  $TABLE : source $A, restauration $B – ÉCART"
    STATUS=1
  fi
done
TABLES=$(mysql_exec -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$TARGET'" | tr -d '\r')
echo "  $TABLES table(s) restaurée(s)."
[ "$STATUS" -eq 0 ] && echo "Test de restauration réussi." || echo "Test de restauration : écarts constatés (une écriture a pu avoir lieu entre la sauvegarde et le test)."
exit "$STATUS"
