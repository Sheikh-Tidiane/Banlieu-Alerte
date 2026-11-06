# Sécurité – Banlieue Alerte

Revue de sécurité selon l'OWASP Top 10 (2021), faite le 5 novembre 2026 en fin de Phase 6. Chaque point indique la mesure en place et la preuve (test ou constat). Les limites connues sont listées à la fin.

## OWASP Top 10

| Risque | Mesures | Preuve |
|---|---|---|
| **A01 Contrôle d'accès défaillant** | Permissions vérifiées côté serveur pour chaque route (`src/permissions/`) ; portée géographique en filtre de requête ; second facteur obligatoire pour l'administrateur ; contrôle d'origine (CSRF) sur toute modification | Tests de refus 401/403 par rôle et hors portée (`tests/e2e/phase-3..6.spec.ts`, `tests/unit/permissions.test.ts`, `tests/unit/alerts.test.ts`, `tests/unit/mfa.test.ts`) |
| **A02 Défaillances cryptographiques** | Mots de passe : scrypt ; jetons (session, invitation, réinitialisation, codes de secours) : seule leur empreinte SHA-256 est stockée ; secret TOTP chiffré en AES-256-GCM ; cookie `httpOnly`, `SameSite=Lax`, `Secure` en production ; HSTS en production ; sauvegardes chiffrées (AES-256, PBKDF2) | Tests du chiffrement et des vecteurs TOTP ; test d'intégration : secret jamais en clair en base ; test de restauration exécuté le 5 nov. |
| **A03 Injection** | Requêtes Prisma paramétrées (aucune requête SQL brute construite à partir d'une entrée) ; validation Zod stricte de toute entrée ; contenus des habitants affichés comme texte (React) ; fiches de carte Leaflet échappées ; CSP sans `unsafe-eval` | Tests des validateurs (champs inconnus refusés) ; revue du code (`$queryRaw` seulement pour `SELECT 1`) |
| **A04 Conception non sécurisée** | Alertes envoyées seulement après approbation humaine ; garde centrale dans `dispatchAlert` ; comptes sensibles par invitation à usage unique ; mises à jour conditionnelles contre les doubles décisions ; simulateur de démonstration désactivé par défaut | Tests EXG-29 (envoi refusé avant approbation), EXG-33, D-063 |
| **A05 Mauvaise configuration** | En-têtes : CSP, HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` ; en-tête `X-Powered-By` retiré ; secrets uniquement par variables d'environnement (`.env.example`) ; image Docker non root | Test e2e des en-têtes (`tests/e2e/phase-6.spec.ts`) |
| **A06 Composants vulnérables** | Versions figées (`save-exact`) ; `npm audit --omit=dev` | 0 vulnérabilité en production le 5 nov. ; 14 modérées dans des outils de développement (plugins ESLint), sans effet sur l'application |
| **A07 Identification et authentification** | Limitation de débit sur la connexion, l'inscription et le second facteur ; même message pour un e-mail inconnu et un mauvais mot de passe ; sessions révoquées au blocage ou à la suppression ; TOTP refusant le rejeu ; 8 codes de secours à usage unique | Tests d'intégration du second facteur (code faux, rejeu, code de secours unique) |
| **A08 Intégrité des données et du logiciel** | Migrations versionnées ; dépendances verrouillées (`package-lock.json`) ; service worker qui ne met jamais en cache les réponses privées | D-042 ; tests hors ligne |
| **A09 Journalisation et surveillance** | Journal d'audit des actions sensibles (sans donnée personnelle) ; journal d'erreurs nettoyé (e-mails, numéros, positions, jetons masqués) ; supervision (`/api/health`, `/back-office/supervision`) | Tests : métadonnées d'audit filtrées ; erreur avec données personnelles journalisée sans elles ; panne météo visible |
| **A10 SSRF** | Le serveur n'appelle que des adresses fixes (Open-Meteo ; Overpass et OpenTopoData dans des scripts d'exploitation) ; aucune URL fournie par un utilisateur n'est appelée | Revue du code (`fetch` serveur limité à `src/lib/weather/open-meteo.ts`) |

## Données personnelles (loi sénégalaise, CDC §11)

- **Minimisation** : signalement sans compte ; positions publiques arrondies (environ 100 m) ; aucun numéro de téléphone collecté ; noms jamais publiés avec les commentaires.
- **Photos** : type vérifié sur le contenu, taille bornée, métadonnées EXIF supprimées par ré-encodage.
- **Droits** : export JSON des données du compte ; suppression du compte avec anonymisation ; consentement aux notifications.
- **Conservation** : purge quotidienne (D-043, D-065).

## Sauvegardes

```bash
BACKUP_PASSPHRASE=... sh scripts/backup.sh          # sauvegarde chiffrée dans backups/
BACKUP_PASSPHRASE=... sh scripts/restore-test.sh backups/<fichier>.sql.gz.enc
```

Le test de restauration recharge la sauvegarde dans une base temporaire, compare le nombre de lignes de sept tables clés avec la base source, puis supprime la base temporaire. Exécuté avec succès le 5 novembre 2026 : 39 tables, comptes identiques. La phrase secrète se conserve hors du serveur.

## Limites connues

- **CSP** : `unsafe-inline` reste autorisé pour les scripts, car les scripts d'amorçage de Next.js l'exigent sur les pages statiques. Une CSP à nonce imposerait un rendu dynamique de toutes les pages, y compris `/signaler`, utilisée hors ligne (D-066).
- **Limitation de débit en mémoire** : à déplacer en base ou dans Redis si plusieurs instances tournent (D-028).
- **Adresses e-mail non vérifiées** : aucun fournisseur d'e-mail ; les comptes sensibles passent par une invitation transmise à la main.
- **Photos de curage** : servies par la même route que les photos de signalement, protégées par des clés aléatoires de 128 bits plutôt que par un contrôle de rôle.
- **Pas de test d'intrusion externe** : la revue ci-dessus est interne.
- **Avant l'ouverture au public** : vérifier auprès de la CDP (Commission de protection des données personnelles) s'il faut une déclaration.
