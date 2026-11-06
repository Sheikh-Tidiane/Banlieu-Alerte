#!/usr/bin/env sh
# Tâche planifiée unique (D-057) : escalade, alertes programmées, indice toutes les 3 h,
# purge quotidienne. Lancée toutes les 15 minutes ; une erreur n'arrête pas la boucle.
set -u
while true; do
  npm run --silent jobs || echo "Tâche planifiée : échec (voir la supervision)."
  sleep 900
done
