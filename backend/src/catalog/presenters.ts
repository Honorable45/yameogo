import { PhoneCondition, Prisma } from '@prisma/client';
import { StorageService } from '../storage/storage.service';

type ImageLike = { id: string; url: string | null; storageKey: string | null; alt: string; position: number; width: number | null; height: number | null; color?: string | null };

export function presentImage(storage: StorageService, img: ImageLike) {
  return {
    id: img.id,
    url: img.url ?? storage.publicUrl(img.storageKey),
    alt: img.alt,
    color: img.color ?? null,
    width: img.width,
    height: img.height,
    position: img.position,
  };
}

export const CONDITION_LABELS: Record<PhoneCondition, string> = { NEW: 'Neuf', USED: 'Occasion' };

type VariantAttributes = { color: string | null; ramGb: number | null; storageGb: number | null; condition: PhoneCondition | null; optionValue: string | null };

/** « Noir · 8 Go / 256 Go · Neuf » — seules les caractéristiques renseignées apparaissent. */
export function variantLabel(v: VariantAttributes) {
  const memory = v.ramGb && v.storageGb ? `${v.ramGb} Go / ${v.storageGb} Go` : v.storageGb ? `${v.storageGb} Go` : v.ramGb ? `${v.ramGb} Go RAM` : null;
  return [v.color, memory, v.condition ? CONDITION_LABELS[v.condition] : null, v.optionValue].filter(Boolean).join(' · ');
}

export function availabilityOf(p: { stockQuantity: number; reservedQuantity: number; lowStockThreshold: number }) {
  const available = Math.max(0, p.stockQuantity - p.reservedQuantity);
  if (available === 0) return { available, availability: 'OUT_OF_STOCK' as const };
  if (available <= p.lowStockThreshold) return { available, availability: 'LOW_STOCK' as const };
  return { available, availability: 'IN_STOCK' as const };
}

/** Une variante est proposée au public si elle est active et publiée. */
export const publicVariantWhere = { status: 'ACTIVE', published: true } satisfies Prisma.ProductWhereInput;

export const groupPublicInclude = {
  brand: { select: { id: true, name: true, slug: true } },
  category: { select: { id: true, name: true, slug: true } },
  images: { orderBy: { position: 'asc' } },
  variants: { where: publicVariantWhere, orderBy: [{ position: 'asc' }, { salePrice: 'asc' }] },
} satisfies Prisma.ProductGroupInclude;

type GroupWithPublic = Prisma.ProductGroupGetPayload<{ include: typeof groupPublicInclude }>;
type Variant = GroupWithPublic['variants'][number];

/** Vue publique d'une variante : jamais de coût d'achat, ni de quantité exacte au-delà de 10. */
function presentPublicVariant(v: Variant) {
  const { available, availability } = availabilityOf(v);
  return {
    id: v.id,
    sku: v.sku,
    label: variantLabel(v),
    color: v.color,
    colorHex: v.colorHex,
    ramGb: v.ramGb,
    storageGb: v.storageGb,
    condition: v.condition,
    optionValue: v.optionValue,
    price: v.salePrice,
    compareAtPrice: v.compareAtPrice,
    availability,
    availableQuantity: Math.min(available, 10),
  };
}

const uniq = <T>(values: (T | null)[]) => [...new Set(values.filter((v): v is T => v !== null))];

/** Carte du catalogue : prix « à partir de », promotions, couleurs et capacités disponibles. */
export function presentGroupCard(storage: StorageService, g: GroupWithPublic) {
  const variants = g.variants.map(presentPublicVariant);
  const inStock = variants.filter((v) => v.availability !== 'OUT_OF_STOCK');
  const priced = inStock.length ? inStock : variants;
  const cheapest = priced.reduce<(typeof variants)[number] | null>((min, v) => (!min || v.price < min.price ? v : min), null);
  const colors = new Map<string, string | null>();
  for (const v of g.variants) if (v.color && !colors.has(v.color)) colors.set(v.color, v.colorHex);
  return {
    id: g.id,
    slug: g.slug,
    kind: g.kind,
    name: g.name,
    brand: g.brand,
    category: g.category,
    image: g.images[0] ? presentImage(storage, g.images[0]) : null,
    priceFrom: cheapest?.price ?? null,
    compareAtPrice: cheapest?.compareAtPrice ?? null,
    priceTo: variants.length ? Math.max(...variants.map((v) => v.price)) : null,
    onSale: variants.some((v) => v.compareAtPrice !== null && v.availability !== 'OUT_OF_STOCK'),
    inStock: inStock.length > 0,
    colors: [...colors].map(([name, hex]) => ({ name, hex })),
    ramGbs: uniq(g.variants.map((v) => v.ramGb)).sort((a, b) => a - b),
    storageGbs: uniq(g.variants.map((v) => v.storageGb)).sort((a, b) => a - b),
    conditions: uniq(g.variants.map((v) => v.condition)),
    variantCount: variants.length,
    featured: g.featured,
    isDemo: g.isDemo,
    createdAt: g.createdAt,
  };
}

export function presentGroupDetail(storage: StorageService, g: GroupWithPublic) {
  return {
    ...presentGroupCard(storage, g),
    description: g.description,
    specs: Array.isArray(g.specs) ? (g.specs as { label: string; value: string }[]) : [],
    optionName: g.optionName,
    compatibleWith: g.compatibleWith,
    images: g.images.map((i) => presentImage(storage, i)),
    variants: g.variants.map(presentPublicVariant),
  };
}

/** Vue interne d'un article (variante) : les coûts ne sont inclus que pour les rôles autorisés. */
export const productAdminInclude = {
  category: { select: { id: true, name: true, slug: true } },
  supplier: { select: { id: true, name: true } },
  group: { select: { id: true, name: true, slug: true, kind: true, images: { orderBy: { position: 'asc' as const }, take: 1 } } },
} satisfies Prisma.ProductInclude;

type ProductWithAdmin = Prisma.ProductGetPayload<{ include: typeof productAdminInclude }>;

export function presentAdminProduct(storage: StorageService, p: ProductWithAdmin, withCosts: boolean) {
  const { available, availability } = availabilityOf(p);
  return {
    id: p.id,
    kind: p.kind,
    sku: p.sku,
    slug: p.slug,
    name: p.name,
    variantLabel: variantLabel(p),
    group: { id: p.group.id, name: p.group.name, slug: p.group.slug, kind: p.group.kind },
    image: p.group.images[0] ? presentImage(storage, p.group.images[0]) : null,
    category: p.category,
    supplier: p.supplier ?? null,
    salePrice: p.salePrice,
    compareAtPrice: p.compareAtPrice,
    averageCost: withCosts ? p.averageCost : null,
    unitMargin: withCosts ? p.salePrice - p.averageCost : null,
    stockQuantity: p.stockQuantity,
    reservedQuantity: p.reservedQuantity,
    available,
    availability,
    lowStockThreshold: p.lowStockThreshold,
    stockValue: withCosts ? p.stockQuantity * p.averageCost : null,
    status: p.status,
    published: p.published,
    isDemo: p.isDemo,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}
