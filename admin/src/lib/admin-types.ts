// Types des réponses de l'API utilisées par l'administration.

export interface BrandRow {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  position: number;
  _count: { groups: number };
}

export type ProductKind = 'PHONE' | 'ACCESSORY';
export type Condition = 'NEW' | 'USED';

export interface ImageRow {
  id: string;
  url: string | null;
  alt: string;
  color: string | null;
  position: number;
}

/** Ligne de la liste des fiches produits. */
export interface GroupRow {
  id: string;
  kind: ProductKind;
  name: string;
  slug: string;
  brand: { id: string; name: string } | null;
  category: { id: string; name: string };
  published: boolean;
  featured: boolean;
  status: 'ACTIVE' | 'ARCHIVED';
  isDemo: boolean;
  image: ImageRow | null;
  variantCount: number;
  stock: number;
  outOfStock: number;
  priceFrom: number | null;
  priceTo: number | null;
  onSale: boolean;
  updatedAt: string;
}

/** Configuration (variante) d'une fiche, telle que renvoyée par l'API. */
export interface GroupVariant {
  id: string;
  sku: string;
  label: string;
  color: string | null;
  colorHex: string | null;
  ramGb: number | null;
  storageGb: number | null;
  condition: Condition | null;
  optionValue: string | null;
  salePrice: number;
  compareAtPrice: number | null;
  averageCost: number | null;
  stockQuantity: number;
  reservedQuantity: number;
  available: number;
  availability: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
  lowStockThreshold: number;
  active: boolean;
  supplier: { id: string; name: string } | null;
}

export interface GroupDetail {
  id: string;
  kind: ProductKind;
  name: string;
  slug: string;
  brand: { id: string; name: string; slug: string } | null;
  category: { id: string; name: string; slug: string; kind: ProductKind };
  description: string;
  specs: { label: string; value: string }[];
  optionName: string | null;
  compatibleWith: string | null;
  published: boolean;
  featured: boolean;
  status: 'ACTIVE' | 'ARCHIVED';
  isDemo: boolean;
  images: ImageRow[];
  variants: GroupVariant[];
  createdAt: string;
  updatedAt: string;
}

export interface PaymentRow {
  id: string;
  kind: 'PAYMENT' | 'REFUND';
  method: string;
  status: 'PENDING' | 'CONFIRMED' | 'FAILED' | 'CANCELLED';
  amount: number;
  provider: string;
  externalReference: string | null;
  note: string | null;
  confirmedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  recordedBy: { name: string } | null;
}

export interface AdminProduct {
  id: string;
  kind: ProductKind;
  sku: string;
  slug: string;
  /** Nom complet de l'article : fiche et configuration (« Galaxy A56 · Noir · 8 Go / 256 Go · Neuf »). */
  name: string;
  variantLabel: string;
  group: { id: string; name: string; slug: string; kind: ProductKind };
  image: ImageRow | null;
  category: { id: string; name: string; slug: string };
  supplier: { id: string; name: string } | null;
  salePrice: number;
  compareAtPrice: number | null;
  averageCost: number | null;
  unitMargin: number | null;
  stockQuantity: number;
  reservedQuantity: number;
  available: number;
  availability: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
  lowStockThreshold: number;
  stockValue: number | null;
  status: 'ACTIVE' | 'ARCHIVED';
  published: boolean;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryRow {
  id: string;
  kind: ProductKind;
  name: string;
  slug: string;
  description: string | null;
  position: number;
  active: boolean;
  _count: { products: number; groups?: number };
}

export interface SupplierRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  active: boolean;
  balanceDue: number;
  _count: { purchases: number; products: number };
}
