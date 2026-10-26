import { Prisma } from '@prisma/client';
import { StorageService } from '../storage/storage.service';

type ImageLike = { id: string; url: string | null; storageKey: string | null; alt: string; position: number; width: number | null; height: number | null };

export function presentImage(storage: StorageService, img: ImageLike) {
  return {
    id: img.id,
    url: img.url ?? storage.publicUrl(img.storageKey),
    alt: img.alt,
    width: img.width,
    height: img.height,
    position: img.position,
  };
}

export const productPublicInclude = {
  category: { select: { id: true, name: true, slug: true } },
  images: { orderBy: { position: 'asc' } },
  compatibility: {
    include: { brand: { select: { id: true, name: true, slug: true } }, phoneModel: { select: { id: true, name: true, slug: true } } },
  },
} satisfies Prisma.ProductInclude;

type ProductWithPublic = Prisma.ProductGetPayload<{ include: typeof productPublicInclude }>;

export function availabilityOf(p: { stockQuantity: number; reservedQuantity: number; lowStockThreshold: number }) {
  const available = Math.max(0, p.stockQuantity - p.reservedQuantity);
  if (available === 0) return { available, availability: 'OUT_OF_STOCK' as const };
  if (available <= p.lowStockThreshold) return { available, availability: 'LOW_STOCK' as const };
  return { available, availability: 'IN_STOCK' as const };
}

export function presentCompatibility(rows: ProductWithPublic['compatibility']) {
  return rows.map((c) => ({
    brandId: c.brand.id,
    brand: c.brand.name,
    brandSlug: c.brand.slug,
    modelId: c.phoneModel?.id ?? null,
    model: c.phoneModel?.name ?? null,
  }));
}

/** Vue publique : jamais de coût d'achat, ni de quantité exacte au-delà de 10. */
export function presentPublicProduct(storage: StorageService, p: ProductWithPublic) {
  const { available, availability } = availabilityOf(p);
  return {
    id: p.id,
    slug: p.slug,
    sku: p.sku,
    name: p.name,
    description: p.description,
    price: p.salePrice,
    category: p.category,
    images: p.images.map((i) => presentImage(storage, i)),
    compatibility: presentCompatibility(p.compatibility),
    availability,
    availableQuantity: Math.min(available, 10),
    isDemo: p.isDemo,
    createdAt: p.createdAt,
  };
}

/** Vue interne : les coûts ne sont inclus que pour les rôles autorisés. */
export function presentAdminProduct(storage: StorageService, p: ProductWithPublic & { supplier?: { id: string; name: string } | null }, withCosts: boolean) {
  const { available, availability } = availabilityOf(p);
  return {
    id: p.id,
    kind: p.kind,
    sku: p.sku,
    slug: p.slug,
    name: p.name,
    description: p.description,
    category: p.category,
    supplier: p.supplier ?? null,
    salePrice: p.salePrice,
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
    images: p.images.map((i) => presentImage(storage, i)),
    compatibility: presentCompatibility(p.compatibility),
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}
