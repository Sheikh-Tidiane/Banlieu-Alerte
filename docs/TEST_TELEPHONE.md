# Test sur téléphone – Banlieue Alerte

Le produit est conçu pour le téléphone : chaque parcours doit être testé sur un vrai appareil, pas seulement dans l'émulation du navigateur.

## 1. Même réseau Wi-Fi (test rapide)

- Lance le serveur de développement de façon à ce qu'il soit joignable depuis le réseau local (`npm run dev`, avec `-H 0.0.0.0` si l'adresse « Network » n'apparaît pas). Le terminal affiche une adresse du type `http://192.168.x.x:3000`.
- Ouvre cette adresse sur le téléphone connecté au **même Wi-Fi** que l'ordinateur.
- Selon la version de Next.js, il peut être nécessaire de déclarer l'adresse dans la configuration (option `allowedDevOrigins`) : vérifie la documentation de la version installée et note la solution dans `docs/DECISIONS.md`.
- Documente dans le `README.md` les causes d'échec courantes : pare-feu qui bloque le port 3000, VPN actif sur l'ordinateur, réseau Wi-Fi qui isole les appareils entre eux (dans ce cas, utiliser le partage de connexion d'un téléphone).

## 2. Limite importante : HTTPS obligatoire pour certaines fonctions

Une adresse `http://192.168...` n'est **pas** un contexte sécurisé. Les navigateurs mobiles y refusent la géolocalisation, parfois l'accès à la caméra, et n'installent pas la PWA. Seul `localhost` fait exception.

Conséquence : le parcours de signalement (position GPS, photo) et l'installation de la PWA **ne doivent pas être validés uniquement via l'adresse « Network » en HTTP**. Ne déclare jamais ces fonctions « vérifiées sur mobile » sans un test en HTTPS sur un vrai téléphone.

## 3. Options pour tester en HTTPS

| Option                                                                | Usage                                                                           | Remarque                                                                                                                              |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Version déployée en ligne**                                         | Recommandée pour la démo, les captures vidéo et les tests avec des utilisateurs | Adresse stable, HTTPS natif                                                                                                           |
| **Tailscale** (réseau privé)                                          | Test depuis un téléphone sans Wi-Fi commun                                      | Gratuit pour un usage personnel, fournit HTTPS ; accès limité aux appareils de l'équipe                                               |
| **Cloudflare Tunnel ou ngrok**                                        | Démo ou test ponctuel                                                           | Adresse `https://` temporaire, **publique tant qu'elle est ouverte** : ne l'expose pas avec de vraies données et ferme-la après usage |
| **HTTPS local de Next.js** (`--experimental-https`, selon la version) | Test local                                                                      | Le téléphone devra accepter un certificat non reconnu                                                                                 |

N'expose jamais une base contenant des données réelles ou personnelles via un tunnel public. Utilise les données de démonstration.

## 4. Ce qu'il faut vérifier sur un vrai téléphone

- Géolocalisation : la position se remplit et le refus de permission est géré avec un message clair.
- Photo : prise depuis l'appareil, compression et envoi.
- Signalement hors-ligne (mode avion), puis synchronisation au retour du réseau.
- Installation de la PWA sur l'écran d'accueil.
- Fluidité et lisibilité sur un petit écran et une connexion lente.

Consigne ces vérifications, avec la date, le modèle de téléphone et le mode utilisé (déployé, Tailscale, tunnel), dans le bilan de phase et dans `docs/PROGRESS.md`.
