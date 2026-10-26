# YAMEOGO

Boutique de smartphones et d’accessoires : site public avec choix des configurations (couleur, mémoire, stockage, état), panier et commande sur WhatsApp ; administration du catalogue, des prix, des stocks, de la caisse et des statistiques.

Projet indépendant, construit à partir de TH Store (même socle technique, sans la partie réparation). TH Store n’est ni modifié ni nécessaire au fonctionnement de YAMEOGO : dépôt Git, base de données, secrets et ports sont propres à YAMEOGO.

| Dossier | Rôle | Port local |
|---|---|---|
| `backend/` | API REST NestJS 11 + Prisma 6 + PostgreSQL ≥ 15 : règles métier, stocks, calculs financiers, sécurité | 4100 |
| `frontend/` | Site public Next.js 15 : smartphones, accessoires, promotions, panier, contact, avis | 3100 |
| `admin/` | Administration Next.js 15 (application séparée) : catalogue, caisse, ventes, stocks, statistiques | 3101 |

## Sommaire

1. [Démarrage local](#démarrage-local)
2. [Catalogue : fiches et configurations](#catalogue--fiches-et-configurations)
3. [Commandes WhatsApp](#commandes-whatsapp)
4. [Administration](#administration)
5. [Variables d’environnement](#variables-denvironnement)
6. [Tests](#tests)
7. [Déploiement (Render + Vercel)](#déploiement-render--vercel)
8. [Règles de gestion conservées](#règles-de-gestion-conservées)
9. [Limites connues](#limites-connues)

---

## Démarrage local

Prérequis : Node.js ≥ 20.18, pnpm 9 (`corepack enable`), PostgreSQL ≥ 15 (binaires locaux suffisants).

```bash
pnpm install

# 1. Base locale propre au projet (port 5436, bases yameogo et yameogo_test, sans droits administrateur)
./scripts/dev-db.sh start

# 2. Variables : copier les exemples, puis renseigner les secrets
cp backend/.env.example backend/.env           # DATABASE_URL, APP_SECRET, DATA_ENCRYPTION_KEY, SEED_MANAGER_*
cp frontend/.env.example frontend/.env.local
cp admin/.env.example admin/.env.local
#    openssl rand -base64 48   → APP_SECRET
#    openssl rand -base64 32   → DATA_ENCRYPTION_KEY
#    En local : DATABASE_URL="postgresql://yameogo@localhost:5436/yameogo?schema=public"

# 3. Schéma, données de référence (catégories, marques, compte Responsable)
pnpm --filter @yameogo/backend exec prisma migrate deploy
pnpm --filter @yameogo/backend exec prisma generate
pnpm --filter @yameogo/backend db:seed

# 4. (facultatif) Produits de démonstration — développement uniquement
pnpm --filter @yameogo/backend db:seed:demo

# 5. Lancer l’API (4100), le site (3100) et l’administration (3101)
pnpm dev
```

- Site : http://localhost:3100
- Administration : http://localhost:3101 — compte créé par `db:seed` avec `SEED_MANAGER_EMAIL` / `SEED_MANAGER_PASSWORD` (à changer après la première connexion, menu « Mon compte »).
- Lancement séparé : `pnpm dev:backend`, `pnpm dev:frontend`, `pnpm dev:admin`.

### Données de démonstration

`db:seed:demo` crée 8 produits (Galaxy A56 à 5 configurations dont une épuisée et une en promotion, iPhone 13 neuf et d’occasion, Tecno, Infinix, coque à 3 couleurs, câble en 2 longueurs, écouteurs avec photos par couleur, chargeur). Tout est marqué « Démo » dans l’administration ; prix et stocks sont fictifs ; les photos (Unsplash, licence libre) illustrent le type d’article. Retrait : `pnpm --filter @yameogo/backend db:demo:clear` (un produit déjà vendu est archivé, jamais supprimé). Le script refuse de s’exécuter si `NODE_ENV=production`.

---

## Catalogue : fiches et configurations

- **Fiche produit** (`ProductGroup`) : ce que le client consulte — nom, marque, catégorie, description, caractéristiques techniques (liste libre), photos, compatibilité (accessoires), visibilité, mise en avant.
- **Configuration** (`Product`) : chaque variante réellement vendue est un article à part entière, avec **son prix, son prix barré, son stock, son coût moyen et sa référence** (ex. « Noir · 8 Go / 256 Go · Neuf », `TEL-7K3QX9`).
  - Smartphones : couleur (avec pastille), RAM, stockage, état (neuf / occasion) — chacun facultatif.
  - Accessoires : couleur et une option libre nommée sur la fiche (« Longueur », « Capacité »…). La RAM, le stockage et l’état ne sont jamais proposés pour un accessoire (refusés par l’API).
  - Aucun nombre fixe : autant de couleurs, capacités et configurations que nécessaire. Une configuration identique ne peut exister deux fois (contrainte en base).
- **Promotion** : un prix barré supérieur au prix de vente. La page `/promotions` liste les produits ayant une configuration en promotion **disponible**.
- **Photos** : jusqu’à 12 par fiche ; chacune peut être associée à une couleur (affichée en premier quand le client choisit cette couleur).

### Choix des caractéristiques sur le site

Seules les valeurs existantes pour le modèle sont proposées. Une valeur incompatible avec les autres choix apparaît en pointillés (la choisir bascule vers la configuration existante la plus proche) ; une valeur épuisée est barrée. Le prix et la disponibilité suivent la configuration choisie ; la quantité est limitée au stock disponible (10 au plus). Une configuration épuisée ne peut être ni commandée ni ajoutée au panier. L’adresse de la page mémorise la configuration (`?configuration=…`).

---

## Commandes WhatsApp

- **Bouton « Commander sur WhatsApp »** sur chaque fiche, et dans le panier pour plusieurs produits.
- Avant d’ouvrir WhatsApp, le site **redemande au serveur** le prix et le stock de chaque configuration (`POST /shop/cart/check`) : le message contient toujours les prix réels.
- Le message est **prérempli, jamais envoyé automatiquement** ; le site n’annonce jamais qu’une commande est confirmée. Exemple (une configuration) :

```
Bonjour YAMEOGO,

Je souhaite commander le produit suivant :

PRODUIT
- Téléphone : Samsung Galaxy A56
- Couleur : Noir
- Mémoire RAM : 8 Go
- Stockage : 256 Go
- État : Neuf
- Quantité : 1
- Prix unitaire : 165 000 FCFA
- Total estimé : 165 000 FCFA
- Référence : TEL-XXXXXX

Merci de me confirmer la disponibilité de cette configuration ainsi que les modalités de livraison et de paiement.

Cordialement.
```

  Pour plusieurs produits : une section numérotée par produit (caractéristiques, quantité, prix unitaire, sous-total), puis « TOTAL ESTIMÉ ». Seules les caractéristiques renseignées apparaissent (pas de RAM pour une coque).
- Lien : `https://api.whatsapp.com/send?phone=<numéro sans +>&text=<message encodé>` (fonctionne sur téléphone et ordinateur).
- **Panier** : conservé dans le navigateur du client (identifiants et quantités uniquement, jamais de prix). Une ligne épuisée ou en quantité excessive bloque la commande, avec correction en un clic.

### Configurer le numéro WhatsApp de la boutique

Aucun numéro n’est prérempli. Dans l’administration : **Plus › Paramètres › Boutique › « Numéro WhatsApp de la boutique »**, au format international (ex. `+228 90 00 00 00`), puis Enregistrer. Le site le prend en compte en une minute environ. Tant qu’il est vide, les boutons de commande sont désactivés et le site affiche : « La commande par WhatsApp sera disponible dès que la boutique aura renseigné son numéro. » Le numéro est centralisé dans les paramètres (`BusinessSettings.whatsapp`) et lu par `frontend/src/lib/whatsapp.ts`.

Dans le même écran : téléphone, e-mail, adresse, ville, position GPS (carte et itinéraire de la page Contact), réseaux sociaux, et **« Livraison et paiement »** (affiché dans le panier et sur la page Contact).

---

## Administration

- **Accueil** : chiffres du jour, à traiter (commandes, ventes non réglées, articles à réapprovisionner), dernières ventes.
- **Smartphones / Accessoires** : liste des fiches (configurations, stock, épuisées, fourchette de prix, promotion, « Démo ») ; création et modification :
  - informations, caractéristiques techniques (rubriques courantes proposées pour un smartphone) ;
  - configurations : couleur et pastille, RAM, stockage, état ou option, prix, prix barré, stock, coût d’achat des unités ajoutées, retrait de la vente, duplication ;
  - **générateur** : toutes les combinaisons de valeurs saisies (ex. 3 couleurs × 2 RAM × 2 stockages) au même prix de départ, à ajuster ;
  - photos par couleur, photo principale ;
  - archivage (le produit disparaît du site, son historique est conservé) ; suppression réservée aux produits jamais vendus ni approvisionnés.
- **Stock depuis la fiche** : une hausse est une entrée valorisée (coût moyen recalculé), une baisse une correction tracée (impossible sous les quantités réservées). Les achats fournisseurs passent par **Approvisionnements**.
- **Caisse** : vente au comptoir de n’importe quelle configuration, paiements multiples, ticket 80 mm imprimé avec le code d’avis.
- **Ventes, Stocks, Approvisionnements, Fournisseurs, Clients, Dépenses, Avis, Statistiques, Utilisateurs, Paramètres, Journal** : repris de TH Store, sans la réparation.
- Rôles : **Responsable** (tout) et **Vendeur** (caisse, ventes, consultation du catalogue et des stocks, codes d’avis ; ni coûts, ni marges, ni modification des produits). Vérifiés par l’API sur chaque route.

---

## Variables d’environnement

### API (`backend/.env`)

| Variable | Obligatoire | Description |
|---|---|---|
| `DATABASE_URL` | oui | PostgreSQL ≥ 15 |
| `APP_SECRET` | oui | ≥ 32 caractères. Signe les sessions et les codes d’avis |
| `DATA_ENCRYPTION_KEY` | oui | 32 octets en base64. Chiffre les codes d’avis conservés. **Ne jamais la changer** |
| `WEB_ORIGIN` | oui en prod | URL du site (CORS, liens des codes d’avis) |
| `ADMIN_ORIGIN` | oui en prod | URL de l’administration (CORS) |
| `API_PUBLIC_URL` | non | URL publique de l’API (photos sans Cloudinary) ; sur Render, déduite de `RENDER_EXTERNAL_URL` |
| `CLOUDINARY_URL` | oui en prod | Photos sur Cloudinary (`cloudinary://CLE:SECRET@NOM_DU_CLOUD`). Absente : photos sur le disque (développement) |
| `PORT` | non | 4100 par défaut (Render fournit le sien) |
| `COOKIE_SECURE` / `TRUST_PROXY` / `NODE_ENV` | prod | `true` / `2` / `production` (déjà dans `render.yaml`) |
| `SEED_MANAGER_EMAIL`, `SEED_MANAGER_NAME`, `SEED_MANAGER_PASSWORD` | au premier `db:seed` | Premier compte Responsable |
| `PAYGATE_API_KEY` | non | Paiement mobile en ligne (inutilisé par le parcours WhatsApp) |

### Site (`frontend/.env.local`) et administration (`admin/.env.local`)

| Variable | Description |
|---|---|
| `API_URL` | URL de l’API (relais `/api` côté serveur). Obligatoire sur Vercel, en `https://` |
| `NEXT_PUBLIC_SITE_URL` | Site : facultative sur Vercel (adresse de production déduite automatiquement) ; admin : inutile (l’adresse du site est lue depuis l’API) |

Aucun secret n’est nécessaire côté site ni côté administration ; aucun secret n’est exposé au navigateur.

---

## Tests

```bash
./scripts/dev-db.sh start
pnpm test          # 40 tests (unitaires et d’intégration) sur la base yameogo_test, vidée à chaque exécution
pnpm typecheck     # les trois applications
pnpm build         # builds de production
```

Les tests d’intégration couvrent notamment : création d’un smartphone et de ses configurations (prix et stock par configuration, stock initial tracé), refus des doublons et des prix barrés incohérents, accessoires sans RAM/stockage/état, modification de prix et de stock répercutée sur le site, archivage d’une configuration déjà vendue, vérification du panier par le serveur, filtres du catalogue, commandes et réservations (survente simultanée refusée), paiements, avis à code unique, autorisations et masquage des coûts, statistiques.

Scénarios vérifiés dans Chrome (bureau et 390 px) : choix couleur/RAM/stockage et prix correspondant, message WhatsApp exact (une configuration, accessoire, panier de plusieurs produits), configuration épuisée non commandable, création d’un produit par le générateur dans l’administration puis visibilité sur le site, absence de défilement horizontal sur mobile, comportement sans numéro WhatsApp.

---

## Déploiement (Render + Vercel)

Trois services : l’API sur Render, le site et l’administration sur deux projets Vercel. **PostgreSQL 15 ou plus** est requis (index « NULLS NOT DISTINCT »).

1. **Render** (« New → Blueprint » depuis `render.yaml`) : renseigner `WEB_ORIGIN`, `ADMIN_ORIGIN`, `DATA_ENCRYPTION_KEY`, `CLOUDINARY_URL`. Le démarrage applique les migrations. Puis, une fois : `SEED_MANAGER_EMAIL=… SEED_MANAGER_PASSWORD=… pnpm --filter @yameogo/backend db:seed` (ou depuis un poste, avec `DATABASE_URL` de production).
2. **Vercel — site** : Root Directory `frontend`, variable `API_URL=https://<api>.onrender.com`.
3. **Vercel — administration** : Root Directory `admin`, même `API_URL`.
4. Dans l’administration : renseigner le **numéro WhatsApp** et les coordonnées, puis créer les produits.

Le build Vercel échoue volontairement si `API_URL` est absente ou interne (jamais de lien `localhost` en production).

---

## Règles de gestion conservées

- **Stock** par configuration : `stock` physique, `réservé` (commandes en cours), `disponible` = stock − réservé ; jamais négatif (contrainte en base) ; toute variation est un mouvement tracé ; coût moyen pondéré recalculé à chaque entrée valorisée.
- **Ventes** : les prix sont toujours recalculés par l’API ; un prix modifié en caisse est réservé au Responsable et journalisé.
- **Statistiques** : chiffre d’affaires (smartphones, accessoires, livraison) distinct des encaissements ; marge brute = CA − coût moyen des articles vendus ; résultat estimé = marge brute − dépenses (ce n’est pas un bénéfice net). Les dépenses ne sont jamais supprimées : elles sont annulées ou corrigées.
- **Avis** : un code unique par vente (ticket, WhatsApp, QR), utilisable une fois la commande remise, une seule fois ; avis publiés directement, masquables par la boutique.
- **Références d’articles** aléatoires (`TEL-…`, `ACC-…`) : elles ne révèlent ni le volume du stock ni les références voisines.

## Limites connues

- **Numéro WhatsApp, coordonnées, mentions légales, logo** : vides tant que la boutique ne les a pas saisis dans Paramètres (aucune valeur inventée).
- **Panier** : propre à chaque navigateur (pas de compte client) ; la commande n’existe dans l’administration qu’une fois saisie en caisse par la boutique.
- **Import en masse** : le script d’import CSV de TH Store, fondé sur l’ancien modèle (téléphones à l’unité), n’a pas été repris ; les produits se créent dans l’administration (générateur de configurations).
- **Commandes en ligne et paiement mobile** (routes `/shop/orders`, PayGate) : présents dans l’API, hérités de TH Store, non utilisés par le parcours WhatsApp.
- **Déploiement** : configurations Render et Vercel fournies, non déployées dans le cadre de ce travail.
