# Script de démonstration (5 minutes) – Banlieue Alerte

Scénario du CDC §14 : prévision de forte pluie → carte de risque qui passe au rouge → brouillon d'alerte approuvé et envoyé en simulation → signalements entrants → traitement par la mairie → comparaison de l'indice et du réel. La mention « démonstration » reste visible du début à la fin.

## Préparation (la veille)

1. Mettre `DEMO_MODE=true` dans `.env`, **refaire le build** (`npm run build`), puis lancer l'application (bandeau « Mode démonstration » sur toutes les pages). Sans nouveau build, les pages pré-rendues comme `/signaler` n'affichent pas le bandeau (constaté le 5 nov. 2026).
2. `npx prisma db seed` : comptes de test, quartiers et données de démonstration.
3. `npm run job:risk` : un premier calcul avec la vraie météo (en saison sèche : « Faible » partout, c'est normal).
4. Préparer trois onglets connectés :
   - **habitant** : `habitant.demo@banlieue-alerte.test`, abonné aux trois quartiers de démonstration ;
   - **agent** : `agent.demo@banlieue-alerte.test` ;
   - **administrateur** : `admin.demo@banlieue-alerte.test`, avec le second facteur dans l'application d'authentification.
   Le mot de passe est `SEED_TEST_PASSWORD`, dans `.env`.
5. Sur l'onglet administrateur, ouvrir `/back-office/demo` et cliquer sur « Réinitialiser la démonstration ».

## Déroulé

| Temps | Écran | Action | Message clé |
|---|---|---|---|
| 0:00 | Accueil | Montrer le bouton « Signaler », le bandeau de risque, le bouton Urgence | « Un habitant signale en moins d'une minute, sans compte. » |
| 0:30 | `/back-office/demo` (admin) | **Simuler un épisode de pluie** | « Voici une prévision de forte pluie, fictive et marquée démo. » |
| 1:00 | `/carte-risque` | Le risque en mots, puis la carte qui passe en Élevé ou Critique ; toucher une case | « Un indice indicatif, pas une probabilité : on voit pourquoi (pluie, zone basse, caniveaux). » |
| 1:45 | `/back-office/alertes` (agent) | Ouvrir le brouillon créé par l'indice, corriger le titre, **Approuver et envoyer** | « Aucune alerte ne part sans une personne qui la relit. » |
| 2:30 | Mon espace (habitant) | La notification reçue ; « Mode simulation » affiché | « Aujourd'hui en simulation ; SMS et WhatsApp viendront ensuite. » |
| 3:00 | `/carte` | Les signalements entrants (démo) | « Les habitants confirment ce que l'indice annonçait. » |
| 3:30 | Back-office (agent) | Un signalement : Vérifié → Assigné → Résolu ; `/back-office/curage` | « La mairie suit, priorise le curage et rend des comptes. » |
| 4:15 | `/qualite-indice` | L'état vide et le seuil fixé à l'avance | « Après chaque épisode, on compare l'indice au réel. On n'invente aucun chiffre. » |
| 4:45 | `/apprendre` | Un quiz | « Et on apprend les bons gestes. » |
| 5:00 | `/back-office/demo` | **Réinitialiser la démonstration** | — |

## À ne pas dire

- « L'IA prédit les inondations » : c'est un indice par règles, indicatif.
- « Les alertes sont envoyées par SMS » : elles sont en mode simulation.
- Montrer des chiffres de qualité de l'indice : il n'y en a pas encore (aucun épisode réel validé).

## En cas de problème

- Pas de réseau : la carte affiche le plan hors ligne de la zone pilote, et le signalement est gardé sur le téléphone puis envoyé au retour du réseau.
- Météo indisponible : l'indice reprend le dernier relevé et l'indique.
- Démonstration ratée : « Réinitialiser la démonstration », puis la simuler de nouveau.
