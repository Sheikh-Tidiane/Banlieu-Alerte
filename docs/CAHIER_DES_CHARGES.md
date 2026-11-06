# Cahier des charges – Banlieue Alerte

**Version :** 2 (consolidée) · **Statut :** référence du produit à construire.
Ce document dit **ce qu'il faut construire**. Les règles de travail (phases, validation, tests, fiabilité) sont propres à l'équipe et ne sont pas publiées. Le design et le logo sont dans `docs/DESIGN_ET_MARQUE.md`. Le suivi est dans `docs/PROGRESS.md` et `docs/DECISIONS.md`.

---

## 1. Contexte, objectifs et périmètre

### 1.1 Contexte

Chaque saison des pluies, des quartiers de Thiaroye et du département de Pikine (Sénégal) sont exposés aux inondations. Les habitants n'ont ni information préventive fiable, ni moyen simple de faire remonter ce qu'ils vivent ; les services n'ont pas de vue d'ensemble pour intervenir au bon endroit.

Le projet est présenté au concours **Banlieue Smart Genius** (catégorie Smart Territory), jugé sur : innovation et originalité, pertinence locale et utilité sociale, faisabilité technique, qualité de la présentation, transmission et implication pédagogique.

### 1.2 Objectif

**Banlieue Alerte** est une plateforme web progressive (PWA) de **signalement collaboratif, de suivi et d'alerte** pour les inondations et les problèmes d'assainissement. Elle repose sur une boucle :

1. **Prédire** : un indice de risque par zone, calculé avant la pluie (pluie prévue, relief, historique, état des caniveaux).
2. **Alerter** : les habitants des zones à risque reçoivent une alerte (après validation humaine), avec des conseils.
3. **Signaler** : pendant et après la pluie, les habitants signalent ce qui se passe réellement.
4. **Apprendre** : les signalements validés servent à comparer l'indice au réel et à l'ajuster.

Deux modules complètent la boucle : la **prévention à la source** (caniveaux et déchets) et, plus tard, l'**alerte mobilité** (routes et accès à la gare).

### 1.3 Principes directeurs

- **Honnêteté :** l'indice est indicatif ; aucune performance n'est affichée sans données réelles validées ; les données de démonstration sont toujours marquées comme fictives.
- **Pensé pour le terrain :** mobile d'abord, connexion faible, signalement possible sans compte, saisie hors-ligne, quartiers aux limites souples, français avec structure prête pour le wolof.
- **Un humain dans la boucle :** une alerte préventive n'est envoyée qu'après approbation ; les rôles sensibles se créent par invitation.
- **Sécurité des personnes d'abord :** l'application ne remplace jamais les secours.
- **Fonctionnel avant spectaculaire :** chaque fonction annoncée doit réellement fonctionner de bout en bout.

### 1.4 Niveaux de périmètre

| Niveau                                                  | Contenu                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Socle** (doit fonctionner de bout en bout en premier) | Parcours de signalement sans compte ; carte ; détail et confirmation par un voisin ; back-office de traitement (statuts, historique, assignation) ; rattachement au quartier (candidats, correction) ; connexion e-mail et mot de passe ; comptes sensibles par invitation ; message de sécurité et bouton Urgence ; PWA avec saisie hors-ligne ; protections anti-spam ; données de démonstration ; design system et logo                                            |
| **Finale** (ce qui rend le projet distinctif)           | Indice de risque version 1 et carte de risque prévisionnel ; alertes avec validation humaine, abonnements, mode simulation ; simulateur d'épisode de pluie ; retour au citoyen ; enregistrement des indices et étiquettes « inondé / non inondé » validées ; liste de curage prioritaire ; statistiques par quartier ; escalade des signalements ; supervision technique ; cartes hors-ligne de la zone pilote ; module « Apprendre » ; tutoriel de premier lancement |
| **Vision** (perspectives, après validation du reste)    | Canal WhatsApp, SMS et USSD ; connexion par code OTP ; alertes vocales ; couches de contexte local (marées, nappe, sol, drainage) ; alerte mobilité ; modèle appris et pipeline d'apprentissage ; microservice Python ; export de données ouvertes (GeoJSON) ; rapports PDF automatiques ; mode sombre                                                                                                                                                                |

Aucune fonction du niveau « Vision » n'est présentée comme disponible tant qu'elle n'a pas été réalisée et vérifiée.

---

## 2. Glossaire

| Terme                 | Définition                                                                                                       |
| --------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Signalement**       | Information envoyée par un habitant sur un problème (inondation, caniveau bouché, dépôt d'ordures, route coupée) |
| **Quartier**          | Zone de référence affichée aux habitants ; une étiquette, la position GPS restant la référence                   |
| **Repère**            | Lieu connu (marché, école, mosquée, gare) avec une position et un rayon, qui définit un quartier                 |
| **Cellule**           | Carré de 100 à 250 m sur lequel l'indice de risque est calculé                                                   |
| **Indice de risque**  | Score de 0 à 100 calculé par règles pondérées, par cellule, agrégé par quartier ; indicatif                      |
| **Probabilité**       | Réservée à un éventuel modèle appris ; jamais utilisée pour l'indice par règles                                  |
| **Épisode**           | Événement de pluie, borné dans le temps                                                                          |
| **Étiquette**         | Résultat « inondé / non inondé » d'une cellule pour un épisode, validé par un délégué                            |
| **Alerte officielle** | Alerte émise ou validée par la mairie ou la protection civile, avec émetteur indiqué                             |
| **Alerte indicative** | Alerte issue de l'indice ou de la communauté, étiquetée « indicatif, ne remplace pas les alertes officielles »   |
| **Pilote**            | Les 2 ou 3 quartiers où la plateforme est réellement testée                                                      |
| **Mode simulation**   | Mode où les envois (SMS, WhatsApp, notifications) sont journalisés sans être envoyés                             |

---

## 3. Utilisateurs et rôles

| Rôle                                      | Description                                                                                                                                 | Création du compte                             |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| **Citoyen**                               | Habitant de la banlieue, souvent sur mobile et avec une connexion limitée. Peut signaler sans compte (mode invité limité) ou avec un compte | Libre (e-mail et mot de passe) ou aucun compte |
| **Délégué de quartier**                   | Vérifie et suit les signalements de son quartier ; valide les étiquettes ; peut approuver des alertes s'il est habilité                     | Invitation uniquement                          |
| **Agent municipal / services techniques** | Traite, assigne et clôture les signalements ; émet et approuve des alertes selon ses habilitations                                          | Invitation uniquement                          |
| **Administrateur**                        | Gère utilisateurs, invitations, zones, paramètres, modération, grille de règles                                                             | Invitation uniquement, double authentification |

Les permissions (RBAC) sont contrôlées **côté serveur** à chaque opération sensible, avec une **portée géographique** : citoyen (ses signalements et les signalements publics), délégué (son quartier), agent (sa commune), administrateur (tout le périmètre).

---

## 4. Fonctionnalités

### 4.1 Pages publiques

1. **Accueil** : bouton « Signaler un problème » très visible ; bandeau du niveau de risque de la zone et météo sur 48 h (niveau Finale) ; chiffres issus des données réelles uniquement (état vide sinon) ; derniers signalements ; « comment ça marche » en 3 étapes ; appel à l'abonnement ; témoignages **réels et avec accord** uniquement.
2. **Carte interactive** : signalements filtrables (type, statut, gravité, période, quartier) ; clustering ; géolocalisation ; recherche de quartier avec alias ; légende ; fiche rapide ; plein écran. Positions publiques **arrondies** (voir §11).
3. **Signaler un problème** (3 étapes, moins de 60 secondes) : (1) type ; (2) position GPS automatique avec ajustement manuel, proposition du quartier corrigeable, photo ; (3) gravité, description facultative, contact facultatif. Confirmation avec numéro de suivi. Un **message de sécurité** (« Ne vous mettez pas en danger pour signaler ») précède le formulaire.
4. **Détail d'un signalement** : photos, localisation, type, gravité, timeline de traitement, bouton « Je vois aussi ce problème » (vote), commentaires, signaler un abus.
5. **Alertes et météo** (Finale) : alertes en cours avec leur type (officielle ou indicative), historique, prévisions de pluie, niveaux de risque par quartier.
6. **S'abonner aux alertes** (Finale) : quartier(s) ou position avec rayon, canaux, langue, seuil de gravité.
7. **Carte de risque prévisionnel** (Finale) : cellules colorées pour 24 et 48 h, avec les trois facteurs principaux de chaque zone et la date des données.
8. **Qualité de l'indice** (Finale) : comparaison indice et réel ; **état vide explicite** tant que le seuil minimal d'épisodes validés n'est pas atteint.
9. **Guide et prévention / « Apprendre »** (Finale) : conseils avant, pendant et après une inondation, numéros d'urgence, mini-cours et quiz.
10. **Statistiques publiques** (Finale) : par quartier et par mois, taux de résolution, temps moyen de traitement, avec état vide si les données sont insuffisantes.
11. **À propos, contact et FAQ, mentions légales, confidentialité, conditions d'utilisation, pages d'erreur et hors-ligne.**

**Bouton Urgence** : visible sur l'accueil, le formulaire et les alertes ; il affiche d'abord les numéros officiels (pompiers, protection civile) [numéros à confirmer], avant tout signalement.

### 4.2 Espace citoyen (connecté)

- Inscription et connexion par **e-mail et mot de passe** (le code OTP par téléphone est du niveau Vision, derrière la même couche d'authentification).
- Tableau de bord : mes signalements et leur statut, mes abonnements, mes notifications.
- Profil : nom, quartier, langue, canaux, suppression du compte et export des données.
- **Retour au citoyen** (Finale) : notification quand le statut change (avec consentement), puis question « Le problème est-il résolu ? » ; la réponse alimente le suivi et peut rouvrir le dossier.
- Un **score de fiabilité interne** (non affiché publiquement) calculé selon la confirmation des signalements. Aucun point, badge ni classement public.

### 4.3 Back-office (délégués, agents, administrateurs)

1. **Tableau de bord** : indicateurs (nouveaux, en cours, résolus, temps de réponse), carte des urgences, signalements en retard.
2. **Gestion des signalements** : tableau filtrable, statuts _Nouveau → Vérifié → Assigné → En cours → Résolu / Rejeté_, assignation, notes internes, historique complet, détection des doublons et fusion.
3. **Modération** : signalements suspects, abus, blocage d'utilisateurs.
4. **Alertes** : création, brouillons « en attente d'approbation », approbation ou rejet avec motif, programmation, suivi de livraison.
5. **Zones et quartiers** : communes, quartiers, repères, alias, délégué responsable, statut des limites (validées ou approximatives), indicateur « pilote ».
6. **Utilisateurs, rôles et invitations**, avec révocation immédiate.
7. **Indice de risque** (Finale) : seuils de niveaux, poids de la grille, versions avec retour en arrière, validation des étiquettes après chaque épisode.
8. **Curage** (Finale) : liste de caniveaux classés par risque et gravité, assignation, suivi avec photos avant et après.
9. **Escalade** (Finale) : délais cibles de première réponse ; remontée automatique à l'échelon supérieur.
10. **Journal d'audit et supervision** : qui a fait quoi, erreurs, échecs d'envoi, état de santé du service.
11. **Paramètres** : modèles de messages, fournisseurs de notification, clés (jamais dans le code).

### 4.4 Fonctions transverses

- **Anti-spam et fiabilité :** limitation de débit, détection de doublons géographiques et temporels, confirmation par les voisins, score de fiabilité, CAPTCHA léger en mode invité.
- **Hors-ligne :** formulaire utilisable sans réseau, file d'attente synchronisée au retour de la connexion, indicateur visible, gestion des conflits ; mise en cache des fonds de carte de la zone pilote (Finale).
- **Partage :** lien d'un signalement ; partage WhatsApp **limité aux alertes officielles**, avec leur date de validité.
- **Mode démonstration** (Finale) : simulateur d'épisode de pluie, désactivé par défaut (variable d'environnement), qui génère des signalements marqués « démo » et déclenche une alerte simulée.
- **Comptes de test** dans le script de données : un habitant, un délégué, un agent, un administrateur.

### 4.5 Découpage géographique et pilote

- **Hiérarchie :** département (Pikine) → commune → quartier → cellule de risque. Les noms officiels sont à confirmer auprès de la mairie ou d'un contact local ; aucun nom ni limite n'est inventé.
- **Limites souples :** les limites de quartier étant souvent informelles, le contour est facultatif. Un quartier est défini par des **repères** (marché, école, mosquée, gare) avec un rayon, et marqué « limites approximatives » tant qu'un délégué ou la mairie ne les a pas validées. La position GPS reste la référence.
- **Rattachement :** à partir de la position, calcul des quartiers candidats avec leur distance. Un seul candidat clair : rattachement automatique. Plusieurs candidats proches : rattachement au plus probable et choix en un clic pour l'habitant (le signalement peut être visible pour deux délégués voisins). Aucun candidat : « quartier non identifié », visible et traité par un agent, sans erreur pour l'habitant. L'habitant ou le délégué peut corriger, et la correction est conservée.
- **Alias :** noms informels et wolof, utilisés pour la recherche et le rattachement.
- **Abonnements :** par quartier(s), ou par position avec un rayon (par exemple 500 m).
- **Affichage :** filtres par commune et quartier ; un quartier sans signalement n'est pas un quartier sans risque (« données limitées »).
- **Pilote :** 2 ou 3 quartiers, définis par configuration (indicateur `pilote`) et par le script de données, sans valeur codée en dur. Le code reste générique pour ajouter d'autres quartiers.

### 4.6 Alertes

- **Deux types :** _officielle_ (mairie ou protection civile, émetteur indiqué) et _indicative_ (indice ou communauté, mention « indicatif, ne remplace pas les alertes officielles »). Une alerte indicative n'imite jamais l'apparence ni le vocabulaire d'une alerte officielle. Le droit d'émettre chaque type dépend du rôle et est contrôlé côté serveur.
- **Validation humaine :** pendant le pilote, une alerte préventive déclenchée par l'indice est un **brouillon** « en attente d'approbation ». Elle n'est envoyée qu'après approbation d'un agent ou d'un délégué habilité, qui peut modifier le message, la zone et le niveau, ou la rejeter. L'approbation (qui, quand, motif) est journalisée. Aucun envoi automatique sans décision explicite consignée.
- **Canaux :** notification web, SMS, WhatsApp, derrière une couche d'abstraction en **mode simulation par défaut**. L'interface indique toujours le mode actif.
- **Contenu :** message court en français (et en wolof, relu par un locuteur natif ; pas de traduction automatique pour les messages de sécurité), niveau, zone, conseils, date de validité.

### 4.7 Prévention à la source : caniveaux et déchets

Les signalements de caniveaux obstrués et de dépôts sauvages augmentent le facteur de risque de la cellule concernée et alimentent une **liste priorisée de curage** (risque × gravité), avec suivi des opérations (statut, équipe, photos avant et après, date) et alerte aux services concernés avant les fortes pluies.

### 4.8 Module pédagogique

Mini-cours illustrés (inondations, assainissement, prévention) avec quiz ; parcours guidé de démonstration pour initier des élèves ; documentation destinée aux jeunes développeurs (README, schéma d'architecture, guide de contribution).

### 4.9 Perspectives (niveau Vision)

- **Canal de messagerie (WhatsApp, SMS, USSD) :** même logique métier que le formulaire web. Parcours WhatsApp : accueil, consentement et langue, type par réponse numérotée, partage de la position, photo facultative, confirmation avec numéro de suivi. SMS et USSD (sans GPS ni photo) : choix du quartier puis d'un repère, position approximative marquée comme telle. Commandes `AIDE`, `SUIVI <numéro>`, `LANGUE`, `STOP`. Numéros stockés hachés, consentement tracé, limitation de débit. Mode simulation par défaut ; présenté comme opérationnel seulement après un test réel d'intégration.
- **Alerte mobilité :** statut des axes principaux (accès à la gare de Thiaroye) praticable, difficile ou impraticable, saisi par les agents et délégués ; les alertes mentionnent l'impact sur les trajets.
- **Alertes vocales** en français et wolof ; lecture vocale des écrans clés.
- **Données ouvertes** (CSV, GeoJSON) sans donnée personnelle ; **rapports PDF** automatiques ; **mode sombre**.
- **Suggestion du type de problème à partir de la photo :** une suggestion de type est proposée au délégué, avec son niveau de confiance affiché. Elle n'est jamais appliquée automatiquement : le type reste celui choisi par l'habitant tant qu'un délégué n'a pas validé ou corrigé la suggestion, et la décision du délégué est journalisée.
- **Détection de doublons visuels :** une empreinte de chaque photo (hachage perceptuel) permet de repérer une photo identique ou très proche déjà reçue. Le signalement est alors marqué « à vérifier », avec le lien vers le signalement proche ; il n'est jamais rejeté ni fusionné automatiquement.
- **Carte participative des caniveaux et ouvrages de drainage :** chaque ouvrage a un type, un état, une date de dernier curage et une source. Il est saisi et mis à jour par les rôles habilités (délégué dans ses quartiers, agent, administrateur), ne contient aucune donnée personnelle et est relié à la liste de curage (§4.7) : une opération de curage terminée met à jour la date de dernier curage de l'ouvrage.
- **Règles communes à ces trois éléments :**
  - aucune photo n'est envoyée à un service tiers (API de classification ou d'analyse d'image) sans décision consignée dans `docs/DECISIONS.md` ; le traitement se fait par défaut sur le serveur du projet ;
  - les métadonnées de la photo (date, position) sont lues et vérifiées **en mémoire** avant la suppression des EXIF, et ne sont jamais stockées ;
  - le classifieur est évalué sur des **étiquettes validées** par des délégués, avec un **jeu de test séparé** des données d'apprentissage ; les données de démonstration sont exclues ; sous le seuil minimal d'étiquettes fixé à l'avance, la page d'évaluation affiche un **état vide explicite** et aucune métrique ;
  - le résultat est présenté comme une **suggestion**, jamais comme une décision ou une « IA » qui reconnaît le problème.

---

## 5. Indice de risque

### 5.1 Principe

L'indice est un score de 0 à 100 calculé **par cellule**, puis agrégé **par quartier**, mis à jour à intervalles réguliers (toutes les 3 heures). La version 1 est un **indice par règles pondérées**, transparent et réglable. Il est présenté comme un indice indicatif, jamais comme une probabilité.

### 5.2 Données d'entrée

Pluie prévue (Open-Meteo) sur 6, 24 et 48 h ; pluie des 3 derniers jours (saturation) ; altitude et pente par cellule (SRTM, précalculées) ; signalements récents de caniveaux obstrués et de dépôts ; historique des inondations validées.

### 5.3 Grille de règles de départ (hypothèses à valider)

Les valeurs ci-dessous sont des **hypothèses de départ**, réglables depuis le back-office et versionnées. Elles doivent être validées avec des délégués et, si possible, un expert (par exemple ANACIM ou service technique).

| Facteur                           | Mesure                                                                     | Points maximum |
| --------------------------------- | -------------------------------------------------------------------------- | -------------- |
| Cumul de pluie prévu sur 24 h     | Échelle à 4 paliers (aucun, faible, modéré, fort), seuils en mm à fixer    | 30             |
| Intensité maximale prévue sur 6 h | Même échelle                                                               | 15             |
| Saturation du sol                 | Pluie cumulée des 3 jours précédents                                       | 10             |
| Zone basse                        | Altitude relative de la cellule par rapport aux cellules voisines          | 20             |
| Pente                             | Pente faible (stagnation)                                                  | 5              |
| Caniveaux et dépôts signalés      | Nombre et gravité des signalements récents dans la cellule et ses voisines | 15             |
| Historique                        | Inondations validées dans la cellule                                       | 5              |
| **Total**                         |                                                                            | **100**        |

Chaque palier donne une fraction des points maximum du facteur (0, un tiers, deux tiers, tous). Le calcul est déterministe, testé, et chaque score affiche ses **trois facteurs principaux** en langage simple, la date des données météo et l'horizon.

### 5.4 Niveaux

Faible (moins de 25), Modéré (25 à 50), Élevé (50 à 75), Critique (plus de 75), seuils réglables. Chaque niveau s'affiche avec une couleur **et** un texte ou une icône. Les zones dont les données sont insuffisantes affichent « données limitées ».

### 5.5 Robustesse

Si la météo est indisponible, le dernier relevé est utilisé et l'interface l'indique. Une valeur manquante est « absente », jamais inventée. Le calcul par cellule est mis en cache.

### 5.6 Contexte local (Vision)

Couches optionnelles : marées et niveau de la mer, niveau de la nappe, nature du sol, réseau de drainage, zones basses historiques. Chaque couche déclare sa source, sa date, sa couverture et sa fiabilité ; elle est activable par configuration ; absente, elle est désactivée et signalée « donnée absente ». Les sources sont consignées dans `docs/DECISIONS.md`.

### 5.7 Boucle d'apprentissage

Après chaque épisode, l'indice annoncé est enregistré et comparé aux signalements réels par cellule ; le délégué valide l'étiquette « inondé / non inondé ». Une question en un clic peut être envoyée aux abonnés (« Votre rue a-t-elle été inondée ? »). Les poids de la grille peuvent être ajustés, chaque version étant conservée.

---

## 6. Méthodologie et évaluation

Le projet doit pouvoir être défendu comme une démarche de recherche appliquée. Un rapport de deux pages, `docs/METHODOLOGIE.md`, décrit la méthode.

- **Question de recherche :** les signalements citoyens validés améliorent-ils l'indice de risque d'inondation en banlieue, par rapport à la seule prise en compte de la pluie et du relief ?
- **Hypothèse H1 :** l'indice qui intègre les signalements validés détecte mieux les zones réellement inondées (meilleur rappel) sans augmenter de façon notable les fausses alertes.
- **Hypothèse H2 (à observer plus tard) :** prioriser le curage selon l'indice réduit les signalements récurrents de caniveaux obstrués.
- **Modèles comparés :** M0 = pluie seule ; M1 = pluie + relief ; M2 = M1 + signalements (et contexte local si disponible).
- **Protocole :** séparation temporelle entre données d'apprentissage et de test (aucune fuite du futur), évaluation par épisode, données de démonstration exclues de toute évaluation.
- **Indicateurs :** précision, rappel, taux de fausses alertes, avec intervalle d'incertitude.
- **Seuil minimal :** aucun indicateur n'est affiché tant que le nombre d'épisodes et d'étiquettes validés n'atteint pas le seuil fixé dans `docs/DECISIONS.md` (à fixer **avant** de voir les résultats).
- **Biais à documenter :** zones où l'on signale davantage, signalements tardifs, faux signalements, absence de signalement qui ne signifie pas absence d'inondation.
- **Éthique :** usage des photos et des positions, consentement, durée de conservation, droit à l'effacement.
- **Modèle appris (perspective) :** seulement si le seuil de données est atteint. Jeu de données reproductible (une ligne par cellule et par épisode, date, source, version), préparation sans valeur inventée, séparation temporelle, modèles dans l'ordre (règles, régression logistique, puis arbres si les données le justifient), **critère d'activation écrit à l'avance** (meilleur rappel sans hausse notable des fausses alertes), modèle versionné avec retour aux règles possible, source du score affichée, suivi de la dégradation. Aucune performance annoncée sans données réelles validées.

---

## 7. Interface et identité

Le design system (palette, typographie, composants, principes d'accessibilité) et le **logo** sont décrits dans `docs/DESIGN_ET_MARQUE.md`, qui fait référence. Le logo est créé en Phase 1 et validé par l'équipe avant la suite.

---

## 8. Architecture technique

- **Frontend :** Next.js (App Router) et TypeScript, Tailwind CSS, shadcn/ui, React Hook Form et Zod, TanStack Query.
- **Carte :** Leaflet et OpenStreetMap, clustering, couche de chaleur du risque.
- **Backend :** API REST (route handlers Next.js), Prisma, validation Zod sur toutes les entrées.
- **Base de données :** MySQL 8 ; coordonnées indexées ; requêtes par rayon.
- **Authentification :** e-mail et mot de passe, sessions sécurisées (cookies httpOnly) ; comptes sensibles par invitation ; le code OTP par téléphone s'ajoute derrière la même couche (Vision).
- **Notifications :** couche d'abstraction (notification web, SMS, WhatsApp) avec **mode simulation par défaut**.
- **Météo :** Open-Meteo ; **altitude :** SRTM précalculée par cellule.
- **Photos :** compression côté client, suppression des métadonnées EXIF, stockage local ou compatible S3.
- **PWA :** service worker, manifeste, installation, saisie hors-ligne, mise en cache des fonds de carte du pilote.
- **Internationalisation :** français par défaut, structure prête pour le wolof.
- **Moteur de risque :** module isolé en TypeScript, tâches planifiées (cron ou BullMQ), cache des résultats. Un microservice Python (FastAPI, scikit-learn) est une perspective pour un modèle appris.
- **Déploiement :** Docker et docker-compose ; variables d'environnement documentées dans `.env.example`.

---

## 9. Modèle de données

Un seul modèle, avec les relations principales. Les noms de colonnes sont indicatifs ; le schéma Prisma est la référence une fois créé.

**Utilisateurs et accès**

- `users` : id, nom, e-mail, téléphone (haché ou chiffré), rôle, langue, score_fiabilité, statut, commune_id (agents).
- `invitations` : invité, rôle, portée (quartier ou commune), jeton haché, expiration, statut.
- `audit_logs` : acteur, action, objet, date. `abuse_flags` : signalement ou utilisateur, motif.

**Géographie**

- `communes` : id, nom, département.
- `neighborhoods` : id, nom, commune_id, limites (facultatif), statut des limites (validées ou approximatives), pilote (oui ou non), niveau de risque, délégué_id.
- `neighborhood_landmarks` : quartier, nom du repère, position, rayon.
- `neighborhood_aliases` : quartier, alias, langue.
- `risk_cells` : grille, altitude, pente, quartier.

**Signalements**

- `reports` : id, type, gravité, description, lat, lng, quartier_id (peut être vide), rattachement (automatique ou corrigé), position approximative (oui ou non), statut, auteur_id (facultatif), votes_confirmation, créé_le, résolu_le, source (web ou messagerie), démo (oui ou non).
- `report_photos`, `report_votes`, `report_comments`, `report_status_history`.
- `cleanup_operations` : signalement, équipe, statut, photos, date.

**Alertes et abonnements**

- `alerts` : titre, messages (fr, wo), niveau, type (officielle ou indicative), émetteur, zone, canaux, statut (dont « en attente d'approbation »), validité, programmée_le, créé_par.
- `alert_approvals` : alerte, approbateur, décision, motif, date.
- `alert_deliveries` : alerte, abonnement, canal, statut.
- `subscriptions` : utilisateur ou téléphone, position et rayon (facultatif), canaux, seuil, langue. `subscription_neighborhoods` : abonnement, quartier.
- `feedback_prompts` : épisode, utilisateur, cellule, réponse.

**Indice de risque**

- `weather_snapshots` : position, pluie prévue, horizon, relevé_le.
- `risk_predictions` : cellule, score, niveau, facteurs, horizon, version de la grille, créé_le.
- `rule_versions` : nom, actif, créé_le ; `rule_weights` : version, facteur, poids ou seuils.
- `rain_episodes` : début, fin, cumul ; `episode_labels` : cellule, épisode, inondé (oui ou non), validé par, source.
- `escalation_rules` : type, gravité, délai cible, échelon suivant.

**Vision (non créés avant d'être nécessaires)** : `message_sessions`, `message_logs`, `local_context_layers`, `road_segments`, `road_status`, `model_versions`.

**Supervision :** `error_logs`, `health_checks` (sans donnée personnelle). `settings`.

Le script de données (`seed`) crée des quartiers, repères, signalements et comptes de test **fictifs et marqués comme tels** (exemples de noms : Thiaroye Gare, Thiaroye sur Mer, Diamaguène, Mbao, Guinaw Rails, Yeumbeul), sans prétendre à l'exactitude de leurs limites.

---

## 10. API

**Signalements :** `POST /api/reports` · `GET /api/reports?bbox=&type=&status=` · `GET /api/reports/:id` · `POST /api/reports/:id/confirm` · `PATCH /api/reports/:id/status` · `POST /api/reports/:id/feedback`

**Géographie :** `GET /api/communes` · `GET /api/neighborhoods?commune_id=` · `GET /api/neighborhoods/search?q=` · `GET /api/geo/resolve?lat=&lng=` (quartiers candidats avec leur distance)

**Alertes :** `POST /api/alerts` · `GET /api/alerts/active` · `POST /api/alerts/:id/approve` · `POST /api/alerts/:id/reject` · `POST /api/subscriptions`

**Indice et apprentissage :** `GET /api/risk/forecast?horizon=24` ou `48` · `GET /api/risk/cells/:id/factors` · `GET /api/neighborhoods/:id/risk` · `GET /api/model/performance` · `POST /api/episodes/:id/labels` · `POST /api/feedback/flooded` · `GET /api/weather?lat=&lng=`

**Curage :** `GET /api/cleanup/priorities` · `PATCH /api/cleanup/:id`

**Accès et administration :** `POST /api/auth/register` · `POST /api/auth/login` · `POST /api/invitations` · `POST /api/invitations/:token/accept` · `DELETE /api/invitations/:id` · `GET /api/stats/public` · `GET /api/health`

**Démonstration (désactivée par défaut) :** `POST /api/demo/simulate-rain`

**Vision :** `POST /api/auth/otp/request` et `/verify` · `/api/channels/whatsapp/webhook`, `/sms/inbound`, `/ussd`, `/simulate` · `GET /api/roads/status`

Validation Zod sur toutes les entrées, réponses typées, codes d'erreur cohérents, pagination, documentation OpenAPI.

---

## 11. Sécurité, confidentialité et cadre juridique

**Sécurité**

- RBAC strict côté serveur avec portée géographique ; double authentification pour l'administrateur ; comptes sensibles par invitation à usage unique, expirante, révocable.
- Limitation de débit, protection contre CSRF, XSS et injection, en-têtes de sécurité, validation des fichiers téléversés (type, taille), suppression des métadonnées EXIF.
- Analyse régulière des dépendances ; revue selon la liste OWASP ; sauvegardes chiffrées avec **test de restauration** ; journal d'audit.

**Confidentialité**

- Numéros de téléphone hachés ou chiffrés, jamais affichés ; aucune donnée personnelle dans les API publiques ni dans les journaux.
- **Positions publiques arrondies** (précision réduite) pour ne pas désigner un domicile ; règle contre les photos de personnes et de plaques, avec floutage sur demande de modération ; protection contre l'utilisation d'un signalement pour viser un voisin.
- Consentement explicite, minimisation, droit d'accès, d'export et de suppression, durées de conservation définies [à fixer].

**Cadre juridique** (à vérifier avant ouverture au public)

- Respect de la loi sénégalaise sur la protection des données à caractère personnel ; vérification auprès de l'autorité compétente (CDP) d'une éventuelle déclaration.
- Conditions d'utilisation et limites de responsabilité (alerte fausse, tardive ou absente) ; mention « indicatif ».
- L'application ne remplace pas les services de secours.

**Langue :** les messages de sécurité et d'alerte en wolof sont relus par un locuteur natif ; glossaire des termes d'alerte tenu à jour.

---

## 12. Qualité, performance et accessibilité

Objectifs mesurés et consignés à chaque phase :

- score Lighthouse mobile supérieur ou égal à 90 (performance, accessibilité, bonnes pratiques, PWA) ;
- chargement initial inférieur à 3 secondes sur une connexion 3G simulée ;
- accessibilité WCAG AA : contrastes, navigation au clavier, étiquettes, zones tactiles d'au moins 48 px ;
- code typé, ESLint et Prettier, tests unitaires (Vitest) et de parcours (Playwright) ;
- parcours vérifiés sur mobile (375 px), tablette (768 px) et ordinateur (1280 px), en réseau 3G simulé et hors-ligne ;
- vérification sur un vrai téléphone en HTTPS (voir `docs/TEST_TELEPHONE.md`).

Ces objectifs sont des **cibles mesurées** : un écart est documenté avec sa cause et un plan de correction, sans bloquer à lui seul la livraison d'une fonction par ailleurs vérifiée.

---

## 13. Exigences numérotées

Chaque exigence a une priorité (**I** indispensable, **M** important, **B** bonus), un niveau de périmètre (**S** Socle, **F** Finale, **V** Vision) et un critère d'acceptation vérifiable. Une fonction n'est terminée que lorsque son critère est vérifié ; l'état est suivi dans `docs/TRACABILITE.md`.

| ID     | Exigence                                                                                                            | Prio | Niv. | Critère d'acceptation                                                                      |
| ------ | ------------------------------------------------------------------------------------------------------------------- | ---- | ---- | ------------------------------------------------------------------------------------------ |
| EXG-01 | Un signalement s'envoie en moins de 60 secondes                                                                     | I    | S    | Test Playwright chronométré en 3G simulée                                                  |
| EXG-02 | Signaler sans compte (mode invité)                                                                                  | I    | S    | Test de bout en bout sans connexion                                                        |
| EXG-03 | Rattachement automatique au quartier, avec candidats et correction                                                  | I    | S    | Tests unitaires sur positions de référence (centre, frontière, hors zone)                  |
| EXG-04 | Signalement possible hors-ligne puis synchronisé                                                                    | I    | S    | Test Playwright hors-ligne puis retour du réseau                                           |
| EXG-05 | Permissions par rôle et portée géographique                                                                         | I    | S    | Tests d'accès non autorisé par rôle (refus attendu)                                        |
| EXG-06 | Aucune donnée personnelle dans les API publiques                                                                    | I    | S    | Test automatisé sur les réponses publiques                                                 |
| EXG-07 | Statuts de signalement avec historique                                                                              | I    | S    | Test de changement de statut et d'historique                                               |
| EXG-08 | Indice avec facteurs, date des données et horizon affichés                                                          | I    | F    | Tests unitaires et d'affichage                                                             |
| EXG-09 | Météo indisponible : dernier relevé utilisé et signalé                                                              | I    | F    | Test unitaire avec service météo en panne simulée                                          |
| EXG-10 | Alertes créées, envoyées en simulation et journalisées                                                              | I    | F    | Test de création, d'envoi et de journalisation                                             |
| EXG-11 | Abonnement par quartier ou par position et rayon                                                                    | M    | F    | Tests unitaires et de bout en bout                                                         |
| EXG-12 | Page « Qualité de l'indice » en état vide sans épisode validé ; aucune métrique inventée                            | I    | F    | Test avec base sans épisode validé                                                         |
| EXG-13 | Métadonnées EXIF supprimées des photos                                                                              | I    | S    | Test avec une image contenant des métadonnées                                              |
| EXG-14 | Performance mobile : Lighthouse supérieur ou égal à 90 et chargement sous 3 s en 3G                                 | M    | S    | Mesure consignée par phase                                                                 |
| EXG-15 | Accessibilité WCAG AA                                                                                               | I    | S    | Audit automatisé et vérification manuelle                                                  |
| EXG-16 | Données de démonstration marquées comme fictives                                                                    | I    | S    | Test sur les données du script de seed                                                     |
| EXG-17 | Notifications en mode simulation par défaut, mode actif affiché                                                     | I    | F    | Test de configuration et d'affichage                                                       |
| EXG-18 | Journal d'audit des actions sensibles                                                                               | M    | S    | Test de journalisation                                                                     |
| EXG-19 | Interface traduisible, clés manquantes détectées                                                                    | M    | S    | Test de couverture des clés                                                                |
| EXG-20 | Un signalement par messagerie suit le même circuit que le web                                                       | M    | V    | Test de conversation simulée créant un signalement valide                                  |
| EXG-21 | Couches de contexte local désactivables, donnée absente signalée                                                    | M    | V    | Test unitaire avec couche absente                                                          |
| EXG-22 | Données ouvertes sans donnée personnelle                                                                            | B    | V    | Test sur le contenu des exports                                                            |
| EXG-23 | Jeu de données d'apprentissage reproductible, lignes de démonstration exclues                                       | M    | V    | Test sur un jeu de référence contenant des lignes de démonstration                         |
| EXG-24 | Séparation temporelle sans fuite du futur                                                                           | M    | V    | Test : tout épisode de test postérieur aux épisodes d'apprentissage                        |
| EXG-25 | Modèle appris activé selon un critère écrit à l'avance, retour aux règles possible, source du score affichée        | M    | V    | Test d'activation, de désactivation et d'affichage                                         |
| EXG-26 | Surveillance de la dégradation après activation                                                                     | B    | V    | Test avec performances simulées en baisse                                                  |
| EXG-27 | Logo en SVG et toutes ses variantes dans `public/brand/`                                                            | I    | S    | Test de présence et de validité ; captures de la page `/brand`                             |
| EXG-28 | Favicon et icônes PWA référencés dans le manifeste, lisibles à 16, 32, 192 et 512 px                                | I    | S    | Test du manifeste et captures aux quatre tailles                                           |
| EXG-29 | Alerte préventive en brouillon, envoyée seulement après approbation humaine journalisée                             | I    | F    | Test : déclenchement sans envoi ; envoi après approbation ; approbateur dans le journal    |
| EXG-30 | Chaque alerte a un type (officielle ou indicative) et un émetteur ; mention « indicatif » affichée                  | I    | F    | Test de refus pour un rôle non habilité ; test d'affichage                                 |
| EXG-31 | Message de sécurité avant le formulaire et bouton Urgence avec les numéros officiels                                | I    | S    | Test de bout en bout sur accueil, formulaire et alertes                                    |
| EXG-32 | Notification du changement de statut et question « résolu ? »                                                       | M    | F    | Test : notification (simulation) ; réponse « non résolu » rouvre le dossier                |
| EXG-33 | Comptes sensibles créés par invitation à usage unique, expirante, révocable                                         | I    | S    | Tests : inscription libre refusée ; jeton haché et expirant ; révocation ; journal d'audit |
| EXG-34 | Fonds de carte de la zone pilote disponibles hors-ligne                                                             | M    | F    | Test hors-ligne : carte du pilote affichée ; message clair hors zone                       |
| EXG-35 | Alertes vocales et lecture vocale des écrans clés                                                                   | B    | V    | Test : message vocal disponible pour l'alerte de démonstration                             |
| EXG-36 | Escalade automatique d'un signalement sans réponse dans le délai cible                                              | M    | F    | Test avec délai simulé dépassé                                                             |
| EXG-37 | Supervision : point de santé, journal d'erreurs, échecs d'envoi suivis, aucune donnée personnelle dans les journaux | M    | F    | Test avec panne simulée ; journaux sans donnée personnelle                                 |
| EXG-38 | Tutoriel de premier lancement, ignorable et rejouable                                                               | B    | F    | Test de bout en bout                                                                       |
| EXG-39 | Positions publiques arrondies ; aucune position précise exposée publiquement                                        | I    | S    | Test sur les réponses publiques                                                            |
| EXG-40 | Comptes de test (habitant, délégué, agent, administrateur) dans le script de données                                | M    | S    | Test de connexion avec chaque compte de test                                               |
| EXG-41 | Double authentification pour l'administrateur                                                                       | M    | F    | Test : connexion administrateur impossible sans second facteur                             |
| EXG-42 | Grille de règles réglable depuis le back-office, versionnée, retour en arrière possible                             | I    | F    | Test de modification, de version et de retour                                              |
| EXG-43 | Suggestion de type à partir de la photo, avec niveau de confiance, toujours validée par un délégué, jamais appliquée automatiquement | M | V | Test : type inchangé sans validation ; validation ou correction journalisée ; confiance affichée |
| EXG-44 | Évaluation honnête du classifieur : étiquettes validées, jeu de test séparé, démonstration exclue, état vide sous le seuil | M | V | Test : aucune métrique sous le seuil ; lignes démo exclues ; aucune photo de test dans l'apprentissage |
| EXG-45 | Doublon visuel marqué « à vérifier », sans rejet ni fusion automatique | M | V | Test : photo proche → marque « à vérifier » et lien ; signalement conservé et visible |
| EXG-46 | Carte des ouvrages de drainage (type, état, dernier curage, source) éditable par les seuls rôles habilités, reliée au curage | M | V | Tests d'accès par rôle ; aucune donnée personnelle dans l'API ; curage terminé → date mise à jour |
| EXG-47 | Confidentialité du traitement des photos : aucun envoi à un tiers sans décision consignée, métadonnées lues en mémoire puis supprimées | I | V | Test : aucune requête sortante ; EXIF absents après traitement ; métadonnées non stockées |

---

## 14. Phases et livrables

| Phase | Contenu                                                                                                                                                  | Niveau |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1     | Architecture, schéma de données, design system et logo, structure du projet                                                                              | Socle  |
| 2     | Signalement, carte, détail (utilisable de bout en bout)                                                                                                  | Socle  |
| 3     | Authentification, invitations, espace citoyen, back-office de traitement                                                                                 | Socle  |
| 4     | Indice de risque version 1, alertes avec validation humaine, abonnements, météo                                                                          | Finale |
| 5     | Carte de risque, enregistrement et validation des étiquettes, curage, retour au citoyen, escalade, statistiques, cartes hors-ligne, module « Apprendre » | Finale |
| 6     | Mode démonstration, tests, performance, sécurité, documentation, Docker                                                                                  | Finale |
| Après | Éléments du niveau Vision, selon les données et les accords obtenus                                                                                      | Vision |

**Livrables :** code source complet, `README.md` (installation, architecture, captures), `.env.example`, script de données, documentation de l'API, guide de déploiement, `docs/METHODOLOGIE.md`, `docs/TRACABILITE.md`, `docs/MARQUE.md`, script de démonstration de 5 minutes.

**Scénario de démonstration (moins de 5 minutes) :** prévision de forte pluie, carte de risque qui passe au rouge, brouillon d'alerte approuvé et envoyé en simulation, signalements entrants, mise à jour de la carte, traitement par la mairie, puis comparaison de l'indice et du réel, avec la mention « démonstration » visible.
