/**
 * DONNÉES DE DÉMONSTRATION — environnement de développement uniquement.
 *
 * Tous les éléments créés ici sont marqués `isDemo` (articles, téléphones, tarifs) ou portent
 * le domaine « demo.yameogo.local » (comptes). Les photos proviennent d'Unsplash (licence libre)
 * et illustrent le type d'article : elles ne représentent pas le stock réel d'une boutique.
 *
 *   pnpm db:seed:demo     → crée les données
 *   pnpm db:demo:clear    → retire les données de démonstration
 *
 * Refuse de s'exécuter si NODE_ENV=production.
 */
import { PrismaClient, PhoneGrade } from '@prisma/client';
import { hash } from '@node-rs/argon2';
import { randomReference } from '../src/common/counters';

const prisma = new PrismaClient();
const unsplash = (id: string) => `https://images.unsplash.com/photo-${id}`;
const DEMO_PASSWORD = 'Demo-yameogo-2026';

type DemoProduct = {
  sku: string;
  name: string;
  category: string;
  price: number;
  cost: number;
  stock: number;
  image?: string;
  alt?: string;
  description: string;
  compat?: { brand: string; model?: string }[];
  kind?: 'ACCESSORY' | 'PART';
  threshold?: number;
};

const PRODUCTS: DemoProduct[] = [
  { sku: 'DEMO-CHG-20W', name: 'Chargeur secteur USB‑C 20 W', category: 'chargeurs', price: 6500, cost: 3800, stock: 14, image: '1583863788434-e58a36330cf0', alt: 'Chargeur secteur blanc et son câble', description: 'Charge rapide Power Delivery jusqu’à 20 W. Port USB‑C, compatible avec la plupart des smartphones récents.', compat: [{ brand: 'apple' }, { brand: 'samsung' }] },
  { sku: 'DEMO-CAB-CC1', name: 'Câble USB‑C vers USB‑C tressé, 1 m', category: 'cables', price: 3000, cost: 1400, stock: 25, image: '1595756630452-736bc8ef3693', alt: 'Câble tressé noir enroulé', description: 'Gaine en nylon tressé, embouts renforcés. Charge et transfert de données.', compat: [{ brand: 'samsung' }, { brand: 'tecno' }, { brand: 'infinix' }, { brand: 'redmi' }] },
  { sku: 'DEMO-CAB-LGT', name: 'Câble USB vers Lightning, 1 m', category: 'cables', price: 3500, cost: 1700, stock: 18, image: '1492107376256-4026437926cd', alt: 'Câble blanc USB', description: 'Pour iPhone équipés d’un port Lightning (iPhone 5 à iPhone 14).', compat: [{ brand: 'apple' }] },
  { sku: 'DEMO-COQ-IP11', name: 'Coque silicone iPhone 11', category: 'coques-et-protections', price: 4000, cost: 1800, stock: 9, image: '1535157412991-2ef801c1748b', alt: 'Quatre coques en silicone de couleurs pastel', description: 'Silicone souple, intérieur microfibre, bords surélevés pour protéger l’écran et l’appareil photo.', compat: [{ brand: 'apple', model: 'iphone-11' }] },
  { sku: 'DEMO-COQ-GEO', name: 'Coque rigide motif géométrique', category: 'coques-et-protections', price: 5000, cost: 2200, stock: 4, image: '1623393884989-cb3663e431c5', alt: 'Coque à motif géométrique coloré', description: 'Coque rigide fine avec impression mate résistante aux rayures.', compat: [{ brand: 'apple', model: 'iphone-13' }] },
  { sku: 'DEMO-VER-TMP', name: 'Protection d’écran en verre trempé', category: 'coques-et-protections', price: 2500, cost: 700, stock: 40, image: '1583291023438-41cef6453b1f', alt: 'Smartphone posé sur une surface blanche', description: 'Verre trempé 9H, pose sans bulles en boutique sur demande.', compat: [{ brand: 'tecno' }, { brand: 'infinix' }, { brand: 'samsung' }] },
  { sku: 'DEMO-BAT-10K', name: 'Batterie externe 10 000 mAh, 3 câbles intégrés', category: 'batteries', price: 12000, cost: 7500, stock: 6, image: '1760708825913-65a50b3dc39b', alt: 'Batterie externe blanche avec trois câbles', description: 'Câbles USB‑C, Lightning et micro‑USB intégrés. Recharge environ deux smartphones.' },
  { sku: 'DEMO-ECO-JCK', name: 'Écouteurs filaires jack 3,5 mm', category: 'ecouteurs', price: 2500, cost: 1000, stock: 30, image: '1742570922875-e5a60e950307', alt: 'Écouteurs filaires blancs', description: 'Micro et télécommande intégrés.' },
  { sku: 'DEMO-ECO-BT', name: 'Écouteurs sans fil Bluetooth', category: 'ecouteurs', price: 15000, cost: 9000, stock: 5, image: '1639521234037-8160317e81d9', alt: 'Écouteurs sans fil et leur boîtier à côté d’un smartphone', description: 'Bluetooth 5.3, boîtier de charge, jusqu’à 5 heures d’écoute.' },
  { sku: 'DEMO-CSQ-BT', name: 'Casque Bluetooth circum‑auriculaire', category: 'casques', price: 18000, cost: 11000, stock: 3, image: '1505740420928-5e560c06d30e', alt: 'Casque noir sur fond jaune', description: 'Coussinets à mémoire de forme, pliable, autonomie annoncée de 30 heures.' },
  { sku: 'DEMO-SUP-BUR', name: 'Support de bureau en aluminium', category: 'supports-de-telephone', price: 6000, cost: 3200, stock: 8, image: '1604837394598-5b700b11f5e4', alt: 'Smartphone posé sur un support de bureau argenté', description: 'Hauteur et inclinaison réglables, base lestée antidérapante.' },
  { sku: 'DEMO-SUP-VOI', name: 'Support voiture pour grille d’aération', category: 'supports-de-telephone', price: 5000, cost: 2500, stock: 2, image: '1593465678160-f99a8371fcf6', alt: 'Smartphone fixé sur un support de voiture', description: 'Fixation par pince, rotation à 360°.' },
  { sku: 'DEMO-CHG-12W', name: 'Adaptateur secteur USB‑A 12 W', category: 'chargeurs', price: 4000, cost: 2000, stock: 0, image: '1517320069935-381614f8c1e5', alt: 'Adaptateur secteur blanc', description: 'Adaptateur compact un port USB‑A.' },
  // Pièces détachées (jamais publiées sur le site)
  { kind: 'PART', sku: 'DEMO-PCE-ECR-IP11', name: 'Écran LCD iPhone 11', category: 'pieces-ecrans', price: 0, cost: 18000, stock: 3, threshold: 1, description: 'Pièce de démonstration.' },
  { kind: 'PART', sku: 'DEMO-PCE-BAT-IP11', name: 'Batterie iPhone 11', category: 'pieces-batteries-de-remplacement', price: 0, cost: 6000, stock: 4, threshold: 1, description: 'Pièce de démonstration.' },
  { kind: 'PART', sku: 'DEMO-PCE-ECR-A14', name: 'Écran Galaxy A14', category: 'pieces-ecrans', price: 0, cost: 9500, stock: 2, threshold: 1, description: 'Pièce de démonstration.' },
  { kind: 'PART', sku: 'DEMO-PCE-CON-SP10', name: 'Connecteur de charge Tecno Spark 10', category: 'pieces-connecteurs-de-charge', price: 0, cost: 1500, stock: 6, threshold: 2, description: 'Pièce de démonstration.' },
  { kind: 'PART', sku: 'DEMO-PCE-BAT-HOT30', name: 'Batterie Infinix Hot 30', category: 'pieces-batteries-de-remplacement', price: 0, cost: 4500, stock: 1, threshold: 2, description: 'Pièce de démonstration.' },
];

type DemoPhone = { condition: 'NEW' | 'IMPORTED' | 'USED'; brand: string; model?: string; modelName: string; storage: number; color: string; grade: PhoneGrade; battery: number; defects?: string; accessories?: string; buy: number; sell: number; warranty: number; image: string; alt: string };

const PHONES: DemoPhone[] = [
  { condition: 'USED', brand: 'apple', model: 'iphone-11', modelName: 'iPhone 11', storage: 128, color: 'Blanc', grade: 'VERY_GOOD', battery: 86, accessories: 'Câble de charge', buy: 120000, sell: 165000, warranty: 3, image: '1591337676887-a217a6970a8a', alt: 'iPhone 11 blanc, vue de dos' },
  { condition: 'IMPORTED', brand: 'apple', model: 'iphone-12-pro', modelName: 'iPhone 12 Pro', storage: 256, color: 'Bleu', grade: 'GOOD', battery: 81, defects: 'Micro‑rayures sur le contour en acier.', accessories: 'Câble de charge, boîte', buy: 230000, sell: 295000, warranty: 3, image: '1608386390658-86cf60bcf61a', alt: 'iPhone 12 Pro bleu, vue de dos' },
  { condition: 'IMPORTED', brand: 'samsung', modelName: 'Galaxy S21+', storage: 128, color: 'Violet', grade: 'VERY_GOOD', battery: 88, accessories: 'Boîte d’origine', buy: 135000, sell: 180000, warranty: 3, image: '1610945265064-0e34e5519bbf', alt: 'Samsung Galaxy S21+ violet posé sur sa boîte' },
  { condition: 'NEW', brand: 'samsung', model: 'galaxy-s23-ultra', modelName: 'Galaxy S23 Ultra', storage: 256, color: 'Noir', grade: 'LIKE_NEW', battery: 100, accessories: 'Boîte scellée, câble USB‑C, stylet', buy: 520000, sell: 610000, warranty: 12, image: '1773414422164-eefdc240da58', alt: 'Samsung Galaxy S23 Ultra noir, vue de dos' },
];

// [marque, modèle, panne, pièces, main-d'œuvre, minutes]
const PRICES: [string, string, string, number, number, number][] = [
  ['apple', 'iphone-11', 'ecran-casse', 20000, 8000, 60],
  ['apple', 'iphone-11', 'batterie-defectueuse', 9000, 6000, 45],
  ['apple', 'iphone-11', 'connecteur-de-charge', 6000, 6000, 60],
  ['apple', 'iphone-12', 'ecran-casse', 35000, 10000, 60],
  ['apple', 'iphone-12', 'batterie-defectueuse', 12000, 6000, 45],
  ['samsung', 'galaxy-a14', 'ecran-casse', 12500, 5500, 60],
  ['samsung', 'galaxy-a14', 'connecteur-de-charge', 3000, 4000, 45],
  ['tecno', 'spark-10', 'ecran-casse', 9000, 5000, 60],
  ['tecno', 'spark-10', 'connecteur-de-charge', 2000, 3000, 30],
  ['infinix', 'hot-30', 'batterie-defectueuse', 5500, 3500, 30],
  ['redmi', 'redmi-note-12', 'ecran-casse', 14000, 6000, 60],
];

async function clear() {
  const demoProducts = await prisma.product.findMany({
    where: { isDemo: true },
    include: { _count: { select: { orderItems: true, repairParts: true, purchaseItems: true } } },
  });
  let archived = 0;
  for (const p of demoProducts) {
    if (p._count.orderItems || p._count.repairParts || p._count.purchaseItems) {
      // Des opérations y font référence : on archive au lieu de supprimer (traçabilité).
      await prisma.product.update({ where: { id: p.id }, data: { status: 'ARCHIVED', published: false } });
      archived++;
    } else {
      await prisma.$transaction([
        prisma.inventoryMovement.deleteMany({ where: { productId: p.id } }),
        prisma.inventoryCountLine.deleteMany({ where: { productId: p.id } }),
        prisma.product.delete({ where: { id: p.id } }),
      ]);
    }
  }
  const phones = await prisma.usedPhone.findMany({ where: { isDemo: true }, include: { _count: { select: { orderItems: true } } } });
  for (const ph of phones) {
    if (ph._count.orderItems) await prisma.usedPhone.update({ where: { id: ph.id }, data: { status: 'ARCHIVED' } });
    else await prisma.usedPhone.delete({ where: { id: ph.id } });
  }
  const { count: prices } = await prisma.repairPrice.deleteMany({ where: { isDemo: true } });
  await prisma.user.updateMany({ where: { email: { endsWith: '@demo.yameogo.local' } }, data: { active: false } });
  console.log(`Démo retirée : ${demoProducts.length - archived} article(s) supprimé(s), ${archived} archivé(s), ${phones.length} téléphone(s), ${prices} tarif(s).`);
}

async function seed() {
  const brands = await prisma.brand.findMany({ include: { models: true } });
  const brand = (slug: string) => {
    const b = brands.find((x) => x.slug === slug);
    if (!b) throw new Error(`Marque absente : ${slug}. Lancez d'abord « pnpm db:seed ».`);
    return b;
  };
  const model = (brandSlug: string, slug: string) => brand(brandSlug).models.find((m) => m.slug === slug);

  const supplier =
    (await prisma.supplier.findFirst({ where: { name: 'Fournisseur de démonstration' } })) ??
    (await prisma.supplier.create({ data: { name: 'Fournisseur de démonstration', notes: 'Créé par le script de démonstration.' } }));

  for (const p of PRODUCTS) {
    if (await prisma.product.findUnique({ where: { sku: p.sku } })) continue;
    const category = await prisma.category.findUniqueOrThrow({ where: { slug: p.category } });
    const kind = p.kind ?? 'ACCESSORY';
    const product = await prisma.product.create({
      data: {
        kind,
        sku: p.sku,
        slug: `${p.sku.toLowerCase()}`,
        name: p.name,
        description: p.description,
        categoryId: category.id,
        supplierId: supplier.id,
        salePrice: p.price,
        averageCost: p.cost,
        stockQuantity: p.stock,
        lowStockThreshold: p.threshold ?? 3,
        published: kind === 'ACCESSORY',
        isDemo: true,
        images: p.image ? { create: { url: unsplash(p.image), alt: p.alt ?? p.name, width: 1600, height: 1600 } } : undefined,
      },
    });
    if (p.stock > 0) {
      await prisma.inventoryMovement.create({
        data: { productId: product.id, type: 'INITIAL', quantity: p.stock, unitCost: p.cost, stockAfter: p.stock, averageCostAfter: p.cost, reason: 'Stock initial (démonstration)' },
      });
    }
    for (const c of p.compat ?? []) {
      const b = brand(c.brand);
      await prisma.productCompatibility.create({ data: { productId: product.id, brandId: b.id, phoneModelId: c.model ? (model(c.brand, c.model)?.id ?? null) : null } });
    }
  }

  for (const ph of PHONES) {
    const b = brand(ph.brand);
    if (await prisma.usedPhone.findFirst({ where: { isDemo: true, modelName: ph.modelName, color: ph.color } })) continue;
    const reference = await randomReference('TEL', async (r) => Boolean(await prisma.usedPhone.findUnique({ where: { reference: r } })));
    await prisma.usedPhone.create({
      data: {
        reference,
        slug: `${b.slug}-${ph.modelName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${ph.storage}go-${reference.toLowerCase()}`,
        brandId: b.id,
        phoneModelId: ph.model ? (model(ph.brand, ph.model)?.id ?? null) : null,
        modelName: ph.modelName,
        condition: ph.condition,
        storageGb: ph.storage,
        color: ph.color,
        grade: ph.grade,
        batteryHealth: ph.condition === 'NEW' ? null : ph.battery,
        knownDefects: ph.defects ?? null,
        includedAccessories: ph.accessories ?? null,
        description:
          ph.condition === 'NEW'
            ? 'Téléphone neuf, sous emballage d’origine.'
            : 'Téléphone contrôlé en atelier : écran, caméras, charge, réseau, Wi‑Fi, Bluetooth et capteurs testés.',
        purchasePrice: ph.buy,
        salePrice: ph.sell,
        warrantyMonths: ph.warranty,
        acquiredAt: new Date(Date.now() - 20 * 86400_000),
        acquiredFrom: ph.condition === 'IMPORTED' ? 'Lot importé d’Europe (démonstration)' : ph.condition === 'NEW' ? 'Distributeur (démonstration)' : 'Rachat particulier (démonstration)',
        status: 'AVAILABLE',
        isDemo: true,
        images: { create: { url: unsplash(ph.image), alt: ph.alt, width: 1600, height: 1600 } },
        events: { create: [{ type: 'CREATED', toStatus: 'PENDING_CHECK', message: 'Fiche créée (démonstration)' }, { type: 'STATUS', fromStatus: 'PENDING_CHECK', toStatus: 'AVAILABLE', message: 'Contrôle effectué, mis en vente' }] },
      },
    });
  }

  const types = await prisma.repairType.findMany();
  for (const [b, m, t, parts, labor, minutes] of PRICES) {
    const pm = model(b, m);
    const type = types.find((x) => x.slug === t);
    if (!pm || !type) continue;
    await prisma.repairPrice.upsert({
      where: { phoneModelId_repairTypeId: { phoneModelId: pm.id, repairTypeId: type.id } },
      update: {},
      create: { phoneModelId: pm.id, repairTypeId: type.id, partsPrice: parts, laborPrice: labor, totalPrice: parts + labor, durationMinutes: minutes, isDemo: true },
    });
  }

  const passwordHash = await hash(DEMO_PASSWORD, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
  for (const [email, name, role] of [
    ['technicien@demo.yameogo.local', 'Technicien démo', 'TECHNICIAN'],
    ['vendeur@demo.yameogo.local', 'Vendeur démo', 'SELLER'],
  ] as const) {
    await prisma.user.upsert({ where: { email }, update: { active: true }, create: { email, name, role, passwordHash } });
  }

  console.log('Données de démonstration créées.');
  console.log(`Comptes de démonstration : technicien@demo.yameogo.local / vendeur@demo.yameogo.local — mot de passe : ${DEMO_PASSWORD}`);
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusé : les données de démonstration ne doivent pas être créées en production.');
  }
  if (process.argv.includes('--clear')) await clear();
  else await seed();
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
