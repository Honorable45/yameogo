/**
 * Données de référence (production comprise) : catégories, marques courantes, paramètres par défaut,
 * premier compte Responsable.
 *
 * Aucune coordonnée (WhatsApp, téléphone, adresse) n'est préremplie : elles sont saisies par la boutique
 * dans Paramètres. Aucun produit ni prix n'est créé ici.
 * Le script est idempotent : il peut être relancé sans créer de doublons.
 */
import { PrismaClient, ProductKind } from '@prisma/client';
import { hash } from '@node-rs/argon2';

const prisma = new PrismaClient();

const slugify = (v: string) =>
  v
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const CATEGORIES: [ProductKind, string][] = [
  ['PHONE', 'Smartphones'],
  ['ACCESSORY', 'Coques et étuis'],
  ['ACCESSORY', 'Chargeurs'],
  ['ACCESSORY', 'Câbles USB'],
  ['ACCESSORY', 'Écouteurs'],
  ['ACCESSORY', 'Écouteurs sans fil'],
  ['ACCESSORY', 'Batteries externes'],
  ['ACCESSORY', 'Films de protection'],
  ['ACCESSORY', 'Supports pour téléphone'],
  ['ACCESSORY', 'Cartes mémoire'],
  ['ACCESSORY', 'Autres accessoires'],
];

// Marques courantes : liste de départ, complétée automatiquement quand une nouvelle marque est saisie.
const BRANDS = ['Apple', 'Samsung', 'Tecno', 'Infinix', 'Xiaomi', 'Itel'];

async function main() {
  // Paramètres : valeurs neutres ; coordonnées à renseigner dans l'administration.
  await prisma.businessSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      shopName: 'YAMEOGO',
      tagline: 'Smartphones et accessoires',
      // Photos libres de droits (licence Unsplash) — remplaçables depuis Paramètres › Photos du site.
      heroImageUrl: 'https://images.unsplash.com/photo-1691449808001-bb8c157f0094?w=1600&q=80&fm=webp',
      heroImageAlt: 'Smartphone et écouteurs sans fil posés sur une table',
      phonesImageUrl: 'https://images.unsplash.com/photo-1556656793-08538906a9f8?w=1600&q=80&fm=webp',
      phonesImageAlt: 'Plusieurs smartphones posés à plat',
      shopImageUrl: 'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=1600&q=80&fm=webp',
      shopImageAlt: 'Smartphone posé sur sa boîte',
    },
  });

  for (const [position, [kind, name]] of CATEGORIES.entries()) {
    await prisma.category.upsert({ where: { slug: slugify(name) }, update: {}, create: { name, slug: slugify(name), kind, position } });
  }

  for (const [position, name] of BRANDS.entries()) {
    await prisma.brand.upsert({ where: { slug: slugify(name) }, update: {}, create: { name, slug: slugify(name), position } });
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
