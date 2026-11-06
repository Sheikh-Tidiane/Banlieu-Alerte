# Méthodologie – Banlieue Alerte

Document de méthode (CDC §6). Version de travail, commencée en Phase 4 : elle décrit l'indice v1 tel qu'il est calculé. Le protocole d'évaluation sera complété en Phase 5, avec l'enregistrement des épisodes et des étiquettes, **avant** d'avoir le moindre résultat.

## 1. Question et hypothèses

- **Question de recherche :** les signalements citoyens validés améliorent-ils l'indice de risque d'inondation en banlieue, par rapport à la seule prise en compte de la pluie et du relief ?
- **H1 :** l'indice qui intègre les signalements validés détecte mieux les zones réellement inondées (meilleur rappel), sans hausse notable des fausses alertes.
- **H2 (plus tard) :** prioriser le curage selon l'indice réduit les signalements récurrents de caniveaux obstrués.
- **Modèles comparés :**
  - M0 : pluie seule ;
  - M1 : pluie et relief ;
  - M2 : M1 et signalements.
  Les trois se calculent à partir des facteurs enregistrés de chaque prédiction : il suffit de ne garder que les facteurs concernés.

## 2. L'indice v1 : un indice par règles, pas une probabilité

Le score va de 0 à 100. Il est calculé par cellule de 250 m puis agrégé par quartier, toutes les 3 heures, pour deux horizons :
- 24 h : les 24 prochaines heures ;
- 48 h : de +24 à +48 h.

Le calcul est déterministe et testé (`src/lib/risk/`). La grille est versionnée en base : chaque prédiction garde la version utilisée.

| Facteur | Mesure | Source | Points |
|---|---|---|---|
| Pluie prévue | cumul sur la fenêtre de l'horizon | Open-Meteo | 30 |
| Pic de pluie | plus fort cumul sur 6 h consécutives | Open-Meteo | 15 |
| Saturation | pluie des 72 h précédentes | Open-Meteo (analyse) | 10 |
| Zone basse | altitude relative aux 8 cellules voisines | SRTM 30 m | 20 |
| Pente | plus grand dénivelé vers une voisine | SRTM 30 m | 5 |
| Caniveaux et dépôts | signalements des 30 derniers jours, cellule et voisines, pondérés par la gravité | signalements | 15 |
| Historique | inondations validées dans la cellule | étiquettes (Phase 5) | 5 |

Chaque facteur a quatre paliers, qui rapportent 0, un tiers, deux tiers ou tous ses points. Les seuils sont des hypothèses de départ (D-046), à valider avec des délégués et, si possible, un expert (ANACIM, service technique). Niveaux : Faible, Modéré dès 25, Élevé dès 50, Critique dès 75.

**Règles de robustesse :**
- une donnée manquante est « absente » : elle compte 0 point et elle est affichée comme telle ;
- sans prévision de pluie, l'indice est « données limitées », sans score ;
- en cas de panne météo, le dernier relevé est utilisé et signalé (D-045) ;
- **par temps sec** (ni pluie prévue, ni sol saturé), le score est plafonné à 24, donc « Faible » (D-052). Le relief et les caniveaux décrivent une vulnérabilité, pas un risque immédiat.

Le quartier prend la valeur de sa cellule la plus exposée (principe de précaution). Chaque score publié affiche ses trois facteurs principaux en langage simple, la date du relevé météo, l'horizon et les données absentes.

## 3. Limites connues

- **Résolution de la météo :** le modèle d'Open-Meteo a une maille de plusieurs kilomètres, et le pilote n'a qu'un point de prévision. La pluie est donc identique pour toutes les cellules : seuls le relief et les signalements les distinguent.
- **Précision du relief :** l'erreur verticale de SRTM est de plusieurs mètres, et l'altitude est arrondie au mètre. Les écarts de 0,5 à 1,5 m qui définissent les paliers « zone basse » sont du même ordre que cette erreur. Le facteur peut désigner à tort une cellule comme basse, ou l'inverse. Seule la comparaison avec des inondations validées permettra de le juger.
- **Saison :** le dossier et la finale tombent en saison sèche. Un indice « Faible » partout est alors attendu, et ne dit rien de la qualité de l'indice. Une démonstration d'épisode pluvieux utilisera une météo injectée, toujours marquée « démo » (simulateur, Phase 6).
- **Biais des signalements :** on signale davantage dans certaines zones ; des signalements arrivent tard ou sont faux ; une absence de signalement ne prouve pas l'absence d'inondation.
- **Grille non calibrée :** aucun poids n'a encore été ajusté sur des données réelles.

## 4. Protocole d'évaluation (fixé le 5 nov. 2026, avant tout résultat – D-054)

- **Épisodes :** déclarés par un agent ou un administrateur (début, fin). La pluie observée est calculée à partir des relevés réels enregistrés, sinon elle est absente.
- **Étiquettes :** une par case et par épisode, posée par une personne de la portée (délégué, agent, administrateur), « inconnu » par défaut. Les signalements d'inondation et les réponses des abonnés (« Votre rue a-t-elle été inondée ? ») sont montrés comme indices, jamais transformés en étiquettes. L'épisode est ensuite validé par un agent ou un administrateur.
- **Prédiction évaluée :** la dernière prédiction par case à 24 h enregistrée avant le début de l'épisode. Aucune information postérieure n'est utilisée.
- **Règle « prévu inondé » :** pour chaque modèle, on prend la part des points obtenus sur ses facteurs, ramenée sur 100. Elle doit être au moins égale au seuil « Élevé » de la grille de la prédiction, plafond par temps sec compris. Les modèles :
  - M0 : pluie prévue, pic sur 6 h, saturation ;
  - M1 : M0, zone basse et pente ;
  - M2 : M1 et signalements de caniveaux.
- **Exclusions :** étiquettes « inconnu » ; données de démonstration (épisodes, étiquettes, prédictions).
- **Indicateurs :** précision, rappel, taux de fausses alertes (part des prévisions « inondé » démenties), avec un intervalle de Wilson à 95 %.
- **Seuil d'affichage :** 5 épisodes validés, 30 étiquettes réelles, dont 5 « inondé ». En dessous, la page « Qualité de l'indice » affiche un état vide avec le décompte réel.
- **Limite connue :** les étiquettes ne couvrent que les cases que les délégués ont pu vérifier ; le rappel peut être surestimé si seules les zones très touchées sont étiquetées.

## 5. Éthique et données

Les positions publiques sont arrondies (D-025). Les abonnements par position restent privés. Le consentement et les durées de conservation sont fixés (D-043). Aucune donnée personnelle ne figure dans les API publiques de l'indice ni des alertes (tests automatisés). Sources : Open-Meteo (CC BY 4.0) et SRTM (NASA/USGS, domaine public) via OpenTopoData.
