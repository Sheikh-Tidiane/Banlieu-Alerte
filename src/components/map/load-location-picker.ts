// Point de chargement unique de la carte du formulaire. Le préchargement et next/dynamic
// passent par cette même fonction : le bundler produit alors un seul fichier, que le
// service worker met en cache pour l'usage hors ligne.
export const loadLocationPicker = () => import('./location-picker');
