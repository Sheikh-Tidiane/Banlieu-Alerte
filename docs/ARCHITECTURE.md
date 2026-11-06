# Architecture – Banlieue Alerte

## Vue d'ensemble

```mermaid
flowchart LR
  subgraph Navigateur["Navigateur (PWA)"]
    UI["Pages Next.js<br/>(rendu serveur + composants client)"]
    SW["Service worker<br/>cache des pages publiques,<br/>plan hors ligne"]
    IDB["IndexedDB<br/>file des signalements hors ligne"]
  end

  subgraph Serveur["Serveur Next.js (Node 22)"]
    API["Route handlers /api<br/>validation Zod, CSRF, débit"]
    PERM["permissions/<br/>rôles et portée"]
    SVC["services/<br/>logique métier"]
    LIB["lib/<br/>indice, météo, géo,<br/>notifications, TOTP"]
  end

  subgraph Taches["Tâche planifiée (toutes les 15 min)"]
    JOBS["npm run jobs<br/>escalade, alertes programmées,<br/>indice (3 h), purge (24 h)"]
  end

  DB[("MySQL 8<br/>Prisma")]
  OM["Open-Meteo<br/>(pluie)"]
  OSM["Tuiles OpenStreetMap"]

  UI --> API --> PERM --> SVC --> LIB
  SVC --> DB
  JOBS --> SVC
  LIB -- "prévision" --> OM
  UI -- "fond de carte" --> OSM
  SW -. "hors ligne" .- UI
  IDB -. "synchronisation" .- API
```

## Boucle du produit

```mermaid
flowchart LR
  P["Prédire<br/>indice par case (règles)"] --> A["Alerter<br/>brouillon → approbation humaine"]
  A --> S["Signaler<br/>habitants, sans compte"]
  S --> T["Traiter<br/>back-office, escalade, curage"]
  T --> L["Apprendre<br/>épisodes, étiquettes,<br/>qualité de l'indice"]
  L --> P
```

## Organisation du code

| Dossier | Rôle |
|---|---|
| `src/app/` | Pages (App Router) et route handlers `/api` |
| `src/components/` | Interface, sans logique métier, regroupée par fonctionnalité |
| `src/services/` | Logique métier : signalements, back-office, alertes, indice, épisodes, curage, supervision, démonstration |
| `src/lib/risk/` | Indice de risque (code pur, testé) : facteurs, score, évaluation |
| `src/lib/weather/`, `src/lib/geo/` | Météo (Open-Meteo, panne), géographie (rattachement, cases) |
| `src/lib/notifications/` | Couche d'envoi, simulation par défaut |
| `src/lib/auth/` | Sessions, CSRF, mots de passe, TOTP, chiffrement |
| `src/permissions/` | Politiques d'accès pures et filtres de portée |
| `src/validators/` | Schémas Zod (entrées des API) |
| `src/jobs/` | Tâche planifiée unique, purge |
| `src/i18n/` | Textes (français ; wolof après relecture) |
| `prisma/` | Schéma, migrations, données de démonstration, cases SRTM |
| `scripts/` | Exploitation : invitation administrateur, cases, plan hors ligne, sauvegardes |
| `tests/` | Unitaires, intégration (base), parcours Playwright |

## Choix structurants

Les décisions sont numérotées dans `docs/DECISIONS.md`. Les principales :
- D-034 : sessions maison ;
- D-036 : permissions et portée géographique ;
- D-042 : service worker sans aucune page privée en cache ;
- D-046 : grille de l'indice ;
- D-050 : envoi des alertes seulement après approbation ;
- D-054 : protocole d'évaluation ;
- D-057 : tâche planifiée unique ;
- D-064 : second facteur de l'administrateur ;
- D-067 : production Docker.

## Déploiement

```mermaid
flowchart LR
  Internet --> Caddy["caddy<br/>HTTPS automatique"] --> App["app<br/>Next.js autonome"]
  App --> DB[("db<br/>MySQL 8.4")]
  Jobs["jobs<br/>npm run jobs / 15 min"] --> DB
  Migrate["migrate<br/>prisma migrate deploy"] --> DB
```

Voir `docs/DEPLOIEMENT.md`.
