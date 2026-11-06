# Charte de marque – Banlieue Alerte

Logo retenu : **concept B « Goutte-signal »** (D-020). Une goutte d'eau, une ligne d'eau, deux ondes d'alerte : l'eau qui prévient, sans dramatiser.

Les fichiers sont générés par `npm run brand` (D-021) dans `public/brand/`. Pour modifier le logo, on modifie la géométrie de `scripts/build-brand.ts` puis on relance la génération. On ne retouche jamais un fichier à la main.

## 1. Couleurs

| Rôle | Couleur | Utilisation dans le logo |
|---|---|---|
| Bleu eau | `#0B6FA4` | Goutte |
| Vert principal | `#1B5E20` | Ondes et « Alerte » sur fond clair |
| Jaune accent | `#F9B72B` | Ondes et « Alerte » sur fond sombre |
| Encre (neutre) | `#14211A` | « Banlieue » sur fond clair ; fond sombre de référence |
| Blanc cassé (neutre) | `#F7F9F7` | « Banlieue » et ligne d'eau sur fond sombre |

Trois couleurs de marque au plus par version, plus un neutre.

**Contrastes** (rapport WCAG, recalculés par `tests/unit/brand.test.ts`) :
- sur fond clair `#F7F9F7` : goutte 5,2:1, vert 7,4:1, encre 15,7:1 ;
- sur fond sombre `#14211A` : goutte 3,0:1 (seuil des éléments graphiques), jaune 9,4:1, blanc cassé 15,7:1.

## 2. Typographie

- Nom : **Poppins SemiBold (600)**, vectorisé dans les fichiers (aucune dépendance aux polices installées).
- Interface : Poppins pour les titres, Inter pour le texte (`docs/DESIGN_ET_MARQUE.md`).

## 3. Variantes et fichiers

| Variante | Fichier |
|---|---|
| Horizontale (couleur, fond clair) | `logo-horizontal.svg` |
| Horizontale (fond sombre) | `logo-horizontal-dark.svg` |
| Verticale (couleur et fond sombre) | `logo-vertical.svg`, `logo-vertical-dark.svg` |
| Symbole seul | `symbol.svg`, `symbol-dark.svg` |
| Monochrome noir | `symbol-mono-black.svg`, `logo-horizontal-mono-black.svg`, `logo-vertical-mono-black.svg` |
| Monochrome blanc | `symbol-mono-white.svg`, `logo-horizontal-mono-white.svg`, `logo-vertical-mono-white.svg` |
| Favicon (version simplifiée) | `favicon.svg`, `favicon.ico` (16, 32, 48), `favicon-16.png`, `favicon-32.png`, `favicon-48.png` |
| Icônes PWA | `icon-192.png`, `icon-512.png`, `icon-maskable-192.png`, `icon-maskable-512.png` |
| Icône Apple | `apple-touch-icon.png` (180 px) |
| Image de partage | `og-image.png` (1200 × 630) |

En monochrome, la ligne d'eau est évidée (transparente) et laisse donc voir le fond.

**Version simplifiée pour les petites tailles :** jusqu'à 32 px, on utilise le favicon. Il n'a qu'une onde et des traits plus épais, parce que les deux ondes fines se confondent à 16 px.

## 4. Zone de protection et tailles minimales

- **Zone de protection :** un espace vide égal au quart de la hauteur du symbole, tout autour du logo. Aucun texte ni bord d'image dans cette zone.
- **Tailles minimales :** version horizontale à 24 px de haut ; version verticale à 48 px ; symbole complet à 32 px ; en dessous, le favicon (16 px minimum).

## 5. Fonds

- Fond clair (blanc, `#F7F9F7`) : version couleur.
- Fond sombre (`#14211A` ou plus foncé) : version « dark ».
- Fond vert de marque, photo ou fond coloré : monochrome blanc ; fond clair imprimé en une couleur : monochrome noir.

## 6. Usages interdits

- Redessiner, déformer, étirer, incliner ou faire pivoter le logo.
- Changer ses couleurs ou en ajouter (dégradés, ombres, contours, effets).
- Séparer les ondes de la goutte, ou changer l'ordre du symbole et du nom.
- Recomposer le nom dans une autre police.
- Placer le logo sur un fond qui ne respecte pas les contrastes ci-dessus.
- Utiliser le logo pour présenter une alerte indicative comme une alerte officielle (EXG-30).
- Utiliser une image générée par IA à la place des fichiers de `public/brand/`.

## 7. Dans le code

Le composant `src/components/brand/logo.tsx` affiche le logo à partir des fichiers de `public/brand/`. Le favicon, l'icône Apple et l'image de partage sont déclarés dans `src/app/layout.tsx`. `public/favicon.ico` est une copie générée de `public/brand/favicon.ico`, parce que les navigateurs demandent toujours ce chemin. Les icônes PWA sont déclarées dans `public/manifest.webmanifest`.
