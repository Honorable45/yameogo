/**
 * DONNÉES DE DÉMONSTRATION — environnement de développement uniquement.
 *
 * Tous les produits créés ici sont marqués `isDemo` et s'affichent avec la mention « Démo » dans
 * l'administration. Prix et stocks sont fictifs. Les photos proviennent d'Unsplash (licence libre)
 * et illustrent le type d'article : elles ne représentent pas le stock réel d'une boutique.
 * Les caractéristiques techniques reprennent les fiches publiques des constructeurs.
 *
 *   pnpm db:seed:demo     → crée les données
 *   pnpm db:demo:clear    → retire les données de démonstration
 *
 * Refuse de s'exécuter si NODE_ENV=production.
 */
import { PhoneCondition, PrismaClient, ProductKind } from '@prisma/client';
import { randomReference } from '../src/common/counters';

const prisma = new PrismaClient();
const unsplash = (id: string) => `https://images.unsplash.com/photo-${id}`;

type DemoVariant = {
  color?: string;
  hex?: string;
  ram?: number;
  storage?: number;
  condition?: PhoneCondition;
  option?: string;
  price: number;
  compareAt?: number;
  cost: number;
  stock: number;
};

type DemoGroup = {
  kind: ProductKind;
  name: string;
  brand?: string;
  category: string;
  description: string;
  specs?: [string, string][];
  optionName?: string;
  compatibleWith?: string;
  featured?: boolean;
  images: { id: string; alt: string; color?: string }[];
  variants: DemoVariant[];
};

const NOIR = '#1d1d1f';

const GROUPS: DemoGroup[] = [
  {
    kind: 'PHONE',
    name: 'Samsung Galaxy A56',
    brand: 'samsung',
    category: 'smartphones',
    featured: true,
    description: 'Grand écran fluide, photo polyvalente et grande autonomie. Mises à jour Android assurées sur plusieurs années.',
    specs: [
      ['Écran', '6,7 pouces Super AMOLED, 120 Hz'],
      ['Processeur', 'Exynos 1580'],
      ['Appareil photo', '50 Mpx (principal) + 12 Mpx (ultra grand-angle) + 5 Mpx (macro)'],
      ['Batterie', '5 000 mAh, charge rapide 45 W'],
      ['Réseau', '5G, double SIM'],
    ],
    images: [{ id: '1610945265064-0e34e5519bbf', alt: 'Smartphone Samsung posé sur sa boîte' }],
    variants: [
      { color: 'Noir', hex: NOIR, ram: 8, storage: 128, condition: 'NEW', price: 150000, cost: 128000, stock: 4 },
      { color: 'Noir', hex: NOIR, ram: 8, storage: 256, condition: 'NEW', price: 165000, cost: 140000, stock: 3 },
      { color: 'Bleu', hex: '#2f4a73', ram: 8, storage: 256, condition: 'NEW', price: 165000, cost: 140000, stock: 0 },
      { color: 'Bleu', hex: '#2f4a73', ram: 12, storage: 256, condition: 'NEW', price: 185000, cost: 158000, stock: 2 },
      { color: 'Gris', hex: '#8a8d91', ram: 8, storage: 128, condition: 'NEW', price: 145000, compareAt: 155000, cost: 128000, stock: 2 },
    ],
  },
  {
    kind: 'PHONE',
    name: 'iPhone 13',
    brand: 'apple',
    category: 'smartphones',
    featured: true,
    description: 'Écran OLED lumineux, double appareil photo et puce A15 Bionic. Disponible neuf ou d’occasion contrôlée.',
    specs: [
      ['Écran', '6,1 pouces Super Retina XDR (OLED)'],
      ['Puce', 'A15 Bionic'],
      ['Appareil photo', 'Double 12 Mpx (grand-angle et ultra grand-angle)'],
      ['Réseau', '5G, nano-SIM et eSIM'],
      ['Protection', 'IP68 (résistance à l’eau et à la poussière)'],
    ],
    images: [
      { id: '1591337676887-a217a6970a8a', alt: 'iPhone vu de face, écran allumé' },
      { id: '1580910051074-3eb694886505', alt: 'iPhone blanc posé sur un drap', color: 'Lumière stellaire' },
    ],
    variants: [
      { color: 'Minuit', hex: '#1f2229', storage: 128, condition: 'USED', price: 260000, cost: 215000, stock: 2 },
      { color: 'Lumière stellaire', hex: '#f1ece4', storage: 128, condition: 'USED', price: 255000, cost: 212000, stock: 1 },
      { color: 'Minuit', hex: '#1f2229', storage: 256, condition: 'NEW', price: 385000, cost: 335000, stock: 1 },
    ],
  },
  {
    kind: 'PHONE',
    name: 'Tecno Spark 20 Pro',
    brand: 'tecno',
    category: 'smartphones',
    description: 'Écran 120 Hz, capteur photo de 108 Mpx et grande batterie, à un prix accessible.',
    specs: [
      ['Écran', '6,78 pouces, 120 Hz'],
      ['Processeur', 'MediaTek Helio G99'],
      ['Appareil photo', '108 Mpx'],
      ['Batterie', '5 000 mAh, charge 33 W'],
    ],
    images: [{ id: '1598327105666-5b89351aff97', alt: 'Smartphone Android, écran d’accueil allumé' }],
    variants: [{ color: 'Noir', hex: NOIR, ram: 8, storage: 256, condition: 'NEW', price: 105000, cost: 86000, stock: 5 }],
  },
  {
    kind: 'PHONE',
    name: 'Infinix Hot 40 Pro',
    brand: 'infinix',
    category: 'smartphones',
    description: 'Écran 120 Hz, charge rapide et grande capacité de stockage.',
    specs: [
      ['Écran', '6,78 pouces, 120 Hz'],
      ['Processeur', 'MediaTek Helio G99'],
      ['Appareil photo', '108 Mpx'],
      ['Batterie', '5 000 mAh, charge 33 W'],
    ],
    images: [{ id: '1585060544812-6b45742d762f', alt: 'Smartphone posé sur une table en bois' }],
    variants: [
      { color: 'Bleu', hex: '#3a6ea5', ram: 8, storage: 256, condition: 'NEW', price: 95000, compareAt: 105000, cost: 80000, stock: 3 },
      { color: 'Noir', hex: NOIR, ram: 8, storage: 256, condition: 'NEW', price: 95000, cost: 80000, stock: 6 },
    ],
  },
  {
    kind: 'PHONE',
    name: 'iPhone 15',
    brand: 'apple',
    category: 'smartphones',
    featured: true,
    description: 'Dynamic Island, appareil photo principal de 48 Mpx et port USB-C. Puce A16 Bionic.',
    specs: [
      ['Écran', '6,1 pouces Super Retina XDR (OLED)'],
      ['Puce', 'A16 Bionic'],
      ['Appareil photo', '48 Mpx (principal) + 12 Mpx (ultra grand-angle)'],
      ['Connecteur', 'USB-C'],
      ['Protection', 'IP68 (résistance à l’eau et à la poussière)'],
    ],
    images: [{ id: '1695048133142-1a20484d2569', alt: 'iPhone 15 posé sur un fond sombre, écran allumé' }],
    variants: [
      { color: 'Noir', hex: '#35393b', storage: 128, condition: 'NEW', price: 520000, cost: 465000, stock: 2 },
      { color: 'Noir', hex: '#35393b', storage: 256, condition: 'NEW', price: 590000, cost: 528000, stock: 1 },
      { color: 'Bleu', hex: '#d4e1e9', storage: 128, condition: 'NEW', price: 520000, cost: 465000, stock: 1 },
      { color: 'Rose', hex: '#f2d8d9', storage: 128, condition: 'NEW', price: 520000, cost: 465000, stock: 0 },
    ],
  },
  {
    kind: 'PHONE',
    name: 'Samsung Galaxy S23 Ultra',
    brand: 'samsung',
    category: 'smartphones',
    featured: true,
    description: 'Capteur photo de 200 Mpx, zoom puissant et stylet S Pen intégré. Disponible neuf ou d’occasion contrôlée.',
    specs: [
      ['Écran', '6,8 pouces Dynamic AMOLED 2X, 120 Hz'],
      ['Processeur', 'Snapdragon 8 Gen 2 for Galaxy'],
      ['Appareil photo', '200 Mpx (principal), téléobjectifs zoom 3x et 10x'],
      ['Batterie', '5 000 mAh, charge rapide 45 W'],
      ['Stylet', 'S Pen intégré'],
    ],
    images: [
      { id: '1678911820864-e2c567c655d7', alt: 'Samsung Galaxy S23 Ultra noir et son stylet S Pen' },
      { id: '1709744722656-9b850470293f', alt: 'Dos d’un smartphone Samsung Ultra et ses capteurs photo' },
    ],
    variants: [
      { color: 'Noir', hex: '#1f1f22', ram: 12, storage: 256, condition: 'NEW', price: 610000, cost: 545000, stock: 1 },
      { color: 'Noir', hex: '#1f1f22', ram: 12, storage: 256, condition: 'USED', price: 430000, compareAt: 470000, cost: 370000, stock: 2 },
      { color: 'Vert', hex: '#5a6b5d', ram: 12, storage: 512, condition: 'NEW', price: 690000, cost: 615000, stock: 1 },
    ],
  },
  {
    kind: 'PHONE',
    name: 'Xiaomi 11 Lite 5G NE',
    brand: 'xiaomi',
    category: 'smartphones',
    description: 'Très fin et léger, écran AMOLED 90 Hz et triple appareil photo de 64 Mpx.',
    specs: [
      ['Écran', '6,55 pouces AMOLED, 90 Hz'],
      ['Processeur', 'Snapdragon 778G'],
      ['Appareil photo', '64 Mpx (principal) + 8 Mpx (ultra grand-angle) + 5 Mpx (macro)'],
      ['Batterie', '4 250 mAh, charge rapide 33 W'],
      ['Réseau', '5G, double SIM'],
    ],
    images: [{ id: '1621330396173-e41b1cafd17f', alt: 'Deux smartphones Xiaomi aux couleurs pastel, vus de dos' }],
    variants: [
      { color: 'Bleu', hex: '#9fd3e6', ram: 8, storage: 128, condition: 'NEW', price: 135000, compareAt: 150000, cost: 112000, stock: 3 },
      { color: 'Noir', hex: NOIR, ram: 8, storage: 128, condition: 'NEW', price: 135000, cost: 112000, stock: 2 },
      { color: 'Noir', hex: NOIR, ram: 8, storage: 256, condition: 'NEW', price: 150000, cost: 125000, stock: 1 },
    ],
  },
  {
    kind: 'PHONE',
    name: 'iPhone 12',
    brand: 'apple',
    category: 'smartphones',
    description: 'Occasion contrôlée : écran OLED, puce A14 Bionic et 5G. Un iPhone récent à petit prix.',
    specs: [
      ['Écran', '6,1 pouces Super Retina XDR (OLED)'],
      ['Puce', 'A14 Bionic'],
      ['Appareil photo', 'Double 12 Mpx (grand-angle et ultra grand-angle)'],
      ['Réseau', '5G, nano-SIM et eSIM'],
    ],
    images: [
      { id: '1605236453806-6ff36851218e', alt: 'iPhone vu de face sur un fond gris, écran allumé' },
      { id: '1567581935884-3349723552ca', alt: 'iPhone posé sur un fond rouge, écran de verrouillage allumé' },
    ],
    variants: [
      { color: 'Noir', hex: NOIR, storage: 64, condition: 'USED', price: 175000, cost: 145000, stock: 3 },
      { color: 'Noir', hex: NOIR, storage: 128, condition: 'USED', price: 195000, cost: 162000, stock: 2 },
      { color: 'Blanc', hex: '#f5f5f0', storage: 128, condition: 'USED', price: 195000, compareAt: 210000, cost: 162000, stock: 1 },
    ],
  },
  {
    kind: 'ACCESSORY',
    name: 'Coque silicone iPhone 13',
    category: 'coques-et-etuis',
    compatibleWith: 'iPhone 13',
    description: 'Silicone souple, intérieur microfibre, bords surélevés pour protéger l’écran et l’appareil photo.',
    images: [{ id: '1535157412991-2ef801c1748b', alt: 'Coques en silicone de couleurs pastel' }],
    variants: [
      { color: 'Noir', hex: NOIR, price: 4000, cost: 1800, stock: 9 },
      { color: 'Bleu ciel', hex: '#a7d8de', price: 4000, cost: 1800, stock: 4 },
      { color: 'Rose', hex: '#f2b8c6', price: 4000, cost: 1800, stock: 0 },
    ],
  },
  {
    kind: 'ACCESSORY',
    name: 'Câble USB-C tressé',
    category: 'cables-usb',
    optionName: 'Longueur',
    compatibleWith: 'Smartphones et tablettes à port USB-C',
    description: 'Gaine en nylon tressé, embouts renforcés. Charge rapide et transfert de données.',
    images: [{ id: '1595756630452-736bc8ef3693', alt: 'Câble tressé noir enroulé' }],
    variants: [
      { option: '1 m', price: 3000, cost: 1400, stock: 25 },
      { option: '2 m', price: 4000, cost: 1900, stock: 12 },
    ],
  },
  {
    kind: 'ACCESSORY',
    name: 'Écouteurs sans fil Bluetooth',
    category: 'ecouteurs-sans-fil',
    featured: true,
    compatibleWith: 'Tous les smartphones Bluetooth',
    description: 'Boîtier de charge compact, connexion Bluetooth 5.3, micro intégré pour les appels.',
    images: [
      { id: '1590658268037-6bf12165a8df', alt: 'Écouteurs sans fil blancs et noirs' },
      { id: '1572569511254-d8f925fe2cbb', alt: 'Écouteurs sans fil blancs dans leur boîtier', color: 'Blanc' },
      { id: '1606220588913-b3aacb4d2f46', alt: 'Écouteurs sans fil noirs devant leur boîtier', color: 'Noir' },
    ],
    variants: [
      { color: 'Blanc', hex: '#f5f5f2', price: 15000, cost: 9000, stock: 6 },
      { color: 'Noir', hex: NOIR, price: 15000, compareAt: 18000, cost: 9000, stock: 4 },
    ],
  },
  {
    kind: 'ACCESSORY',
    name: 'Chargeur secteur USB-C 20 W',
    category: 'chargeurs',
    compatibleWith: 'iPhone, Samsung et smartphones USB-C',
    description: 'Charge rapide Power Delivery jusqu’à 20 W. Format compact.',
    images: [{ id: '1583863788434-e58a36330cf0', alt: 'Chargeur secteur blanc et son câble' }],
    variants: [{ price: 6500, cost: 3800, stock: 10 }],
  },
  {
    kind: 'ACCESSORY',
    name: 'Casque Bluetooth à réduction de bruit',
    category: 'autres-accessoires',
    featured: true,
    compatibleWith: 'Tous les smartphones Bluetooth',
    description: 'Casque arceau confortable, réduction active du bruit et grande autonomie. Micro intégré pour les appels.',
    images: [{ id: '1609081219090-a6d81d3085bf', alt: 'Casque sans fil argenté et écouteurs posés sur un fond orange' }],
    variants: [
      { color: 'Argent', hex: '#d9dadc', price: 35000, compareAt: 40000, cost: 24000, stock: 3 },
      { color: 'Noir', hex: NOIR, price: 35000, cost: 24000, stock: 2 },
    ],
  },
];

const slugify = (v: string) =>
  v
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const CONDITION = { NEW: 'Neuf', USED: 'Occasion' } as const;
function label(v: DemoVariant) {
  const memory = v.ram && v.storage ? `${v.ram} Go / ${v.storage} Go` : v.storage ? `${v.storage} Go` : null;
  return [v.color, memory, v.condition ? CONDITION[v.condition] : null, v.option].filter(Boolean).join(' · ');
}

async function clear() {
  const groups = await prisma.productGroup.findMany({
    where: { isDemo: true },
    include: { variants: { select: { id: true, _count: { select: { orderItems: true, purchaseItems: true, countLines: true } } } } },
  });
  let removed = 0;
  let archived = 0;
  for (const g of groups) {
    const used = g.variants.some((v) => v._count.orderItems + v._count.purchaseItems + v._count.countLines > 0);
    if (used) {
      // Déjà vendu ou approvisionné : archivé pour préserver l'historique.
      await prisma.productGroup.update({ where: { id: g.id }, data: { status: 'ARCHIVED', published: false } });
      archived++;
      continue;
    }
    const ids = g.variants.map((v) => v.id);
    await prisma.inventoryMovement.deleteMany({ where: { productId: { in: ids } } });
    await prisma.product.deleteMany({ where: { id: { in: ids } } });
    await prisma.productGroup.delete({ where: { id: g.id } });
    removed++;
  }
  console.log(`Démo retirée : ${removed} produit(s) supprimé(s), ${archived} archivé(s) (déjà vendus).`);
}

async function seed() {
  const manager = await prisma.user.findFirst({ where: { role: 'MANAGER' } });
  for (const g of GROUPS) {
    if (await prisma.productGroup.findFirst({ where: { name: g.name, isDemo: true } })) continue;
    const category = await prisma.category.findUniqueOrThrow({ where: { slug: g.category } });
    const brand = g.brand ? await prisma.brand.findUniqueOrThrow({ where: { slug: g.brand } }) : null;
    let slug = slugify(g.name);
    for (let i = 2; await prisma.productGroup.findUnique({ where: { slug } }); i++) slug = `${slugify(g.name)}-${i}`;
    const group = await prisma.productGroup.create({
      data: {
        kind: g.kind,
        name: g.name,
        slug,
        brandId: brand?.id ?? null,
        categoryId: category.id,
        description: g.description,
        specs: (g.specs ?? []).map(([l, v]) => ({ label: l, value: v })),
        optionName: g.optionName ?? null,
        compatibleWith: g.compatibleWith ?? null,
        featured: g.featured ?? false,
        isDemo: true,
        images: { create: g.images.map((img, position) => ({ url: unsplash(img.id), alt: img.alt, color: img.color ?? null, position })) },
      },
    });
    for (const [position, v] of g.variants.entries()) {
      const sku = await randomReference(g.kind === 'PHONE' ? 'TEL' : 'ACC', async (r) => Boolean(await prisma.product.findUnique({ where: { sku: r } })));
      const l = label(v);
      await prisma.product.create({
        data: {
          groupId: group.id,
          kind: g.kind,
          categoryId: category.id,
          sku,
          slug: `${slug}-${sku.toLowerCase()}`,
          name: l ? `${g.name} · ${l}` : g.name,
          color: v.color ?? null,
          colorHex: v.hex ?? null,
          ramGb: v.ram ?? null,
          storageGb: v.storage ?? null,
          condition: v.condition ?? null,
          optionValue: v.option ?? null,
          salePrice: v.price,
          compareAtPrice: v.compareAt ?? null,
          stockQuantity: v.stock,
          averageCost: v.stock > 0 ? v.cost : 0,
          position,
          isDemo: true,
          movements:
            v.stock > 0
              ? { create: { type: 'INITIAL', quantity: v.stock, unitCost: v.cost, stockAfter: v.stock, averageCostAfter: v.cost, reason: 'Stock de démonstration', userId: manager?.id ?? null } }
              : undefined,
        },
      });
    }
  }
  console.log(`Démo en place : ${GROUPS.length} produits (prix et stocks fictifs, marqués « Démo »).`);
}

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Données de démonstration interdites en production.');
  if (process.argv.includes('--clear')) await clear();
  else await seed();
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
