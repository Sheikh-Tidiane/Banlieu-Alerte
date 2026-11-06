# DECISIONS.md – Banlieue Alerte

Journal des décisions structurantes. **L'équipe y consigne toute décision technique ou de périmètre qui a des conséquences** : coordonnées géographiques, index, calculs de risque, gestion des fichiers, synchronisation hors ligne, choix de bibliothèques, sources de données.

Format de chaque entrée : identifiant, date, décision, raison, alternatives écartées, conséquences. Ne supprime jamais une entrée : si une décision change, ajoute une nouvelle entrée qui remplace l'ancienne et note « remplace D-xxx ».

## Décisions prises

### D-001 – Catégorie visée : Smart Territory

- **Date :** [date]
- **Décision :** présenter Banlieue Alerte dans la catégorie Smart Territory.
- **Raison :** meilleure correspondance avec les inondations, les caniveaux, les déchets et l'accès à la gare.
- **Alternatives écartées :** Intelligence & Machines (l'impact territorial est plus fort que la dimension IA).
- **Conséquences :** la catégorie figure dans l'objet de l'e-mail de candidature et dans le dossier.

### D-002 – Pilote sur 2 ou 3 quartiers

- **Date :** [date]
- **Décision :** le périmètre actif du projet est un pilote sur 2 ou 3 quartiers de la zone de Thiaroye. Le code reste générique pour permettre d'ajouter d'autres quartiers.
- **Raison :** un petit périmètre bien suivi est plus crédible qu'un département entier à moitié couvert.
- **Alternatives écartées :** couverture de tout le département dès le départ.
- **Conséquences :** quartiers définis par configuration (indicateur `pilote`) et par le script de seed. **Noms des quartiers : à confirmer** (voir « Décisions à prendre »).

### D-003 – Limites de quartier souples

- **Date :** [date]
- **Décision :** le quartier sert d'étiquette ; la position GPS reste la référence. Quartiers définis par des repères connus (marché, école, mosquée, gare) avec un rayon, contour facultatif, statut « limites approximatives » tant qu'elles ne sont pas validées. Rattachement par quartiers candidats avec correction possible. Alertes possibles par position et rayon.
- **Raison :** les limites de quartier sont souvent informelles au Sénégal.
- **Alternatives écartées :** rattachement strict par polygone officiel.
- **Conséquences :** tables `neighborhood_landmarks` et `neighborhood_aliases`, abonnements par position, état « quartier non identifié ».

### D-004 – Indice de risque par règles pondérées en version 1

- **Date :** [date]
- **Décision :** la version 1 du moteur est un indice (0 à 100) calculé par règles pondérées, transparentes et réglables. Un modèle appris est une perspective, activé seulement si les données validées le permettent.
- **Raison :** peu de données réelles disponibles ; un indice par règles est explicable ; un modèle appris avec peu d'exemples serait trompeur.
- **Alternatives écartées :** machine learning dès le départ.
- **Conséquences :** vocabulaire « indice » et non « probabilité » (voir le CDC, §1.3) ; pas de métrique de performance affichée sans épisodes validés.

### D-005 – Signalement possible sans compte

- **Date :** [date]
- **Décision :** le signalement reste possible en mode invité, avec protections anti-spam.
- **Raison :** réduire la barrière d'usage pour les habitants.
- **Alternatives écartées :** connexion obligatoire.
- **Conséquences :** limitation de débit, détection de doublons, CAPTCHA léger.

### D-006 – Notifications et messagerie en mode simulation par défaut

- **Date :** [date]
- **Décision :** les envois de SMS, de messages WhatsApp et l'USSD passent par une couche d'abstraction en mode simulation par défaut. L'envoi réel est activé par variable d'environnement explicite, et le mode actif est affiché.
- **Raison :** les intégrations réelles dépendent de comptes, de validations et d'accords à obtenir.
- **Alternatives écartées :** intégration réelle dès la Phase 4.
- **Conséquences :** le canal de messagerie est présenté comme « prévu » tant qu'il n'a pas été testé en réel.

### D-007 – Validation humaine des alertes préventives pendant le pilote

- **Date :** [date]
- **Décision :** une alerte déclenchée par le moteur de risque est un brouillon, envoyée seulement après approbation d'un agent municipal ou d'un délégué habilité. Deux types d'alertes : « officielle » et « indicative ».
- **Raison :** l'indice est expérimental ; une alerte de masse erronée peut créer de la panique ou de la défiance.
- **Alternatives écartées :** envoi automatique dès le dépassement du seuil.
- **Conséquences :** statut « en attente d'approbation », table `alert_approvals`, journalisation ; envoi automatique possible plus tard seulement par décision consignée.

### D-008 – Consolidation du cahier des charges

- **Date :** [date]
- **Décision :** le cahier des charges est un document neutre, renuméroté, avec trois niveaux de périmètre (Socle, Finale, Vision) et un tableau unique d'exigences (EXG-01 à EXG-42). Les règles de travail sont dans un document de travail interne, le design et le logo dans `docs/DESIGN_ET_MARQUE.md`, le test sur téléphone dans `docs/TEST_TELEPHONE.md`.
- **Raison :** éviter les doublons et les contradictions entre documents ; garder ce document court pour qu'il soit bien suivi.
- **Alternatives écartées :** tout garder dans un seul document, rédigé comme une liste de consignes.
- **Conséquences :** chaque règle n'existe qu'à un seul endroit ; les éléments du niveau Vision ne sont pas commencés sans accord explicite.

### D-009 – Ajustements de contenu issus de la relecture

- **Date :** [date]
- **Décisions :** (1) connexion par e-mail et mot de passe dans le Socle, le code OTP par téléphone passe en Vision ; (2) l'indice est calculé par cellule puis agrégé par quartier ; (3) suppression des points, badges et classements publics (score de fiabilité interne conservé) ; (4) mode sombre, microservice Python, alerte mobilité, contexte local, messagerie et export GeoJSON classés en Vision ; (5) positions publiques arrondies ; (6) objectifs de performance traités comme des cibles mesurées ; (7) partage WhatsApp limité aux alertes officielles ; (8) l'indice par règles n'est jamais appelé « IA ».
- **Raison :** réduire les risques de contradiction, de fausses informations et de surcharge.
- **Alternatives écartées :** conserver ces éléments au même niveau de priorité que le reste.
- **Conséquences :** voir le cahier des charges, §1.4 et §13.

### D-010 – Versions figées du socle technique

- **Date :** 2026-11-04
- **Décision :** Next.js 16.4.2 (App Router, Turbopack), React 19.3.0, TypeScript 6.0.3, Tailwind CSS 4.3.3, ESLint 9.39.5, Prisma 7.10.1, Zod 4.6.7, Vitest 4.1.12, Playwright 1.64.1, Node ≥ 22.12. Toutes les versions sont figées (`save-exact`) et publiées depuis au moins deux semaines.
- **Raison :** stabilité ; Next.js 16.4.5 était sorti la veille ; le tag `latest` de Prisma pointe vers une 8.0.0-rc ; TypeScript 7 n'est pas encore pris en charge par typescript-eslint (< 6.1).
- **Alternatives écartées :** dernières versions publiées ; ESLint 10 (plugins de eslint-config-next non garantis).
- **Conséquences :** `.npmrc` avec `save-exact=true` et `legacy-peer-deps=true` : npm 10.9 plante (`edgesOut`) en résolvant la dépendance pair facultative `@vitest/browser-playwright` de Vitest ; l'option n'installe pas les pairs facultatifs. À retirer quand npm sera corrigé.

### D-011 – Prisma 7 avec le pilote mariadb pour MySQL 8

- **Date :** 2026-11-04
- **Décision :** générateur `prisma-client` (client généré dans `src/generated/prisma`, non versionné), URL dans `prisma.config.ts`, adaptateur `@prisma/adapter-mariadb` (pilote recommandé par Prisma 7 pour MySQL). `allowPublicKeyRetrieval=true` est ajouté par `src/lib/db.ts` pour l'authentification `caching_sha2_password` de MySQL 8 sans TLS en local. Client créé au premier usage (`getPrisma()`).
- **Raison :** Prisma 7 n'embarque plus de moteur Rust : un adaptateur de pilote est obligatoire.
- **Alternatives écartées :** Prisma 6 (version précédente), Drizzle (non prévu par la stack).
- **Conséquences :** en production, utiliser une connexion TLS et un utilisateur sans droits d'administration.

### D-012 – MySQL 8.4 LTS en Docker, port hôte 3307

- **Date :** 2026-11-04
- **Décision :** image `mysql:8.4.7` via `docker-compose.yml`, liée à `127.0.0.1:3307`, utf8mb4.
- **Raison :** MySQL n'est pas installé sur le poste ; le port 3306 y est déjà occupé par un autre service.
- **Alternatives écartées :** MySQL installé localement ; port 3306.
- **Conséquences :** Docker Desktop doit être lancé pour développer ; `DATABASE_URL` pointe sur le port 3307.

### D-013 – Design tokens : variables CSS + `@theme` de Tailwind 4

- **Date :** 2026-11-04
- **Décision :** les couleurs, polices, rayons, ombres et la zone tactile (48 px) sont définis une seule fois dans `src/app/globals.css` : variables de marque, rôles sémantiques (`--surface`, `--text`…), puis `@theme inline`. Une règle ESLint interdit les couleurs hexadécimales dans `src/components` et `src/app` (sauf la page `/brand`, qui montre les logos). Composants au style shadcn/ui (cva + `cn`), écrits dans `src/components/ui`, sans Radix pour l'instant ; la modale utilise l'élément natif `<dialog>`.
- **Raison :** `docs/DESIGN_ET_MARQUE.md` §2.1 ; mode sombre (Vision) possible en redéfinissant les seuls rôles sémantiques ; zéro dépendance supplémentaire.
- **Alternatives écartées :** `tailwind.config.js` (remplacé par la configuration CSS dans Tailwind 4) ; CLI shadcn et Radix dès la Phase 1.
- **Conséquences :** Radix sera ajouté seulement pour des composants complexes (liste déroulante, menu), avec justification.

### D-014 – Coordonnées et requêtes par rayon

- **Date :** 2026-11-04
- **Décision :** `lat` et `lng` en `Decimal(9,6)` avec index composite ; recherche par rayon en deux temps : boîte englobante sur l'index, puis distance de Haversine en TypeScript (`src/lib/geo`, Phase 2).
- **Raison :** simple, testable, portable avec Prisma (qui ne gère pas les types spatiaux MySQL) et suffisant pour un pilote de quelques quartiers.
- **Alternatives écartées :** colonnes `POINT` + index spatial (requêtes brutes, moins testables).
- **Conséquences :** à revoir si le volume dépasse quelques dizaines de milliers de signalements. Les positions publiques seront arrondies côté service (EXG-39).

### D-015 – Schéma de la Phase 1 limité au Socle

- **Date :** 2026-11-04
- **Décision :** la Phase 1 crée les tables du Socle (utilisateurs, invitations, audit, abus, géographie, signalements, supervision, paramètres). Les tables Finale (alertes, abonnements, indice, météo, épisodes, curage, escalade) arrivent par migration en Phase 4. Les tables Vision ne sont pas créées (CDC §9).
- **Raison :** éviter un schéma spéculatif avant d'avoir confronté le Socle au terrain.
- **Alternatives écartées :** schéma complet dès la Phase 1.
- **Conséquences :** la colonne « niveau de risque » de `neighborhoods` est reportée en Phase 4.

### D-016 – Internationalisation sans bibliothèque

- **Date :** 2026-11-04
- **Décision :** dictionnaires TypeScript (`src/i18n/fr.ts`, `wo.ts`), clés typées, repli sur le français, test de couverture des clés (EXG-19). Le wolof est vide tant qu'aucun locuteur natif n'a relu les textes.
- **Raison :** poids client nul ; une seule langue active pour l'instant.
- **Alternatives écartées :** next-intl (utile si routage par langue ; réévalué quand le wolof arrivera).
- **Conséquences :** aucun texte d'interface dans les composants.

### D-017 – Test sur téléphone avec Next.js 16.4

- **Date :** 2026-11-04
- **Décision :** `allowedDevOrigins` est lu depuis la variable `DEV_ALLOWED_ORIGINS` (noms d'hôte séparés par des virgules, sans schéma ni port, jokers `*` et `**`). Le serveur de dev écoute déjà sur 0.0.0.0 par défaut (`npm run dev:lan` le force). HTTPS local : `next dev --experimental-https` (certificat auto-signé). Vérifié dans la documentation livrée avec Next.js 16.4.2 (`node_modules/next/dist/docs`).
- **Raison :** répond à la décision ouverte « Version de Next.js et configuration pour le test sur téléphone ».
- **Alternatives écartées :** origines codées dans `next.config.ts`.
- **Conséquences :** la géolocalisation et la caméra se testent en HTTPS (déploiement, Tailscale ou tunnel), voir `docs/TEST_TELEPHONE.md`.

### D-018 – Mots de passe hachés avec scrypt (node:crypto)

- **Date :** 2026-11-04
- **Décision :** `src/lib/auth/password.ts` hache avec scrypt (N = 2^15, r = 8, p = 1, sel de 16 octets, comparaison en temps constant), format `scrypt$N$r$p$sel$hash`. Utilisé dès la Phase 1 par le seed des comptes de test.
- **Raison :** module natif, aucune dépendance compilée (bcrypt, argon2) à installer sous Windows et Docker.
- **Alternatives écartées :** bcrypt (limite de 72 octets), argon2 (dépendance native).
- **Conséquences :** paramètres revus en Phase 3 ; le format permet de les faire évoluer sans casser les anciens hachages.

### D-019 – Données de démonstration et géographie provisoire

- **Date :** 2026-11-04
- **Décision :** le seed crée une « Commune de démonstration » (département de Pikine) et trois quartiers aux noms d'exemple du CDC §9 (Thiaroye Gare, Thiaroye sur Mer, Diamaguène), tous `isDemo`, limites « approximatives », repères nommés « Repère démo – … (fictif) » à des positions indicatives, non vérifiées. Quatre comptes de test en `.test` (domaine réservé), mot de passe lu dans `SEED_TEST_PASSWORD`.
- **Raison :** aucun nom ni limite officiels confirmés (CDC §4.5). Plusieurs de ces noms désignent peut-être des communes et non des quartiers : la hiérarchie réelle est à confirmer.
- **Alternatives écartées :** reprendre des limites ou des communes trouvées en ligne sans validation.
- **Conséquences :** à remplacer par la liste réelle du pilote et une source de repères consignée ici.

### D-020 – Logo : concept B « Goutte-signal »

- **Date :** 2026-11-04
- **Décision :** l'équipe retient le concept B, une goutte bleu eau avec une ligne d'eau, d'où partent deux ondes d'alerte (vertes sur fond clair, jaunes sur fond sombre). Le nom « Banlieue Alerte » est composé en Poppins SemiBold, « Alerte » en vert (jaune sur fond sombre).
- **Raison :** choix de l'équipe. Le concept associe directement l'eau et l'alerte, sans dramatiser.
- **Alternatives écartées :** A « Repère d'eau » et C « Toit et niveau » (conservés dans `public/brand/concepts/` et sur `/brand` pour mémoire).
- **Conséquences :** affinage pour les petites tailles (≤ 32 px) : une seule onde et des traits plus épais. Symbole recentré de 2 unités sur sa grille. Charte dans `docs/MARQUE.md`.

### D-021 – Génération des fichiers de marque (`scripts/`)

- **Date :** 2026-11-04
- **Décision :** nouveau dossier racine `scripts/`. `npm run brand` (`scripts/build-brand.ts`) assemble la géométrie du logo, écrite à la main sur une grille de 64, en variantes SVG. Il vectorise aussi le nom avec opentype.js et la police Poppins de `@fontsource/poppins`, puis rend les PNG (favicon, icônes PWA, icône Apple, image de partage) avec Chrome via Playwright. Il assemble enfin `favicon.ico`.
- **Raison :** des fichiers reproductibles, sans dessin ni recoloration à la main ; un nom vectorisé qui ne dépend pas des polices installées. Les deux dépendances ajoutées ne servent qu'au développement (aucun octet côté client).
- **Alternatives écartées :** exports manuels depuis un logiciel de dessin ; sharp ou resvg pour les PNG (dépendances natives, et Chrome est déjà utilisé par Playwright).
- **Conséquences :** opentype.js 2.0 produit des coordonnées `NaN` selon la taille demandée : les glyphes sont lus en unités de police puis mis à l'échelle par le script, qui refuse tout tracé invalide. Types minimaux dans `scripts/opentype.d.ts`.

### D-022 – Carte : Leaflet 1.9.4 et leaflet.markercluster 1.5.3, sans react-leaflet

- **Date :** 2026-11-04
- **Décision :** deux composants client chargés à la demande (`next/dynamic`, sans rendu serveur) : la carte publique (`src/components/map/reports-map.tsx`) et la petite carte du formulaire (`location-picker.tsx`). Fond OpenStreetMap avec attribution. Le socle `src/components/map/leaflet.ts` expose `L` globalement, ce dont le plugin de regroupement a besoin. Les pictogrammes des marqueurs sont les icônes de l'interface (lucide), rendues par React dans un conteneur caché puis réutilisées, pour une seule source de pictogrammes.
- **Raison :** Leaflet est léger et éprouvé ; react-leaflet n'apporte rien pour deux composants.
- **Alternatives écartées :** react-leaflet ; MapLibre (plus lourd) ; pictogrammes SVG écrits à part (incohérents avec la légende, constaté sur les captures).
- **Conséquences :** l'usage des tuiles OSM publiques reste modeste pendant le pilote ; la mise en cache hors ligne des tuiles est prévue en Finale (EXG-34).

### D-023 – Formulaire : React Hook Form 7.90.0 et @hookform/resolvers 6.0.0

- **Date :** 2026-11-04
- **Décision :** un seul schéma Zod (`src/validators/report.ts`) valide le formulaire côté client et la requête côté serveur. TanStack Query est reporté : les lectures passent par des composants serveur et de simples `fetch`.
- **Raison :** validation unique ; pas de cache client nécessaire en Phase 2.
- **Alternatives écartées :** état manuel ; TanStack Query dès maintenant.
- **Conséquences :** `useWatch` à la place de `watch()`, compatible avec le compilateur React.

### D-024 – Photos : compression navigateur, ré-encodage serveur avec sharp 0.35.5

- **Date :** 2026-11-04
- **Décision :** le navigateur redimensionne l'image à 1 600 px et la ré-encode en JPEG (`src/lib/photos/compress-client.ts`). Le serveur (`src/lib/photos/process.ts`) vérifie le vrai format par le contenu (JPEG, PNG ou WebP), refuse au-delà de 5 Mo, applique l'orientation puis ré-encode en JPEG sans aucune métadonnée. Stockage local dans `uploads/` (non versionné), derrière l'interface `PhotoStorage`. Les clés sont aléatoires et validées par une expression stricte (aucun chemin possible).
- **Raison :** EXG-13 ; volume réduit en 3G ; aucune confiance accordée au type annoncé par le client.
- **Alternatives écartées :** suppression des EXIF côté client seulement (contournable).
- **Conséquences :** stockage compatible S3 à brancher avant le déploiement. Vérifié par des tests unitaires, d'intégration et e2e sur une image contenant des EXIF.

### D-025 – Positions publiques arrondies à 3 décimales

- **Date :** 2026-11-04
- **Décision :** toute sortie publique passe par `src/services/reports/public.ts`, qui arrondit à 3 décimales (environ 110 m) et n'expose ni identifiant interne, ni auteur, ni `clientId`, ni note interne. La position exacte reste en base pour le back-office (Phase 3).
- **Raison :** EXG-39, EXG-06, CDC §11.
- **Alternatives écartées :** arrondi côté client (la donnée précise circulerait).
- **Conséquences :** le numéro de suivi sert d'identifiant public (`/signalements/BA-XXXX-XXXX`).

### D-026 – Rattachement au quartier par repères

- **Date :** 2026-11-04
- **Décision :** `src/lib/geo/resolve.ts` (code pur) calcule la distance de Haversine à chaque repère. Un quartier est candidat si la position est à moins de 1,5 fois le rayon d'un de ses repères. Le meilleur candidat est « clair » si le suivant est au moins 1,5 fois plus loin (en proportion du rayon). Sinon, l'habitant choisit en un clic. Aucun candidat : « quartier non identifié », sans erreur. Une correction n'est acceptée que vers un quartier candidat.
- **Raison :** EXG-03, D-003 ; limites de quartier informelles.
- **Alternatives écartées :** polygones (aucune limite validée).
- **Conséquences :** facteurs réglables ; à recalibrer quand les vrais repères du pilote seront connus.

### D-027 – Hors-ligne : service worker écrit à la main et file IndexedDB

- **Date :** 2026-11-04
- **Décision :** `public/sw.js` applique trois stratégies : réseau d'abord pour les pages (avec page de repli `/hors-ligne`), cache d'abord pour `/_next/static`, cache rafraîchi en arrière-plan pour les autres fichiers ; les API ne sont jamais mises en cache. À la première visite, la page envoie au service worker la liste des ressources déjà chargées (message `CACHE_URLS`), pour qu'elles soient disponibles hors ligne tout de suite. La file d'attente des signalements est stockée dans IndexedDB (**idb-keyval 6.3.0**, 600 octets). Chaque signalement porte un `clientId` qui sert de clé d'idempotence côté serveur. L'envoi est abandonné au bout de 30 s, puis retenté toutes les 15 s tant que des signalements attendent.
- **Raison :** EXG-04 ; Background Sync n'existe pas sur iOS ; les tests ont montré un envoi qui restait bloqué au retour du réseau.
- **Alternatives écartées :** Workbox ou next-pwa (dépendances lourdes, peu de contrôle).
- **Conséquences :** le module de carte du formulaire est préchargé quand le navigateur est inactif, par le même point d'import que `next/dynamic` (`load-location-picker.ts`) : Turbopack crée un fichier par point d'import.

### D-028 – Anti-spam sans service tiers

- **Date :** 2026-11-04
- **Décision :** limitation de débit en mémoire, par empreinte salée de l'IP (5 signalements par 10 min, 30 votes, 5 abus par heure) ; champ piège caché ; durée minimale de saisie de 3 s, **mesurée par le navigateur** au moment de la validation (`fillDurationMs`). Doublon : même type à moins de 50 m dans les 2 h, l'habitant se voit proposer l'existant. Vote : `voterKey` = empreinte salée d'un identifiant d'appareil aléatoire.
- **Raison :** D-005 ; pas de CAPTCHA externe (confidentialité, 3G). Mesurée côté serveur, la durée refusait à tort les envois rejoués depuis la file (constaté en test).
- **Alternatives écartées :** CAPTCHA tiers ; durée calculée à la réception.
- **Conséquences :** limiteur à déplacer en base ou Redis s'il y a plusieurs instances. `HASH_SALT` est obligatoire. `RATE_LIMIT_FACTOR` (1 par défaut) ne sert qu'aux tests automatisés.

### D-029 – Numéros d'urgence

- **Date :** 2026-11-04
- **Décision :** numéros fournis par l'équipe le 2026-11-04 et affichés en liens d'appel, dans cet ordre : 18 (Brigade nationale des sapeurs-pompiers, incendie et secours) ; 15 ou 1515 (SAMU national, urgences médicales, gratuit, à toute heure) ; 17 (Police nationale) ; 800 00 20 20 et 800 00 17 00 (lignes vertes Police nationale et Gendarmerie). Liste dans `src/lib/emergency/numbers.ts`, avec la source affichée.
- **Raison :** EXG-31.
- **Alternatives écartées :** numéros « à confirmer » sans valeur.
- **Conséquences :** toute modification est consignée ici avec sa source.

### D-030 – Numéro de suivi

- **Date :** 2026-11-04
- **Décision :** format `BA-XXXX-XXXX`, alphabet de 31 caractères sans ambiguïté (ni 0/O ni 1/I/L), tirage cryptographique. Les codes de démonstration `BA-DEMO-0001` sont acceptés en lecture.
- **Raison :** lisible au téléphone ; non devinable (environ 8,5 × 10^11 combinaisons).
- **Alternatives écartées :** identifiant interne ; numéro séquentiel (devinable).
- **Conséquences :** contrainte d'unicité en base, avec quelques essais en cas de collision.

### D-031 – Migrations en environnement non interactif

- **Date :** 2026-11-04
- **Décision :** quand `prisma migrate dev` refuse de tourner (environnement non interactif, migration avec avertissement), la migration est générée avec `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`, relue, puis appliquée avec `prisma migrate deploy`.
- **Raison :** Prisma 7 refuse les invites dans un terminal non interactif.
- **Alternatives écartées :** `db push` (pas d'historique de migration).
- **Conséquences :** procédure décrite dans le README.

### D-032 – Pool de connexions MySQL explicite

- **Date :** 2026-11-04
- **Décision :** `src/lib/db.ts` fixe `connectionLimit=10`, `connectTimeout=5000` et `acquireTimeout=20000`, sauf valeur explicite dans `DATABASE_URL`.
- **Raison :** des dépassements de délai du pool sont apparus sous forte charge en test.
- **Alternatives écartées :** valeurs implicites du pilote.
- **Conséquences :** à réévaluer au déploiement (taille du pool selon l'hébergeur).

### D-033 – Tests de parcours : 2 processus, données de test isolées

- **Date :** 2026-11-04
- **Décision :** Playwright tourne avec 2 processus. Chaque processus ne supprime que ses propres signalements, par numéro de suivi. Les captures validées de la Phase 1 ne sont régénérées que si `CAPTURE_PHASE=1`.
- **Raison :** avec 4 processus, le poste saturait : une sonde a mesuré jusqu'à 1,3 s de retard de la boucle d'événements du serveur, et des requêtes de 9 à 21 s. Un nettoyage trop large supprimait aussi les données des autres tests.
- **Alternatives écartées :** augmenter tous les délais d'attente (aurait masqué le problème).
- **Conséquences :** suite complète en 2 min environ ; 6 passages complets sans échec depuis la limitation à 2 processus (dont 2 après la dernière modification du code).

### D-034 – Sessions maison et mots de passe

- **Date :** 2026-11-04
- **Décision :** table `Session` (empreinte SHA-256 d'un jeton aléatoire de 32 octets, expiration à 30 jours glissants, glissement au plus une fois par jour) ; cookie `ba_session` `httpOnly`, `SameSite=Lax`, `Secure` en production. Mots de passe hachés avec scrypt (D-018), 10 caractères minimum. Même message pour un e-mail inconnu et un mauvais mot de passe, avec une vérification de durée équivalente. Compte bloqué ou supprimé : sessions fermées immédiatement. L'en-tête charge le compte côté client (`/api/auth/me`), pour que les pages publiques restent statiques et utilisables hors ligne.
- **Raison :** aucune dépendance ; contrôle complet ; la double authentification (EXG-41, Phase 6) s'ajoutera sur la même table.
- **Alternatives écartées :** Auth.js, better-auth (dépendances et configuration plus lourdes pour un seul mode de connexion).
- **Conséquences :** adresse e-mail non vérifiée pendant le pilote (aucun fournisseur d'e-mail) ; mot de passe oublié traité par un lien créé par un administrateur (24 h, usage unique).

### D-035 – Protection CSRF par l'en-tête Origin

- **Date :** 2026-11-04
- **Décision :** toute route qui modifie des données avec la session passe par `mutation()` (`src/lib/api/route.ts`), qui exige un en-tête `Origin` identique à l'hôte de la requête (ou à `APP_URL`). Un signalement sans compte reste accepté sans `Origin` ; il n'est rattaché au compte que si l'origine est vérifiée.
- **Raison :** défense standard, sans jeton à faire circuler dans les formulaires ; complète `SameSite=Lax`.
- **Alternatives écartées :** jeton CSRF synchronisé.
- **Conséquences :** vérifié par des tests e2e (autre origine et absence d'origine refusées).

### D-036 – Permissions et portée géographique

- **Date :** 2026-11-04
- **Décision :** politiques pures dans `src/permissions/policies.ts`, traduites en filtre Prisma par `reportScopeWhere` et appliquées à toutes les lectures du back-office. Délégué : ses quartiers. Agent : sa commune et les signalements « quartier non identifié ». Administrateur : tout. Hors portée : 403. Le back-office voit la position exacte, mais seulement s'il existe un compte auteur, jamais son identité (minimisation).
- **Raison :** EXG-05 ; une seule source de vérité.
- **Alternatives écartées :** contrôles dispersés dans les routes.
- **Conséquences :** tests unitaires des politiques et tests de refus en intégration et en e2e.

### D-037 – Transitions de statut

- **Date :** 2026-11-04
- **Décision :** graphe explicite. Nouveau → Vérifié ou Rejeté ; Vérifié → Assigné, En cours ou Rejeté ; Assigné → En cours, Résolu ou Rejeté ; En cours → Assigné, Résolu ou Rejeté ; Résolu → En cours (réouverture) ; Rejeté → Nouveau. Le délégué vérifie ou rejette seulement. Un rejet exige un motif. Assigner un signalement vérifié le fait passer à « Assigné ». Chaque action écrit l'historique et le journal dans la même transaction.
- **Raison :** EXG-07 ; pas de saut incohérent.
- **Alternatives écartées :** statut libre.
- **Conséquences :** le formulaire de statut est remonté à chaque changement, pour ne proposer que les transitions permises.

### D-038 – Fusion de doublons

- **Date :** 2026-11-04
- **Décision :** `Report.duplicateOfId`. Le doublon est rejeté avec la note « Doublon de … ». Ses votes passent au signalement principal (sans double vote d'un même appareil), et le principal gagne une confirmation de plus. La page publique du doublon redirige vers le principal.
- **Raison :** CDC §4.3.
- **Alternatives écartées :** suppression du doublon (perte d'historique).
- **Conséquences :** fusion réservée aux agents et administrateurs, dans leur portée.

### D-039 – Espace citoyen : export et suppression

- **Date :** 2026-11-04
- **Décision :** export JSON de toutes les données du compte (`GET /api/account`). La suppression, choisie par l'équipe, conserve les signalements de façon anonyme : nom remplacé par « Compte supprimé », e-mail et mot de passe effacés, auteur retiré des signalements, commentaires et votes, sessions fermées. Les comptes sensibles ne se suppriment pas eux-mêmes (traçabilité) : c'est un administrateur qui les bloque.
- **Raison :** loi sénégalaise (accès, effacement) ; signalements utiles au suivi du quartier.
- **Alternatives écartées :** suppression des signalements avec le compte.
- **Conséquences :** commentaires publics affichés sans nom d'auteur (« Habitant » ou le rôle).

### D-040 – Premier administrateur et comptes sensibles

- **Date :** 2026-11-04
- **Décision :** `npm run admin:invite -- <e-mail>` crée une invitation administrateur et affiche le lien. Invitations valables 7 jours, à usage unique (passage PENDING → ACCEPTED conditionnel, donc pas de double acceptation), une seule en attente par adresse. E-mail en mode simulation : le lien n'est affiché qu'une fois, à l'administrateur. Une invitation créée en ligne de commande est rattachée à un compte technique « Système », bloqué et sans mot de passe.
- **Raison :** EXG-33 ; aucun compte sensible par inscription libre.
- **Alternatives écartées :** administrateur créé par défaut.
- **Conséquences :** envoi réel des invitations à brancher avec un fournisseur d'e-mail (mode simulation affiché).

### D-041 – Back-office rendu côté serveur

- **Date :** 2026-11-04
- **Décision :** pages du back-office en composants serveur ; actions par routes API et `router.refresh()`. Les pages ne sont pas indexées.
- **Raison :** données sensibles filtrées côté serveur ; sobriété (DESIGN §2.2).
- **Alternatives écartées :** application client complète.
- **Conséquences :** —

### D-042 – Service worker : aucune page privée en cache

- **Date :** 2026-11-04
- **Décision :** le service worker (version v2) ne met en cache que les pages publiques (`/`, `/signaler`, `/carte`, `/urgence`, `/hors-ligne`, `/signalements/*`). Il ne met jamais en cache les réponses de navigation de Next.js (`?_rsc`), ni les pages du back-office, de l'espace personnel, de connexion ou d'invitation.
- **Raison :** les tests e2e ont montré que `router.refresh()` recevait une copie périmée en cache (liste d'invitations, statut). Ces pages contiennent en outre des données personnelles, qui resteraient sur un appareil partagé.
- **Alternatives écartées :** garder le cache et l'invalider à chaque action.
- **Conséquences :** hors ligne, une page privée affiche la page « hors ligne ».

### D-043 – Durées de conservation

- **Date :** 2026-11-04
- **Décision (proposée dans le plan de la Phase 3, validée avec lui) :** sessions expirées purgées après 30 jours ; invitations et liens de réinitialisation expirés purgés après 90 jours ; journal d'audit conservé 2 ans ; comptes supprimés anonymisés immédiatement ; signalements conservés, anonymes, pour le suivi des quartiers.
- **Raison :** minimisation, avec une traçabilité suffisante.
- **Alternatives écartées :** conservation illimitée.
- **Conséquences :** la tâche planifiée de purge est à écrire (`src/jobs/`, Phase 6) ; d'ici là, les durées sont documentées mais **pas encore appliquées automatiquement**.

### D-044 – Grille de cellules et relief SRTM

- **Date :** 2026-11-04
- **Décision :** cellules carrées de 250 m sur l'emprise des repères des quartiers pilotes, plus 500 m de marge (238 cellules pour la zone de démonstration, 209 après retrait des cases de mer, D-062). Altitude : SRTM 30 m (NASA/USGS) via l'API publique OpenTopoData, relevée le 2026-11-04, versionnée dans `prisma/data/risk-cells.json` pour que le seed et les tests fonctionnent sans réseau. Altitude relative = altitude de la cellule moins la moyenne de ses 8 voisines ; pente = plus grand dénivelé vers une voisine rapporté à la distance. Une cellule est rattachée à un quartier seulement si le résolveur (D-026) donne un candidat clair (59 cellules sur 209 depuis D-062).
- **Raison :** CDC §5.2 ; calcul hors ligne, reproductible ; source publique et citée.
- **Alternatives écartées :** fichiers SRTM bruts (outillage plus lourd) ; altitude Open-Meteo (modèle de 90 m).
- **Conséquences :** la précision verticale de SRTM est de plusieurs mètres : un écart de 1,5 m entre cellules voisines est du même ordre que l'erreur. Le facteur « zone basse » reste une hypothèse, à confronter aux inondations validées (Phase 5). Limite écrite dans `docs/METHODOLOGIE.md` et sur la page `/alertes`. Avec les vrais quartiers pilotes : `npm run risk:cells`.

### D-045 – Météo Open-Meteo, un point pour le pilote

- **Date :** 2026-11-04
- **Décision :** API Open-Meteo sans clé : pluie horaire en UTC, 3 jours passés et 3 jours de prévision, délai de 8 s. Un seul point de prévision, au centre de la grille du pilote. Chaque relevé est enregistré (`WeatherSnapshot`). En cas de panne, le dernier relevé est réutilisé, l'interface l'indique et l'erreur est inscrite dans `ErrorLog` (EXG-09). Sans aucun relevé, ou si le relevé ne couvre plus la fenêtre, les valeurs sont absentes et l'indice affiche « données limitées ». Une météo injectée (tests, futur simulateur) est marquée « démo », affichée comme telle, et n'est jamais reprise pour un calcul réel.
- **Raison :** CDC §5.2 et §5.5 ; gratuit, sans compte.
- **Alternatives écartées :** un point par commune : la résolution du modèle (plusieurs kilomètres) ne distingue pas les quartiers du pilote.
- **Conséquences :** la pluie est la même pour toutes les cellules ; ce sont le relief et les signalements qui les distinguent.

### D-046 – Grille v1, hypothèse de départ

- **Date :** 2026-11-04
- **Décision :** grille v1 seedée et marquée « hypothèse de départ ». Chaque facteur a 4 paliers (0, ⅓, ⅔, tous les points) :
  - pluie prévue sur la fenêtre : paliers à 1, 10 et 30 mm, 30 points ;
  - plus forte pluie sur 6 h : 1, 5 et 15 mm, 15 points ;
  - saturation (pluie des 72 h passées) : 5, 20 et 50 mm, 10 points ;
  - zone basse (altitude relative) : sous 0, −0,5 et −1,5 m, 20 points ;
  - pente : sous 2 %, 1 % et 0,5 %, 5 points ;
  - caniveaux et dépôts (signalements non rejetés et non fusionnés des 30 derniers jours, dans la cellule et ses voisines, pondérés faible 1, moyen 2, fort 3) : 1, 3 et 6, 15 points ;
  - historique : 5 points, **absent** jusqu'aux étiquettes validées de la Phase 5 (affiché « donnée absente »).
  Niveaux : Modéré dès 25, Élevé dès 50, Critique dès 75 (bornes basses incluses). Sans prévision de pluie, l'indice est « données limitées ».
- **Raison :** CDC §5.3 et §5.4.
- **Alternatives écartées :** —
- **Conséquences :** seuils et poids à valider avec des délégués ou un expert (ANACIM, service technique) : décision ouverte maintenue. Toute nouvelle grille est une nouvelle version (EXG-42).

### D-047 – Horizons et agrégation par quartier

- **Date :** 2026-11-04
- **Décision :** horizon 24 h = les 24 prochaines heures ; horizon 48 h = la fenêtre de +24 à +48 h (« demain »), dont la saturation ajoute la pluie prévue des 24 premières heures. Un quartier prend la valeur de **sa cellule la plus exposée** (principe de précaution), avec le nombre de cellules par niveau. Chaque exécution et chaque prédiction sont conservées (cellules et quartiers), avec la version de la grille et la date de la météo. Une prédiction est marquée `isDemo` si une de ses entrées est de démonstration (météo injectée, cellule ou signalement démo) ; ces prédictions seront exclues de toute évaluation (CDC §6).
- **Raison :** CDC §5.1 et §5.7.
- **Alternatives écartées :** moyenne des cellules (masquerait une rue basse).
- **Conséquences :** environ 950 prédictions par exécution, soit environ 7 600 par jour. Leur purge est à prévoir avec celle de D-043 (Phase 6).

### D-048 – Recalcul planifié sans dépendance

- **Date :** 2026-11-04
- **Décision :** tâche `src/jobs/risk-refresh.ts` : recalcul, puis envoi des alertes programmées arrivées à échéance. Trois déclencheurs : `npm run job:risk` (cron du système toutes les 3 heures, conteneur en Phase 6), `POST /api/jobs/risk-refresh` avec `Authorization: Bearer <CRON_SECRET>`, et le bouton « Recalculer maintenant » de l'administrateur. Les pages lisent la dernière exécution enregistrée.
- **Raison :** pas de file de messages à exploiter pour un pilote.
- **Alternatives écartées :** BullMQ et Redis ; minuterie dans le serveur Next.js (perdue au redémarrage).
- **Conséquences :** sans cron configuré, l'indice ne se met à jour que par le bouton ou le script : à brancher au déploiement.

### D-049 – Habilitations des alertes

- **Date :** 2026-11-04
- **Décision (choix de l'équipe, à confirmer avec la mairie) :**
  - alerte **officielle** : agent de la commune ou administrateur, avec un émetteur affiché obligatoire ;
  - alerte **indicative** : délégué (dans ses quartiers), agent ou administrateur ;
  - même règle pour créer, modifier, approuver et annuler, vérifiée côté serveur ;
  - le créateur d'une alerte manuelle peut l'approuver lui-même ; la décision est journalisée.
  Une alerte indicative ne peut pas reprendre le vocabulaire officiel (« officiel », « mairie », « préfecture », « protection civile »…) dans son émetteur ni dans son titre. Elle s'affiche avec un contour en pointillés, sans pictogramme officiel, avec la mention « Indicatif – ne remplace pas les alertes officielles ». Le partage WhatsApp est réservé aux alertes officielles en cours.
- **Raison :** CDC §4.6, EXG-30 ; une équipe de deux personnes.
- **Alternatives écartées :** double contrôle obligatoire ; alerte officielle réservée à l'administrateur.
- **Conséquences :** décision ouverte « Habilitations » tranchée pour le pilote.

### D-050 – Envoi après approbation

- **Date :** 2026-11-04
- **Décision :** statuts : en attente d'approbation → approuvée (envoi en cours) ou programmée → envoyée ; ou rejetée (motif obligatoire) ; ou annulée (une alerte envoyée annulée est « levée » et sa validité se termine). L'envoi n'est possible que depuis « approuvée » : la garde est dans `dispatchAlert`, testée. Chaque décision est enregistrée dans `AlertApproval` (approbateur, date, motif, champs modifiés) et dans le journal d'audit. Correspondance avec un abonnement : quartier visé, ou position de l'abonné à moins de « rayon + rayon du repère » d'un repère d'un quartier visé ; niveau de l'alerte au moins égal au seuil choisi. Les livraisons sont uniques par alerte, abonnement et canal : une reprise n'envoie rien en double. Un échec est enregistré et visible sur la fiche, sans bloquer les autres livraisons.
- **Raison :** EXG-10, EXG-29.
- **Alternatives écartées :** —
- **Conséquences :** les brouillons automatiques (indicatifs, à partir de « Élevé » à 24 h, choix de l'équipe) ne sont jamais envoyés sans décision humaine. Un seul brouillon par quartier tant qu'une alerte est en attente, programmée ou en cours.

### D-051 – Canaux de la Phase 4

- **Date :** 2026-11-04
- **Décision :** deux canaux. La notification dans l'application est réelle : elle apparaît dans « Mon espace › Mes notifications ». La notification web passe par la couche de notifications en **mode simulation** (`NOTIFICATIONS_MODE`) ; le mode est affiché partout (EXG-17). Un compte est nécessaire pour s'abonner (5 abonnements au plus) ; le signalement reste possible sans compte. La position d'un abonnement est privée, exportée avec les données du compte et supprimée avec lui.
- **Raison :** SMS et WhatsApp relèvent du niveau Vision ; aucun numéro de téléphone n'est stocké.
- **Alternatives écartées :** abonnement anonyme par téléphone (exigerait un stockage chiffré des numéros et un fournisseur).
- **Conséquences :** l'envoi web réel (clés VAPID) sera branché derrière la même couche, seulement après un test réel.

### D-052 – Plafond par temps sec

- **Date :** 2026-11-04
- **Décision :** paramètre `noRainMaxScore` de la grille (24 en v1). Par temps sec, c'est-à-dire palier 0 pour la pluie prévue, pour le pic sur 6 h **et** pour la saturation, le score est plafonné à 24 : le niveau reste « Faible ». Les facteurs du terrain restent affichés, avec la mention « Pas de pluie prévue ni de sol saturé ». Le plafond est désactivable (valeur vide) dans une nouvelle version de la grille.
- **Raison :** le premier calcul réel (4 nov., 0 mm prévu) donnait « Modéré » à deux quartiers par le seul relief et les caniveaux. Annoncer un risque d'inondation modéré un jour sec aurait été trompeur. Le cas a été constaté **avant** toute évaluation et sans résultat d'épisode (aucun n'existe) : ce n'est pas un changement de protocole après résultats (CDC §6). Première version testée : seule la pluie prévue levait le plafond. Corrigée le même jour : après 264 mm de pluie sur trois jours, un sol saturé n'est pas plafonné.
- **Alternatives écartées :** réduire les poids du relief (modifie l'hypothèse CDC §5.3 même les jours de pluie).
- **Conséquences :** testé (`tests/unit/risk.test.ts`). À valider avec l'expert en même temps que la grille.

### D-053 – Épisodes déclarés et étiquettes par case

- **Date :** 2026-11-05
- **Décision :** un épisode de pluie est déclaré par un agent ou un administrateur (début, fin), et non détecté automatiquement. La pluie observée est calculée à partir des relevés réels enregistrés qui couvrent la période ; sinon, elle est absente. Les étiquettes « inondé », « non inondé » ou « inconnu » sont posées **par case** par une personne de la portée (délégué, agent, administrateur), avec « inconnu » par défaut. Chaque modification est historisée et journalisée. Les signalements d'inondation de la période et les réponses des abonnés, agrégées par quartier, ne sont que des indices. L'épisode est validé par un agent ou un administrateur ; ses étiquettes ne sont alors plus modifiables.
- **Raison :** CDC §5.7. Une absence de signalement ne prouve pas l'absence d'inondation : une étiquette automatique fausserait l'évaluation.
- **Alternatives écartées :** détection automatique des épisodes par seuil de pluie ; étiquetage automatique à partir des signalements.
- **Conséquences :** étiquetage manuel après chaque épisode, à organiser avec les délégués.

### D-054 – Seuil et protocole de la qualité de l'indice (fixés avant tout résultat)

- **Date :** 2026-11-05, **avant** tout épisode réel
- **Décision :**
  - **seuil** (choix de l'équipe) : 5 épisodes validés, 30 étiquettes réelles « inondé » ou « non inondé », dont 5 « inondé » ; sous ce seuil, la page « Qualité de l'indice » et `GET /api/model/performance` affichent un état vide avec le décompte réel ;
  - **prédiction évaluée** : pour chaque étiquette, la dernière prédiction par case à 24 h enregistrée **avant le début** de l'épisode ;
  - **« prévu inondé »** : pour chaque modèle (M0 pluie ; M1 pluie et relief ; M2 M1 et signalements), part des points obtenus sur ses facteurs, ramenée sur 100, au moins égale au seuil « Élevé » de la grille de cette prédiction ; le plafond par temps sec s'applique ;
  - **exclusions** : étiquettes « inconnu », données de démonstration (épisodes, étiquettes, prédictions) ;
  - **indicateurs** : précision, rappel et taux de fausses alertes (part des prévisions « inondé » démenties), avec un intervalle de Wilson à 95 %.
- **Raison :** CDC §6.
- **Alternatives écartées :** seuils de 3 et 20 (trop incertain), de 10 et 60 (inatteignable avant une saison des pluies).
- **Conséquences :** tout changement de ce protocole sera consigné ici, avec sa date. Pendant le concours (saison sèche), la page restera vide.

### D-055 – Notifications dans l'application et consentement

- **Date :** 2026-11-05
- **Décision :** table `UserNotification`, pour quatre types : changement de statut, question « résolu ? », escalade, question après un épisode. Elles s'affichent dans « Mon espace » (habitants) et sur le tableau de bord (équipe). Le consentement « Me prévenir de l'avancement de mes signalements » est activé par défaut et se modifie dans le profil ; sans consentement, aucune notification d'avancement n'est créée. Aucun canal externe. La question « Le problème est-il résolu ? » n'est posée qu'à l'auteur connecté, une fois par résolution : « non » rouvre le dossier (Résolu → En cours) et prévient l'agent assigné. La page publique indique seulement « Réouvert par l'habitant », sans identité.
- **Raison :** EXG-32 ; minimisation.
- **Alternatives écartées :** notifications par e-mail (aucun fournisseur).
- **Conséquences :** un signalement sans compte se suit par son numéro, sans notification.

### D-056 – Escalade

- **Date :** 2026-11-05
- **Décision :** table `EscalationRule`. La règle la plus précise s'applique (type et gravité, puis type, puis gravité, puis règle générale). Délais choisis par l'équipe : 6 h pour une inondation forte ou une route coupée, 24 h pour une autre inondation ou une gravité forte, 72 h pour le reste. Un signalement resté « Nouveau » au-delà du délai passe à l'échelon 1 (agents de la commune, ou tous les agents si le quartier est inconnu), puis à l'échelon 2 au-delà du double (administrateurs). Les destinataires sont notifiés dans l'application. Chaque échelon n'est atteint qu'une fois (mise à jour conditionnelle). La première réponse est tout changement de statut fait par une personne. Les délais sont réglables par l'administrateur sur le tableau de bord.
- **Raison :** EXG-36.
- **Alternatives écartées :** échelon suivant configurable par règle (inutile pour trois rôles).
- **Conséquences :** le tableau de bord calcule les retards avec les mêmes règles, même sans tâche planifiée.

### D-057 – Une seule tâche planifiée

- **Date :** 2026-11-05
- **Décision :** `npm run jobs` (crontab : toutes les 15 minutes) ou `POST /api/jobs/run` avec `CRON_SECRET`. Chaque passage lance l'escalade et l'envoi des alertes programmées. L'indice n'est recalculé que si le dernier calcul réel date de plus de 3 heures. `job:risk` et le bouton de l'administrateur restent disponibles.
- **Raison :** une seule ligne de crontab à configurer au déploiement.
- **Alternatives écartées :** plusieurs tâches planifiées.
- **Conséquences :** sans cron, ni l'escalade ni le recalcul ne tournent seuls (Phase 6 : conteneur dédié).

### D-058 – Curage

- **Date :** 2026-11-05
- **Décision :** tables `CleanupOperation` et `CleanupPhoto`. La liste porte sur les caniveaux obstrués et les dépôts ouverts de la portée. Priorité = indice à 48 h de la case du signalement × poids de la gravité (1, 2, 3). Les signalements sans indice viennent après, par gravité, avec la mention « indice indisponible ». Seuls l'agent et l'administrateur planifient. Les photos avant et après suivent le même traitement que les signalements (type vérifié, EXIF retiré, ré-encodage), 4 au plus par étape. Une opération terminée peut résoudre le signalement, par les transitions autorisées. Un bandeau signale les opérations non traitées quand un quartier atteint « Élevé ».
- **Raison :** CDC §4.7.
- **Alternatives écartées :** priorité par gravité seule.
- **Conséquences :** les photos de curage partagent le stockage des photos (clés aléatoires de 128 bits, non listées publiquement).

### D-059 – Fond de plan hors ligne à partir des données OSM

- **Date :** 2026-11-05
- **Décision :** `npm run map:offline` interroge l'API Overpass (relances, trois serveurs) pour les routes et voies d'eau de l'emprise de la grille. Le script les dessine dans `public/offline/pilot-map.svg` (chemins simplifiés à 5 m et relatifs : 479 Ko, 107 Ko compressé) et écrit `pilot-map.json` (emprise, source, attribution « © contributeurs OpenStreetMap (ODbL) »). Le service worker v4 met ces fichiers en cache. Une carte affiche ce plan quand le réseau manque ou que les tuiles échouent, avec un message clair hors de la zone pilote.
- **Raison :** EXG-34. La politique d'utilisation des tuiles OSM interdit leur préchargement.
- **Alternatives écartées :** précharger les tuiles du pilote (interdit) ; héberger un serveur de tuiles (trop lourd pour le pilote).
- **Conséquences :** le plan hors ligne est une vue simplifiée, sans bâtiments ; à regénérer si la zone pilote change. Overpass est parfois saturé (constaté le 5 nov.) : relancer le script plus tard.

### D-060 – Carte de risque

- **Date :** 2026-11-05
- **Décision :** page `/carte-risque`, qui donne d'abord le risque en mots par quartier (24 h et demain), puis la carte. Chaque case est un rectangle Leaflet, avec la couleur **et** le motif du niveau : points pour faible, rayures pour modéré, croisillons pour élevé, croisillons serrés pour critique, contour en pointillés pour « données limitées ». Au clic : niveau, score indicatif, trois facteurs, date des données. API publique `GET /api/risk/cells?horizon=` : centre, niveau, score et facteurs de chaque case, aucune donnée personnelle.
- **Raison :** CDC §4.1-7 ; DESIGN §2.4.
- **Alternatives écartées :** carte de chaleur (couleur seule, illisible pour les personnes daltoniennes).
- **Conséquences :** —

### D-061 – Carte chargée à la demande sur petit écran

- **Date :** 2026-11-05
- **Décision :** sur `/carte` et `/carte-risque`, un résumé en mots précède la carte. Sous 768 px, Leaflet et les tuiles ne se chargent qu'avec le bouton « Afficher la carte ». À partir de 768 px, la carte se charge seule à l'approche de la zone visible.
- **Raison :** Lighthouse mobile de `/carte` à 48 ou 56 avant ce changement (LCP = une tuile, 6,3 à 6,9 s), 69 et 83 après. C'est aussi une économie de données mobiles pour les habitants (DESIGN §2.4).
- **Alternatives écartées :** chargement automatique à l'approche, aussi sur mobile (la carte entre dans le premier écran : aucun gain mesuré).
- **Conséquences :** sur mobile, un appui de plus pour voir la carte. L'écart restant avec 90 vient du socle JavaScript commun ; traité en Phase 6.

### D-062 – Cases de mer retirées de la grille

- **Date :** 2026-11-05
- **Décision :** les cases dont l'altitude SRTM vaut 0 m (surface d'eau) sont retirées avant le calcul du relief : 29 sur 238, il en reste 209. Une altitude absente n'est pas assimilée à la mer.
- **Raison :** les captures de la carte de risque montraient un indice « faible » sur la mer, et la mer faisait paraître les cases côtières plus hautes que leurs voisines.
- **Alternatives écartées :** garder ces cases avec la mention « mer » (aucun intérêt pour les habitants).
- **Conséquences :** 8 cases côtières rattachées à un quartier ont disparu ; à revoir avec les vrais quartiers du pilote.

### D-063 – Simulateur de démonstration

- **Date :** 2026-11-05
- **Décision :** le simulateur n'existe que si `DEMO_MODE=true`, et seulement pour un administrateur. Sinon, `/api/demo/*` et `/back-office/demo` répondent 404. Un bandeau « Mode démonstration » s'affiche alors sur toutes les pages. « Simuler un épisode de pluie » :
  - injecte une pluie fictive (6 mm/h sur 24 h), marquée « démo » ;
  - recalcule l'indice (déclencheur `demo`), ce qui crée les brouillons d'alerte indicative ;
  - crée 8 signalements « démo » rattachés à l'exécution (`Report.simulationRunId`).
  « Réinitialiser » supprime exactement ces données (alertes de l'exécution, signalements, exécution, relevé). La tâche planifiée n'écrase pas une démonstration de moins de 2 h. Les brouillons restent à approuver par une personne. L'habitant de démonstration est abonné aux trois quartiers démo, pour recevoir la notification quel que soit le brouillon approuvé.
- **Raison :** CDC §1.3, §4.4 et §14.
- **Alternatives écartées :** envoi automatique pendant la démonstration (contraire à la règle d'approbation humaine).
- **Conséquences :** scénario de 5 minutes dans `docs/DEMO.md`, rejoué par les API le 5 nov.

### D-064 – Second facteur de l'administrateur

- **Date :** 2026-11-05
- **Décision (choix de l'équipe) :** application d'authentification (TOTP, RFC 6238), avec enrôlement par QR code.
  - L'algorithme est écrit avec `node:crypto` et testé sur les vecteurs officiels. Seule dépendance ajoutée : `qrcode` 1.5.4, côté serveur.
  - Le secret est chiffré en AES-256-GCM (clé `TOTP_ENCRYPTION_KEY`). Fenêtre de ±30 s ; une période déjà utilisée est refusée (pas de rejeu).
  - 8 codes de secours à usage unique, stockés hachés.
  - La vérification est enregistrée par session (`Session.mfaVerifiedAt`). Sans elle, un administrateur n'a aucun droit sur les routes et pages d'équipe : 403 pour les API, redirection vers `/connexion/second-facteur` pour les pages. Un administrateur non enrôlé est enrôlé à sa première connexion.
  - `npm run admin:reset-mfa` sert en cas de perte du téléphone. Chaque étape est journalisée.
- **Raison :** EXG-41.
- **Alternatives écartées :** code par e-mail ou SMS (aucun fournisseur) ; bibliothèque TOTP tierce (dépendance évitable).
- **Conséquences :** l'administrateur de démonstration est enrôlé avec le secret de test `SEED_TEST_TOTP_SECRET` (`.env`). Les tests calculent le code eux-mêmes.

### D-065 – Purge, supervision et tâche planifiée

- **Date :** 2026-11-05
- **Décision :**
  - **purge quotidienne** dans `npm run jobs` : sessions expirées depuis 30 jours ; invitations et réinitialisations expirées depuis 90 jours ; audit de plus de 2 ans ; erreurs, notifications lues, prédictions par case et relevés météo non utilisés de plus de 180 jours ; exécutions de tâches de plus de 90 jours. Les prédictions par quartier sont conservées.
  - **supervision** : chaque exécution est enregistrée (`JobRun`). `/api/health` et `/back-office/supervision` montrent la base, la fraîcheur de l'indice (6 h), la dernière tâche (1 h), les erreurs météo et les échecs d'envoi sur 24 h.
  - **erreurs inattendues** des API et des tâches : journalisées après masquage des e-mails, numéros, positions et jetons.
  - **installation neuve** : la tâche crée la grille v1 et les délais d'escalade s'ils manquent. L'absence de grille de cases n'arrête pas la tâche : l'erreur est journalisée et visible.
- **Raison :** D-043 ; EXG-37 ; défaut constaté au premier démarrage Docker sur une base neuve (« Aucune grille de règles active »).
- **Alternatives écartées :** —
- **Conséquences :** —

### D-066 – En-têtes de sécurité

- **Date :** 2026-11-05
- **Décision :** en production, une CSP restreint tout au site lui-même, avec trois exceptions : les tuiles OpenStreetMap, les images `data:` et `blob:` (QR code, aperçus), et les styles en ligne exigés par Leaflet. `object-src 'none'`, `frame-ancestors 'none'`, aucun `unsafe-eval`. Les scripts gardent `unsafe-inline` : une CSP à nonce imposerait un rendu dynamique de toutes les pages, y compris `/signaler`, utilisée hors ligne. HSTS d'un an. Les en-têtes existants sont conservés.
- **Raison :** CDC §11 (OWASP A05).
- **Alternatives écartées :** CSP à nonce (perte du rendu statique et de l'usage hors ligne) ; `upgrade-insecure-requests` (casse le serveur local en HTTP ; HSTS et Caddy suffisent).
- **Conséquences :** vérifié dans le navigateur (carte, tuiles, marqueurs) et par test e2e. Zod v4 testait `new Function` au chargement du formulaire, ce qui provoquait une violation signalée par Chrome (Lighthouse : bonnes pratiques 96 sur `/signaler`). Corrigé par `z.config({ jitless: true })` : plus aucune violation sur les sept pages principales, bonnes pratiques à 100.

### D-067 – Production Docker et HTTPS

- **Date :** 2026-11-05
- **Décision (choix de l'équipe pour Caddy) :**
  - `Dockerfile` multi-étapes : cible `runner` (Next.js autonome, Node 22.21.1 Alpine, utilisateur non root, sonde de santé) et cible `tools` (sources et dépendances, pour les migrations et la tâche planifiée) ;
  - `docker-compose.prod.yml` : `db` (MySQL 8.4.7), `migrate` (s'exécute puis s'arrête), `app`, `jobs` (toutes les 15 min), `caddy` (2.10.2, HTTPS automatique pour `DOMAIN`, ports configurables) ;
  - volumes pour la base, les photos et les certificats.
- **Raison :** CDC §8 (Docker) ; HTTPS nécessaire pour le test sur téléphone et la démonstration.
- **Alternatives écartées :** HTTPS fourni par l'hébergeur (non choisi).
- **Conséquences :** vérifié en local le 5 nov. sur une base neuve : migrations appliquées, application saine, HTTPS 200 par Caddy (certificat interne, `DOMAIN=localhost`), en-têtes présents. Le certificat public ne se vérifiera qu'avec un vrai domaine.

### D-068 – Performance : décalages de mise en page et JavaScript

- **Date :** 2026-11-05
- **Décision :**
  - le bandeau du tutoriel devient une carte flottante, qui ne décale plus l'accueil (CLS 0,22 → 0) ;
  - le résumé de `/carte` garde sa place pendant le chargement (CLS 0,24 → 0,01) ;
  - les constantes des signalements passent dans un module sans Zod, ce qui retire 31 Ko compressés de `/carte`.
- **Raison :** mesures Lighthouse de la Phase 6 ; le reste du JavaScript commun est le socle React et Next.js (environ 117 Ko compressés, irréductibles sans changer de cadre).
- **Alternatives écartées :** —
- **Conséquences :** les scores varient de 10 à 15 points d'une mesure à l'autre sur le poste de développement. Les fourchettes mesurées sont consignées dans `PROGRESS.md`. La supervision a aussi relevé, sous forte charge pendant les tests, un délai d'attente du pool MySQL et une transaction au-delà de 5 s : le délai des transactions Prisma passe à 15 s (attente d'une connexion : 10 s), dans `src/lib/db.ts`.

### D-069 – Éléments Vision : photos, doublons visuels, carte des ouvrages

- **Date :** 2026-11-05
- **Décision (demande de l'équipe) :** trois éléments sont ajoutés au cahier des charges (§4.9, exigences EXG-43 à EXG-47) et classés au niveau **Vision** :
  - suggestion du type de problème à partir de la photo, avec niveau de confiance, toujours validée par un délégué ;
  - détection de doublons visuels par empreinte de photo, qui marque le signalement « à vérifier » sans rejet automatique ;
  - carte participative des caniveaux et ouvrages de drainage, saisie par les rôles habilités et reliée à la liste de curage.
  Ils ne sont **pas commencés sans l'accord explicite de l'équipe**. Aucun code ni schéma n'est modifié à ce stade.
- **Raison :** perspectives à présenter au jury sans compromettre le parcours citoyen (CDC §1.3) ni la confidentialité des photos (CDC §11).
- **Alternatives écartées :** les intégrer à la Finale (calendrier du 15 nov. et du 13 déc. ; besoin d'étiquettes validées qui n'existent pas encore).
- **Conséquences :** avant toute mise en œuvre : décision consignée si une photo devait quitter le serveur du projet ; seuil minimal d'étiquettes et protocole d'évaluation fixés à l'avance (même rigueur que D-054) ; évaluation sur jeu de test séparé, données de démonstration exclues.

### D-070 – Premiers quartiers réels du pilote (Thiaroye-sur-Mer)

- **Date :** 2026-11-05
- **Décision (demande de l'équipe) :** création, par le back-office (fonctions `createCommune` et `createNeighborhood`, avec journal d'audit), de la commune **Thiaroye-sur-Mer** (département de Pikine) et de trois quartiers marqués « pilote », limites « approximatives », non démo : **Santhiaba**, **Gassama**, **Thiaw**.
- **Source :** noms fournis par l'équipe le 5 nov. 2026 (CDC §4.5). Aucun repère ni contour n'a été saisi : aucune position n'a été inventée.
- **Raison :** préparer le pilote et le dossier de candidature.
- **Alternatives écartées :** ajouter ces quartiers au script de données (`prisma/seed.ts`), en attendant leurs repères et la confirmation de leurs limites.
- **Conséquences :**
  - créés seulement dans la base locale du poste de développement : à refaire sur le serveur en ligne (back-office, page « Zones et quartiers ») ;
  - sans repère, aucun signalement n'y est rattaché automatiquement : il faut saisir au moins un repère (nom, position, rayon, source) par quartier ;
  - les trois quartiers de démonstration restent en place, marqués comme tels.

## Décisions à prendre

| Sujet                                                                                                 | Pourquoi c'est nécessaire                                         | Qui décide                                    | Échéance                  |
| ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------- | ------------------------- |
| ~~Noms des quartiers du pilote~~ : **en partie tranché par D-070** (Santhiaba, Gassama, Thiaw ; repères et limites à fournir) | Seed, dossier, test de terrain | Équipe + contact local | Fait (2026-11-05) |
| Source des repères et limites de quartiers                                                            | Rattachement automatique                                          | Équipe                                        | [date]                    |
| ~~Seuil minimal d'épisodes et d'étiquettes validés avant d'afficher des indicateurs~~ : **tranché par D-054**, avant tout résultat | Rigueur de l'évaluation | Équipe | Fait (2026-11-05) |
| Fournisseur SMS / WhatsApp / USSD (ou maintien de la simulation)                                      | Canal de messagerie                                               | Équipe                                        | [date]                    |
| Hébergement de la version en ligne (HTTPS)                                                            | Démo, vidéo, tests sur téléphone                                  | Équipe                                        | [date]                    |
| ~~Version de Next.js et configuration pour le test sur téléphone~~ : **tranché par D-010 et D-017** | `docs/TEST_TELEPHONE.md` | Équipe technique | Fait (2026-11-04) |
| ~~Modèle d'authentification~~ : **tranché par D-034** (e-mail et mot de passe ; OTP en Vision) | Phase 3 | Équipe | Fait (2026-11-04) |
| ~~Choix du logo parmi les trois concepts proposés~~ : **tranché par D-020** (concept B) | Identité de marque, vidéo, dossier | Équipe | Fait (2026-11-04) |
| ~~Numéros d'urgence officiels à afficher~~ : **tranché par D-029** (fournis par l'équipe) | Sécurité des habitants | Équipe | Fait (2026-11-04) |
| ~~Délais cibles de première réponse par type et gravité~~ : **tranché pour le pilote par D-056** (à confirmer avec la mairie) | Escalade | Équipe + mairie | Fait (2026-11-05) |
| ~~Habilitations : qui peut approuver et émettre quel type d'alerte~~ : **tranché pour le pilote par D-049** (à confirmer avec la mairie) | Alertes officielles et indicatives | Équipe + mairie | Fait (2026-11-04) |
| Grille de règles : seuils de pluie en mm, poids et plafond par temps sec, à valider avec des délégués ou un expert (hypothèse v1 consignée en D-046 et D-052) | Indice de risque | Équipe + expert local | Avant la finale |
| ~~Durées de conservation des données personnelles~~ : **tranché par D-043** (purge automatique à écrire en Phase 6) | Confidentialité | Équipe | Fait (2026-11-04) |
| Relecture du contenu « Apprendre » (conseils, quiz) par l'équipe, et si possible par la protection civile ou l'ONAS | Exactitude des conseils de sécurité | Équipe | Avant l'ouverture au public |
| Déclaration éventuelle auprès de l'autorité de protection des données                                 | Cadre juridique                                                   | Équipe                                        | Avant ouverture au public |

## Modèle pour une nouvelle décision

```
### D-0xx – Titre court
- **Date :** AAAA-MM-JJ
- **Décision :** ce qui a été décidé.
- **Raison :** pourquoi.
- **Alternatives écartées :** et pourquoi.
- **Conséquences :** ce que cela change dans le code, les données, les documents.
- **Remplace :** D-0yy (si applicable)
```
