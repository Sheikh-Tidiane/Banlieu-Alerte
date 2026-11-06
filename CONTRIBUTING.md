# Contribuer à Banlieue Alerte

Ce guide s'adresse aux jeunes développeuses et développeurs qui découvrent le projet (CDC §4.8). Bienvenue !

## Comprendre le projet en 10 minutes

1. Lire le `README.md` (installation) et `docs/ARCHITECTURE.md` (schéma).
2. Lancer l'application : `npm run db:up`, `npx prisma migrate deploy`, `npx prisma db seed`, puis `npm run dev`.
3. Suivre le parcours d'un signalement :
   - le formulaire : `src/components/report-form/` ;
   - l'API : `src/app/api/reports/route.ts` ;
   - la logique métier : `src/services/reports/create.ts` ;
   - la base : `prisma/schema.prisma`.

## Règles du projet

- **Logique métier** dans `src/services/` et `src/lib/`, **jamais** dans les composants.
- **Toute entrée** d'API est validée par un schéma Zod (`src/validators/`), et **toute permission** est vérifiée côté serveur (`src/permissions/`).
- **Textes de l'interface** dans `src/i18n/fr.ts`, jamais écrits en dur. Pas de traduction automatique pour le wolof : un locuteur natif relit.
- **Noms** de fichiers et de variables en anglais ; **commentaires** en français.
- **Pas de fonction factice** : un bouton fait quelque chose de vérifiable ; un service non branché affiche « mode simulation ».
- **Vocabulaire** : l'indice de risque est un « indice indicatif », jamais une « probabilité » ni de « l'IA ».
- **Données de démonstration** toujours marquées `isDemo` et signalées à l'écran.

## Avant de proposer une modification

```bash
npm run lint && npm run format:check && npm run typecheck
npm run test        # tests unitaires
npm run test:db     # tests avec la base (après le seed)
npm run test:e2e    # parcours dans le navigateur
```

- Ajouter un test pour chaque règle métier, et un test de refus pour chaque nouvelle route sensible.
- Consigner toute décision structurante dans `docs/DECISIONS.md` (date, décision, raison, alternatives, conséquences).
- Faire de petits commits explicites (`feat:`, `fix:`, `docs:`, `test:`).

## Bonnes premières contributions

- Relire et améliorer le contenu de la page « Apprendre » (`src/i18n/fr.ts`, bloc `learn`).
- Ajouter un repère de quartier vérifié, avec sa source, depuis le back-office (Zones et quartiers).
- Proposer une traduction wolof relue par un locuteur natif (`src/i18n/wo.ts`).
- Écrire un test pour un cas limite de l'indice (`tests/unit/risk.test.ts`).

## Sécurité

Ne jamais mettre de secret dans le code ni de vraie donnée personnelle dans les jeux de test. Pour signaler une faille, écrire à l'équipe plutôt que d'ouvrir une demande publique. Voir `docs/SECURITE.md`.
