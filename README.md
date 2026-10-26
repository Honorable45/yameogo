# YAMEOGO

Site commercial et application de gestion d’une boutique de téléphonie : vente d’accessoires, de téléphones (neufs, « venus » d’Europe ou des États-Unis, et d’occasion), réparations, stocks, approvisionnements, avis clients et statistiques financières.

Trois applications séparées, à la racine du dépôt :

| Dossier | Application | Port local |
|---|---|---|
| `backend/` | API REST NestJS + Prisma + PostgreSQL : règles métier, calculs financiers, sécurité | 4000 |
| `frontend/` | Site public Next.js : Téléphones, Accessoires, Devis, Boutique, Avis ; achats et devis envoyés sur **WhatsApp** | 3000 |
| `admin/` | Administration Next.js, sur son propre domaine : caisse, réparations, stocks, statistiques… | 3001 |

**Achats et devis par WhatsApp.** Pas de panier ni de formulaire de commande : chaque produit porte un bouton « Acheter » (verre dépoli) et le devis se termine par « Envoyer ma demande sur WhatsApp » ; la conversation s’ouvre avec un message pré-rempli (article, référence, prix et lien — ou modèle, panne et estimation). Numéro : celui saisi dans Paramètres (prérempli : +228 70 85 88 01). La vente est ensuite enregistrée par l’équipe dans la **Caisse** de l’administration, ce qui met à jour stock, encaissements et statistiques.

Monnaie : franc CFA (XOF), montants entiers. Langue : français. Fuseau des statistiques : `Africa/Lome` (configurable).

---

## Sommaire

1. [Architecture](#architecture)
2. [Installation locale](#installation-locale)
3. [Commandes](#commandes)
4. [Variables d’environnement](#variables-denvironnement)
5. [Règles de gestion](#règles-de-gestion)
6. [Sécurité](#sécurité)
7. [Tests](#tests)
8. [Déploiement (Vercel + Render)](#déploiement-vercel--render)
9. [Services externes](#services-externes)
10. [Fonctionnalités terminées](#fonctionnalités-terminées)
11. [Limitations connues](#limitations-connues)

---

## Architecture

```
.
├── backend/                 NestJS 11, Prisma 6, PostgreSQL
│   ├── prisma/              schéma, migrations, données de référence et de démonstration
│   ├── src/                 un module par domaine (repairs, orders, inventory, stats…)
│   └── test/                tests d’intégration (base PostgreSQL réelle)
├── frontend/                site public — Next.js 15, React 19, Tailwind CSS 4
│   └── src/app/(site)/      accueil, téléphones, accessoires, devis, panier, suivi, avis…
├── admin/                   administration — Next.js 15 (application distincte)
│   └── src/app/(app)/       vue d’ensemble, caisse, réparations, stocks, statistiques…
├── scripts/dev-db.sh        cluster PostgreSQL local (sans droits administrateur)
├── render.yaml              déploiement de l’API
└── pnpm-workspace.yaml
```

**Un seul système d’authentification**, porté par l’API. Chaque application Next.js relaie `/api/*` vers l’API (réécriture) : le cookie de session de l’équipe reste sur le domaine de l’administration (pas de cookie tiers).

**Identité visuelle.** Papier chaud `#F5F3EE`, encre `#15171C`, bleu nuit `#0F2147` en grands aplats (bandeaux, accueil), bleu `#1B3D7A` pour les actions et un accent ocre `#C4661F` pour les mises en avant. Titres en *Newsreader* (serif éditorial), texte en *IBM Plex Sans*, références en *IBM Plex Mono* — polices auto-hébergées (licence SIL OFL). Angles quasi droits, filets d’un pixel, pas de dégradés ni d’effets décoratifs. Les jetons sont définis dans `frontend/src/app/globals.css`.

---

## Installation locale

Prérequis : Node.js ≥ 20.18 (testé avec 24), pnpm 9 (`corepack enable`), PostgreSQL 14+ (testé avec 16).

```bash
pnpm install

# 1. Base de données
#    Option A — cluster local propre au projet (port 5436, aucun droit administrateur requis) :
pnpm db:start
#    Option B — votre propre PostgreSQL : renseignez DATABASE_URL dans backend/.env

# 2. Configuration
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
cp admin/.env.example admin/.env.local
#    Dans backend/.env : DATABASE_URL, APP_SECRET, DATA_ENCRYPTION_KEY, SEED_MANAGER_*
#    openssl rand -base64 48   → APP_SECRET
#    openssl rand -base64 32   → DATA_ENCRYPTION_KEY

# 3. Schéma et données de référence (catégories, marques/modèles courants, types de panne, compte Responsable)
pnpm --filter @yameogo/backend db:deploy
pnpm --filter @yameogo/backend db:seed

# 4. (facultatif) Données de démonstration — développement uniquement
pnpm --filter @yameogo/backend db:seed:demo

# 5. Lancer l’API (4000), le site (3000) et l’administration (3001)
pnpm dev
```

- Site : http://localhost:3100
- Administration : http://localhost:3101 — compte créé par `db:seed` avec `SEED_MANAGER_EMAIL` / `SEED_MANAGER_PASSWORD` (à changer après la première connexion, menu « Mon compte »).

### Application installable (PWA)

Le site s'installe comme une application (Android : bouton « Installer l'application » en pied de page ou menu du navigateur ; iPhone : Partager › Sur l'écran d'accueil).
- `frontend/src/app/manifest.ts` : nom, couleurs, icônes, raccourcis (Boutique, Accessoires, Devis).
- `frontend/public/sw.js` : pages en réseau d'abord (prix toujours à jour), dernière version vue hors connexion, sinon `hors-ligne.html` ; `/api` jamais mis en cache. Changer `VERSION` pour purger les caches.
- Icônes : `node frontend/scripts/generate-icons.mjs` (logotype « TH / STORE » sur bleu sombre).

### Importer le catalogue (production)

Remplissez `catalogue/accessoires.csv`, `catalogue/telephones.csv` et `catalogue/photos/` (dossier exclu de Git ; guide : `catalogue/LISEZMOI.md`), puis :

```bash
node scripts/import-catalogue.mjs --api https://<api>.onrender.com --essai   # vérifie tout, ne crée rien
node scripts/import-catalogue.mjs --api https://<api>.onrender.com           # importe
```

Le script passe par l’API avec le compte Responsable : stock initial tracé au coût indiqué, photos envoyées sur Cloudinary, téléphones mis en vente seulement avec au moins une photo. Il peut être relancé sans créer de doublon.

### Données de démonstration

`db:seed:demo` crée 13 accessoires, 5 pièces détachées, 4 téléphones d’occasion, 11 tarifs de réparation et deux comptes (`technicien@demo.yameogo.local`, `vendeur@demo.yameogo.local`, mot de passe affiché par le script). Tout est marqué « Démo » dans l’interface. Les photos proviennent d’Unsplash (licence libre) et illustrent des types d’articles : elles ne représentent pas un stock réel.

- Retirer la démo : `pnpm --filter @yameogo/backend db:demo:clear` (les éléments déjà liés à des opérations sont archivés, jamais supprimés).
- Le script refuse de s’exécuter si `NODE_ENV=production`.

---

## Commandes

| Commande | Rôle |
|---|---|
| `pnpm dev` | backend + frontend + admin en mode développement |
| `pnpm dev:backend` / `dev:frontend` / `dev:admin` | une seule application |
| `pnpm db:start` / `pnpm db:stop` | cluster PostgreSQL local |
| `pnpm --filter @yameogo/backend db:migrate` | créer/appliquer une migration (développement) |
| `pnpm --filter @yameogo/backend db:deploy` | appliquer les migrations (production) |
| `pnpm --filter @yameogo/backend db:seed` | données de référence (idempotent) |
| `pnpm test` | tests unitaires et d’intégration de l’API |
| `pnpm typecheck` | vérification TypeScript des deux applications |
| `pnpm build` | build de production des trois applications |
| `pnpm --filter @yameogo/backend start:prod` | migrations puis démarrage de l’API compilée |
| `pnpm --filter @yameogo/frontend start` / `@yameogo/admin start` | démarrage du site / de l’admin compilés |

---

## Variables d’environnement

### API (`backend/.env`)

| Variable | Obligatoire | Description |
|---|---|---|
| `DATABASE_URL` | oui | Connexion PostgreSQL |
| `APP_SECRET` | oui | ≥ 32 caractères. Signe les empreintes (sessions, codes d’avis, IMEI) |
| `DATA_ENCRYPTION_KEY` | oui | 32 octets en base64. Chiffre les IMEI (AES-256-GCM). **Ne jamais la changer** sans migrer les IMEI existants |
| `WEB_ORIGIN` | oui en prod | URL publique du site (CORS, liens d’avis) |
| `ADMIN_ORIGIN` | oui en prod | URL de l’administration (CORS) |
| `API_PUBLIC_URL` | oui en prod | URL publique de l’API (images stockées localement) |
| `PORT` | non | 4000 par défaut |
| `BUSINESS_TIMEZONE` | non | `Africa/Lome` par défaut |
| `SESSION_TTL_HOURS` | non | Durée de session, 12 h par défaut |
| `COOKIE_SECURE` | prod | `true` en HTTPS |
| `TRUST_PROXY` | prod | Nombre de proxys devant l’API (`2` via Vercel → Render) |
| `LOCAL_UPLOAD_DIR` | non | Dossier des photos sans Cloudinary |
| `CLOUDINARY_URL` | oui en prod | Photos sur Cloudinary (`cloudinary://CLE:SECRET@NOM_DU_CLOUD`). Absente : photos sur le disque (développement) |
| `PAYGATE_API_KEY` | non | Active le paiement TMoney/Flooz en ligne via PayGate Global |
| `SEED_MANAGER_EMAIL`, `SEED_MANAGER_NAME`, `SEED_MANAGER_PASSWORD` | au premier `db:seed` | Premier compte Responsable |

### Site (`frontend/.env.local`) et administration (`admin/.env.local`)

| Variable | Description |
|---|---|
| `API_URL` | URL de l’API, utilisée côté serveur et par le relais `/api` |
| `NEXT_PUBLIC_SITE_URL` | URL publique du site (SEO, liens WhatsApp ; côté admin : « Voir le site », QR codes d’avis) |

Aucun secret n’est nécessaire côté site.

---

## Règles de gestion

### Stock (accessoires et pièces)
- `stock` = quantité physique ; `réservé` = promis à des commandes en cours ; `disponible` = stock − réservé.
- Commande en ligne → **réservation**. Remise au client → **sortie** (coût figé au coût moyen). Annulation → libération.
- Vente au comptoir → sortie immédiate.
- Pièce ajoutée à une réparation → sortie immédiate (`REPAIR_USE`) ; pièce retirée → retour en stock à son coût figé.
- Approvisionnement validé → entrée au **coût de revient** (prix + frais annexes répartis au prorata) ; **coût moyen pondéré** recalculé.
- Toute variation est un mouvement daté, valorisé et attribué. Corrections et inventaires exigent une justification. Rien n’est supprimé.
- Concurrence : chaque opération verrouille la ligne article (`SELECT … FOR UPDATE`) ; la base refuse un stock négatif (contrainte `CHECK`). Testé par des commandes simultanées.

### Téléphones (neufs, venus, occasions)
Trois catégories : **Neuf** (jamais utilisé), **Venu** (déjà utilisé, importé d’Europe ou des États-Unis), **Occasion** (utilisé localement). Ancienne adresse `/occasions` redirigée vers `/telephones`.
Exemplaires uniques avec historique (`À vérifier → Disponible → Réservé → Vendu`, retour possible). IMEI chiffré, unicité garantie par une empreinte HMAC ; détection des fiches très proches (confirmation requise). Au moins une photo réelle est exigée pour la mise en vente. Marge brute = prix de vente − prix d’achat.

### Réparations
- Statut du dossier, statut de paiement et remise du téléphone sont trois informations distinctes.
- Devis versionnés ; la réponse du client est enregistrée par l’équipe ; tout est historisé.
- **Marge brute = montant facturé − pièces utilisées − consommables − autres coûts directs** (calculée par l’API).
- Une réparation annulée n’est jamais comptée ; un dossier encaissé ne peut être annulé qu’après remboursement.

### Avis clients
- Chaque réparation et chaque vente reçoit automatiquement un **code d’avis** (8 caractères), affiché dans l’administration sur le dossier ou la vente, avec QR code, impression et envoi WhatsApp au client.
- **Sans code, pas d’avis.** Le code n’est utilisable qu’une fois la réparation terminée ou la vente conclue, une seule fois, pendant 180 jours ; « Nouveau code » annule le précédent.
- L’avis est **publié immédiatement** (le code garantit un vrai client) ; la boutique peut ensuite le masquer ou y répondre publiquement. Son contenu n’est jamais modifié.

### Paiements
- Un paiement saisi par l’équipe est confirmé par elle (après réception effective des fonds).
- Un paiement mobile en ligne reste « en attente » jusqu’à une **vérification serveur à serveur** auprès du prestataire ; la notification reçue n’est jamais crue sur parole.
- Écritures jamais supprimées : annulation avec motif, ou remboursement.

### Statistiques
| Indicateur | Définition |
|---|---|
| Chiffre d’affaires | Commandes **terminées** (date de fin) + réparations terminées (date de fin) + frais de livraison − retours |
| Encaissé | Paiements confirmés (date de confirmation) − remboursements |
| Coûts directs | Coût figé des articles vendus (− retours remis en stock) + coûts directs des réparations terminées |
| Marge brute | CA − coûts directs |
| Dépenses générales | Dépenses actives à leur date (annulées/corrigées exclues) |
| Résultat estimé | Marge brute − dépenses générales (ce n’est **pas** un bénéfice net : ni impôts ni amortissements) |

Un achat de stock n’est jamais une dépense générale : il devient un coût lorsque l’article est vendu ou utilisé. Exports CSV : synthèse, ventes, réparations, dépenses.

---

## Sécurité

- Mots de passe : Argon2id. Verrouillage temporaire après 8 échecs, limitation de débit sur la connexion.
- Sessions opaques en base (empreinte HMAC), cookie `httpOnly`, `SameSite=Lax`, `Secure` en production ; fermeture des sessions au changement de mot de passe, de rôle ou à la désactivation.
- Anti-CSRF : en-tête `X-Requested-With` exigé sur toute requête modifiante authentifiée ; CORS limité au site.
- Toute route est privée par défaut ; permissions vérifiées par l’API (`backend/src/auth/permissions.ts`). Coûts, marges et IMEI filtrés selon le rôle dans les réponses.
- Validation stricte des entrées (champs inconnus écartés) ; requêtes paramétrées (Prisma).
- Fichiers : décodés et réencodés (WebP) — un fichier qui n’est pas une image est rejeté, métadonnées EXIF supprimées, 8 Mo maximum. Justificatifs et photos clients en zone privée, servis uniquement aux rôles autorisés.
- Journal des opérations sensibles (connexions, prix, paiements, stocks, consultation d’IMEI).
- En-têtes de sécurité (Helmet, `X-Frame-Options`, `noindex` sur l’administration).

**Rôles** : *Responsable* (tout), *Réparateur* (atelier, sans marges ni coûts du stock), *Vendeur* (comptoir et commandes, sans coûts).

---

## Tests

```bash
pnpm db:start                    # base de test yameogo_test sur le cluster local
pnpm test
```

- **Unitaires** (`src/**/*.spec.ts`) : marge de réparation (exemple 15 000 / 6 000 / 500 / 500 → 8 000), coût moyen pondéré, répartition des frais, périodes et fuseau, transitions, permissions.
- **Intégration** (`test/*.spec.ts`, application complète + PostgreSQL) : réservation et sortie de stock, prix imposés par le serveur, survente impossible en concurrence, annulation et remboursement, vente d’un téléphone unique, consommation/retour de pièces, devis accepté en ligne, tarif jamais inventé, avis vérifié à usage unique, approvisionnement et coût moyen, CSRF, rôles, masquage des coûts, statistiques (CA ≠ encaissements, annulations et dépenses annulées exclues).

La base de test est désignée par `TEST_DATABASE_URL` (par défaut `postgresql://yameogo@localhost:5436/yameogo_test`) ; elle est **vidée** à chaque exécution.

---

## Déploiement (Vercel + Render)

Trois services : l’API sur Render, le site et l’administration sur deux projets Vercel distincts. Les URL ci-dessous sont des exemples : remplacez-les par celles que Render et Vercel vous attribuent (sans `/` final).

### 1. Base de données et API sur Render
1. Créez le service depuis `render.yaml` (« New → Blueprint ») : il crée l’API et une base PostgreSQL 16. `APP_SECRET` est généré automatiquement.
2. Renseignez les variables marquées `sync: false` :

| Variable | Valeur |
|---|---|
| `WEB_ORIGIN` | URL du site, ex. `https://yameogo.vercel.app` |
| `ADMIN_ORIGIN` | URL de l’administration, ex. `https://yameogo-admin.vercel.app` |
| `API_PUBLIC_URL` | URL du service Render, ex. `https://yameogo-backend.onrender.com` |
| `DATA_ENCRYPTION_KEY` | `openssl rand -base64 32` — **à sauvegarder hors de Render** |
| `CLOUDINARY_URL` | Cloudinary → *API Keys* → « API environment variable » |
| `PAYGATE_API_KEY` | facultatif, laisser vide |

3. Le démarrage applique les migrations (`prisma migrate deploy`). Créez ensuite une fois le compte Responsable et les données de référence depuis le shell Render :
   `SEED_MANAGER_EMAIL=… SEED_MANAGER_PASSWORD=… pnpm --filter @yameogo/backend db:seed`
4. Vérifiez `https://<api>.onrender.com/health` → `{"status":"ok"}`.

Le disque d’un service Render est éphémère : **`CLOUDINARY_URL` est indispensable en production**, sinon les photos seraient perdues au redéploiement (l’API l’indique au démarrage). Les photos vont dans le dossier `yameogo/` du compte Cloudinary ; les justificatifs et photos envoyées par les clients y sont en accès « authenticated » (URL signée, lue uniquement par l’API).

### 2. Site et administration sur Vercel
Créez **deux projets** à partir du même dépôt (le `vercel.json` de chaque dossier installe l’espace de travail pnpm depuis la racine) :

| Projet | Root Directory | `API_URL` | `NEXT_PUBLIC_SITE_URL` |
|---|---|---|---|
| Site | `frontend` | `https://yameogo-backend.onrender.com` | URL du site |
| Administration | `admin` | `https://yameogo-backend.onrender.com` | URL du **site** (liens « Voir le site », QR codes d’avis) |

Si vous changez de domaine (domaine personnalisé), mettez à jour `WEB_ORIGIN` / `ADMIN_ORIGIN` sur Render et `NEXT_PUBLIC_SITE_URL` sur les deux projets Vercel, puis redéployez.

### 3. Sauvegardes
- Render PostgreSQL (offres payantes) : sauvegardes quotidiennes et restauration à un instant donné.
- En complément : `pg_dump --format=custom "$DATABASE_URL" > yameogo-$(date +%F).dump` planifié, stocké hors de Render. Restauration : `pg_restore --clean --no-owner -d "$DATABASE_URL" fichier.dump`.
- Conservez `DATA_ENCRYPTION_KEY` dans un coffre séparé : sans elle, les IMEI chiffrés sont illisibles.

---

## Services externes

| Service | Usage | Obligatoire |
|---|---|---|
| PostgreSQL hébergé (Render, Neon, Supabase…) | données | oui |
| Cloudinary (offre gratuite suffisante au démarrage) | photos, justificatifs | oui en production |
| Vercel | site | recommandé |
| Render | API | recommandé |
| PayGate Global | TMoney / Flooz en ligne | non — sans clé, le paiement en ligne est désactivé et masqué |

---

## Fonctionnalités terminées

Vérifiées par les tests automatisés, par des parcours manuels via l’API et par des captures du rendu (desktop et mobile).

- **Site public** : accueil plein écran (« YAMEOGO » et « Réparer, acheter et habiller votre téléphone » révélés progressivement, boutons en verre), rubriques Téléphones (neufs, venus, occasions), Accessoires (`/accessoires` : recherche, catégories, tri), Devis (marque → modèle → panne → estimation → WhatsApp), Boutique (`/boutique` : photo, adresse, horaires, contact, réseaux sociaux) et Avis ; bouton « Acheter » WhatsApp sur chaque produit ; liens TikTok, Instagram, Facebook et WhatsApp,  avis (liste et formulaire accessible par QR code, code d’avis obligatoire), contact et horaires, mentions légales et confidentialité générées depuis les paramètres, sitemap, robots, métadonnées et données structurées produit.
- **Administration** (application séparée, navigation réduite aux écrans du quotidien + groupe « Plus ») : vue d’ensemble (chiffres du jour, file de travail, échéances), réparations (création, devis, pièces, coûts, marge, paiements, remise, historique, bon de dépôt imprimable, code d’avis), demandes de devis et prise en charge, grille tarifaire, commandes (transitions, paiements, retours et remboursements), caisse (vente au comptoir, paiements multiples), articles et photos, téléphones d’occasion (IMEI protégé, doublons, historique), stocks (alertes, mouvements, corrections, inventaire), approvisionnements (brouillon, validation, annulation, règlements), fournisseurs et soldes, clients et historique, avis (publiés directement, masquage et réponse) et QR imprimable, dépenses (justificatifs, annulation, correction), statistiques (9 périodes, graphiques, comparaison, résultats par activité, classements, exports CSV), utilisateurs et rôles, paramètres (coordonnées, horaires, vente en ligne, photos du site, mentions légales, catégories, marques et modèles, types de panne), journal, recherche globale (Ctrl K).

---

## Limitations connues

- **Commandes WhatsApp** : la conversation n’est pas enregistrée automatiquement ; l’équipe saisit la vente dans la Caisse (stock et statistiques à jour). Les demandes de devis WhatsApp n’apparaissent pas dans « Demandes de devis » (cet écran reste utilisable pour des demandes saisies par l’API).
- **Paiement mobile en ligne** : intégration PayGate Global écrite d’après sa documentation publique (demande de paiement, vérification du statut) mais **non testée contre le service réel** faute de compte marchand. À valider avec un compte et la documentation à jour avant activation. Sans clé, l’option est désactivée.
- **Notifications** : aucun envoi de SMS, WhatsApp ou e-mail automatique (devis émis, téléphone prêt). Les liens de suivi se partagent manuellement (bouton « Copier le lien »).
- **Exports** : CSV uniquement (pas de PDF). Le bon de dépôt et l’affiche d’avis s’impriment depuis le navigateur.
- **Comptabilité** : le résultat estimé n’intègre ni amortissements, ni impôts, ni TVA.
- **Coût moyen** arrondi au franc près à chaque entrée ; l’écart cumulé reste de quelques francs.
- **Réseaux sociaux** : les liens TikTok, Instagram et Facebook s’affichent dès qu’ils sont saisis dans Paramètres › Boutique (adresses non fournies à ce jour).
- **Horaires, adresse, mentions légales, logo** : vides tant que la boutique ne les a pas saisis dans Paramètres. Seul le numéro WhatsApp/téléphone fourni (+228 70 85 88 01) est prérempli.
- **Photos** : celles de l’accueil et de la démonstration proviennent d’Unsplash ; remplacez-les par des photos de la boutique et de ses produits (Paramètres › Photos du site, fiches articles).
- **Déploiement** : configurations Vercel et Render fournies, **non déployées ni vérifiées en ligne** dans le cadre de ce travail.
