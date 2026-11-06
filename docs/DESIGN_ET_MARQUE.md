# Design et marque – Banlieue Alerte

Document de référence pour l'interface et l'identité visuelle. Il complète `docs/CAHIER_DES_CHARGES.md` (§7). À lire **avant toute tâche d'interface** et avant la création du logo.

Le jury juge d'abord ce qu'il voit à l'écran : l'interface doit être **élégante, professionnelle et cohérente**, pas seulement fonctionnelle.

## 1. Design system

**Ton :** moderne, rassurant, institutionnel mais proche des habitants. Inspiré de l'identité Banlieue Smart Days (vert, jaune), avec des accents bleu eau pour le thème « inondation ».

**Palette**

- Vert principal `#1B5E20` (actions, identité), vert clair `#2E7D32`
- Jaune accent `#F9B72B` (mise en avant, boutons secondaires)
- Bleu eau `#0B6FA4` (inondations, météo)
- Rouge alerte `#D32F2F`, orange vigilance `#F57C00`, vert sécurité `#388E3C`
- Neutres : fond `#F7F9F7`, texte `#14211A`, bordures `#DDE5DE`
- **Niveaux de risque :** Faible (vert), Modéré (jaune), Élevé (orange), Critique (rouge), toujours accompagnés d'une icône et d'un texte, jamais la couleur seule.

**Typographie :** Poppins pour les titres, Inter pour le texte. Échelle claire, lisibilité maximale sur petit écran.

**Composants :** cartes à coins arrondis (12 à 16 px), ombres douces, boutons larges et tactiles (au moins 48 px), badges de statut, timeline, toasts, modales, skeletons de chargement, états vides illustrés, formulaires avec validation claire.

**Principes**

- **Mobile d'abord**, puis tablette et ordinateur. Le mode sombre est une perspective (niveau Vision) : conçois les couleurs avec des variables pour qu'il soit facile à ajouter.
- **Accessibilité WCAG AA :** contrastes, navigation au clavier, étiquettes ARIA, textes alternatifs, zones tactiles.
- **Faible bande passante :** pages légères, images optimisées, chargement progressif.
- Micro-animations sobres et respect de `prefers-reduced-motion`.
- Pictogrammes simples, compréhensibles même sans lecture (goutte d'eau, caniveau, poubelle, alerte).

## 2. Finition visuelle

Le jury juge d'abord ce qu'il voit à l'écran : l'interface doit être **élégante, professionnelle et cohérente**, pas seulement fonctionnelle.

### 2.1. Règles de mise en œuvre

- **Design tokens centralisés** : couleurs, polices, espacements, rayons et ombres sont définis une seule fois (`tailwind.config` et variables CSS). Aucune couleur, police ou taille codée en dur dans un composant.
- **Composants réutilisables** : boutons, cartes, badges de risque et de statut, champs de formulaire, états vides, skeletons, toasts et modales sont créés une fois et utilisés partout, pour garder une interface cohérente d'une page à l'autre.
- **Pas d'apparence « par défaut »** : personnalise les composants shadcn/ui avec l'identité du projet (vert et jaune de Banlieue Smart Days, bleu eau pour le thème inondation, Poppins pour les titres, Inter pour le texte, coins arrondis de 12 à 16 px, ombres douces).
- **Hiérarchie visuelle claire** : une action principale par écran, titres cohérents, espacement régulier (échelle de 4 et 8 px), textes courts, pictogrammes accompagnés de mots.
- **Tous les états sont dessinés** : chargement (skeleton), liste vide (illustrée), erreur, succès, hors-ligne, synchronisation en attente.
- **Mobile d'abord**, avec un mode clair soigné.
- **Micro-animations sobres** (transitions, apparition des alertes) et respect de `prefers-reduced-motion`.

### 2.2. Priorités de finition

Soigne en premier ce que le jury verra : la **page d'accueil**, le **parcours de signalement**, la **carte**, la **carte de risque prévisionnel** et le **scénario de démonstration**. Le back-office peut être plus sobre, mais reste propre et cohérent.

### 2.3. Vérification visuelle

« C'est joli » n'est pas une vérification. À la fin de chaque phase qui modifie l'interface :

- génère avec Playwright des **captures d'écran des pages principales à 375 px et à 1280 px**, rangées dans `docs/screenshots/phase-N/` ;
- contrôle toi-même : contrastes, alignements, cohérence des composants, absence de défilement horizontal, textes tronqués ou chevauchés, images déformées ;
- signale ce que tu as repéré et corrigé, et ce qui reste à améliorer.

Je valide visuellement ces captures avant de passer à la phase suivante.

### 2.4. Couleurs de risque et accessibilité des cartes

- Les niveaux de risque (Faible, Modéré, Élevé, Critique) sont toujours indiqués par une couleur **et** une icône ou un texte, jamais par la couleur seule.
- Sur la carte, ajoute aux couleurs des **motifs (hachures) ou des symboles** pour les personnes daltoniennes.
- Décris le risque **en mots avant la carte** (par exemple « Risque élevé dans votre quartier demain »), avec un lien ou un bouton « Voir la carte ».

### 2.5. Références d'inspiration

Étudie les **principes** de ces plateformes. Ne copie ni leur code, ni leurs visuels, ni leurs marques.

| Référence                                                                                                                                  | Ce qu'on en retient                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **FixMyStreet** (mySociety), `fixmystreet.com`                                                                                             | Signalement rapide sur mobile : partir de la position actuelle de l'utilisateur plutôt que de lui demander de pointer une carte, et prévoir qu'il puisse être interrompu en cours de saisie. Rapport = description + position + photo facultative. |
| **SeeClickFix**                                                                                                                            | Signalements publics et visibles, voisins et services alertés : la transparence du traitement renforce la confiance.                                                                                                                               |
| **Service « flood map » du gouvernement britannique** (blog `defradigital.blog.gov.uk`, article « Designing a more accessible flood map ») | Décrire le risque en mots avant toute carte, lien « voir la carte de la zone », zones représentées par des hachures différenciables et non par la couleur seule.                                                                                   |
| **Meteoalarm** (`meteoalarm.info`)                                                                                                         | Palette de niveaux de danger éprouvée, à associer à des symboles pour les personnes daltoniennes.                                                                                                                                                  |
| **Ushahidi** (né au Kenya)                                                                                                                 | Carte et chronologie, abonnement aux alertes par proximité, signalement par SMS. Son interface est jugée moins soignée que les plateformes récentes : on s'en inspire pour les fonctions, pas pour le style visuel.                                |
| **Conseils UX des applications de gestion de crise** (Intersec)                                                                            | Clarté immédiate en situation de stress, éléments d'interface cohérents, aide contextuelle courte.                                                                                                                                                 |

Si une maquette ou une capture est fournie pour le projet, elle **prime** sur ces références.

## 3. Logo et identité de marque

Le logo est créé **en Phase 1**, avec le design system. Règles à respecter :

- **Qualité visée :** original, élégant, très professionnel, mémorable, lisible à 16 pixels. Il doit donner une impression de sérieux et de confiance dès le premier regard.
- **Méthode :** dessine le logo en **SVG écrit à la main** (formes géométriques construites sur une grille), jamais en image générée ni en bitmap. Propose **trois concepts nettement différents** sur la page `/brand` (fonds clair et sombre, plusieurs tailles), puis **attends mon choix** avant d'affiner. Ne passe pas à une autre phase sans validation du logo.
- **Concept :** eau (goutte), localisation (repère) et alerte (ondes ou signal), de façon sobre. Évite les détails fins, les dégradés complexes, les effets, les clichés et toute ressemblance avec une marque existante.
- **Couleurs :** celles du design système, trois au maximum plus un neutre, contraste WCAG AA sur fonds clair et sombre.
- **Variantes et fichiers :** horizontale, verticale, symbole seul, monochrome noir, monochrome blanc, favicon, icônes PWA (192, 512 et maskable), icône Apple et image de partage, dans `public/brand/`. Le manifeste de la PWA référence les icônes.
- **Charte :** `docs/MARQUE.md` (couleurs, typographie, variantes, marges, tailles minimales, usages interdits).
- **Usage :** le logo vient toujours de `public/brand/` ; ne le redessine, ne l'étire ni ne le recolore jamais à la main.
- **Vérification :** captures de la page `/brand` à 375 px et à 1280 px, sur fonds clair et sombre, et captures du symbole à 16, 32, 192 et 512 pixels, dans `docs/screenshots/phase-1/`.
- **Décision :** consigne le choix final et ses raisons dans `docs/DECISIONS.md`. Une image générée par IA n'est jamais utilisée comme logo final sans mon accord explicite.
