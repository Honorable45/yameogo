/**
 * Données de référence (production comprise) :
 * catégories, marques et modèles courants, types de panne, paramètres par défaut,
 * premier compte Responsable.
 *
 * Seul le numéro de la boutique (fourni par elle) est prérempli ; aucun tarif ni produit n'est créé ici :
 * ces informations sont saisies depuis l'administration.
 * Le script est idempotent : il peut être relancé sans créer de doublons.
 */
import { PrismaClient, ProductKind } from '@prisma/client';
import { hash } from '@node-rs/argon2';

const prisma = new PrismaClient();

const slugify = (v: string) =>
  v
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const ACCESSORY_CATEGORIES = [
  'Coques et protections',
  'Chargeurs',
  'Câbles',
  'Écouteurs',
  'Casques',
  'Batteries',
  'Supports de téléphone',
  'Accessoires iPhone',
  'Accessoires Samsung',
  'Accessoires Tecno',
  'Accessoires Infinix',
  'Accessoires Redmi',
  'Autres accessoires',
];

const PART_CATEGORIES = ['Écrans', 'Batteries de remplacement', 'Connecteurs de charge', 'Caméras', 'Haut-parleurs et micros', 'Vitres arrière et châssis', 'Autres pièces'];

// Modèles courants : liste de départ, modifiable depuis l'administration.
const BRANDS: Record<string, string[]> = {
  Apple: [
    'iPhone 8', 'iPhone 8 Plus', 'iPhone X', 'iPhone XR', 'iPhone XS', 'iPhone XS Max', 'iPhone 11', 'iPhone 11 Pro', 'iPhone 11 Pro Max',
    'iPhone SE (2020)', 'iPhone 12', 'iPhone 12 Pro', 'iPhone 12 Pro Max', 'iPhone 13', 'iPhone 13 Pro', 'iPhone 13 Pro Max',
    'iPhone 14', 'iPhone 14 Pro', 'iPhone 14 Pro Max', 'iPhone 15', 'iPhone 15 Pro', 'iPhone 15 Pro Max',
  ],
  Samsung: [
    'Galaxy A04', 'Galaxy A05', 'Galaxy A12', 'Galaxy A13', 'Galaxy A14', 'Galaxy A15', 'Galaxy A24', 'Galaxy A25', 'Galaxy A34', 'Galaxy A54',
    'Galaxy S21', 'Galaxy S22', 'Galaxy S23', 'Galaxy S23 Ultra', 'Galaxy S24',
  ],
  Tecno: ['Spark 10', 'Spark 20', 'Spark 20 Pro', 'Camon 20', 'Camon 30', 'Pova 5', 'Pop 8'],
  Infinix: ['Smart 8', 'Hot 30', 'Hot 40', 'Hot 40 Pro', 'Note 30', 'Note 40', 'Zero 30'],
  Redmi: ['Redmi 12', 'Redmi 13C', 'Redmi Note 12', 'Redmi Note 13', 'Redmi Note 13 Pro', 'Redmi A3'],
  Itel: ['A70', 'P55', 'S23', 'Vision 3'],
};

const REPAIR_TYPES: [string, string][] = [
  ['Écran cassé', 'Remplacement de l’écran ou de la vitre tactile.'],
  ['Batterie défectueuse', 'Autonomie faible, batterie gonflée ou qui se décharge vite.'],
  ['Connecteur de charge', 'Le téléphone ne charge plus ou seulement en tenant le câble.'],
  ['Caméra', 'Photo floue, caméra noire ou qui ne s’ouvre pas.'],
  ['Haut-parleur', 'Son faible, grésillements ou absence de son.'],
  ['Microphone', 'Votre correspondant ne vous entend pas.'],
  ['Téléphone qui ne s’allume plus', 'Diagnostic de la carte mère et de l’alimentation.'],
  ['Problème logiciel', 'Blocage, redémarrages, mise à jour ou réinitialisation.'],
  ['Autre panne', 'Décrivez le problème : nous établissons un diagnostic.'],
];

async function main() {
  // Paramètres : valeurs neutres ; coordonnées à renseigner dans l'administration.
  await prisma.businessSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      shopName: 'YAMEOGO',
      // Numéro communiqué par la boutique : commandes et devis passent par WhatsApp.
      phone: '+22870858801',
      whatsapp: '+22870858801',
      tagline: 'Téléphones neufs, venus et d’occasion, accessoires et réparation',
      // Photo libre de droits (licence Unsplash) — remplaçable depuis Paramètres.
      heroImageUrl: 'https://images.unsplash.com/photo-1691449808001-bb8c157f0094?w=1600&q=80&fm=webp',
      heroImageAlt: 'Smartphone, écouteurs sans fil et stylet posés sur une table grise',
      repairImageUrl: 'https://images.unsplash.com/photo-1639776738932-956082f0b704?w=1600&q=80&fm=webp',
      repairImageAlt: 'Technicien en gants démontant un smartphone',
      phonesImageUrl: 'https://images.unsplash.com/photo-1608386390658-86cf60bcf61a?w=1600&q=80&fm=webp',
      phonesImageAlt: 'iPhone bleus posés sur une table',
      shopImageUrl: 'https://images.unsplash.com/photo-1611396000732-f8c9a933424f?w=1600&q=80&fm=webp',
      shopImageAlt: 'Établi de réparation avec un iPhone démonté',
    },
  });

  for (const [kind, list] of [
    ['ACCESSORY', ACCESSORY_CATEGORIES],
    ['PART', PART_CATEGORIES],
  ] as [ProductKind, string[]][]) {
    for (const [position, name] of list.entries()) {
      const slug = (kind === 'PART' ? 'pieces-' : '') + slugify(name);
      await prisma.category.upsert({ where: { slug }, update: {}, create: { name, slug, kind, position } });
    }
  }

  for (const [position, [brandName, models]] of Object.entries(BRANDS).entries()) {
    const brand = await prisma.brand.upsert({
      where: { slug: slugify(brandName) },
      update: {},
      create: { name: brandName, slug: slugify(brandName), position },
    });
    for (const [mPos, name] of models.entries()) {
      await prisma.phoneModel.upsert({
        where: { brandId_slug: { brandId: brand.id, slug: slugify(name) } },
        update: {},
        create: { brandId: brand.id, name, slug: slugify(name), position: mPos },
      });
    }
  }

  for (const [position, [name, description]] of REPAIR_TYPES.entries()) {
    await prisma.repairType.upsert({ where: { slug: slugify(name) }, update: {}, create: { name, slug: slugify(name), description, position } });
  }

  if ((await prisma.user.count()) === 0) {
    const email = process.env.SEED_MANAGER_EMAIL?.trim().toLowerCase();
    const password = process.env.SEED_MANAGER_PASSWORD;
    if (!email || !password || password.length < 10) {
      console.warn('⚠ Aucun utilisateur créé : définissez SEED_MANAGER_EMAIL et SEED_MANAGER_PASSWORD (10 caractères minimum).');
    } else {
      await prisma.user.create({
        data: {
          email,
          name: process.env.SEED_MANAGER_NAME?.trim() || 'Responsable',
          role: 'MANAGER',
          passwordHash: await hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1 }),
        },
      });
      console.log(`Compte Responsable créé : ${email} (changez le mot de passe après la première connexion).`);
    }
  }
  console.log('Données de référence en place.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
