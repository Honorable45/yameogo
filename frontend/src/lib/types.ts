// Types des réponses de l'API utilisées par le site public.

export interface ImageRef {
  id: string;
  url: string | null;
  alt: string;
  color: string | null;
  width: number | null;
  height: number | null;
}

export type Availability = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
export type ProductKind = 'PHONE' | 'ACCESSORY';
export type Condition = 'NEW' | 'USED';

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

/** Carte du catalogue (une fiche produit et le résumé de ses configurations). */
export interface CatalogCard {
  id: string;
  slug: string;
  kind: ProductKind;
  name: string;
  brand: { id: string; name: string; slug: string } | null;
  category: { id: string; name: string; slug: string };
  image: ImageRef | null;
  priceFrom: number | null;
  compareAtPrice: number | null;
  priceTo: number | null;
  onSale: boolean;
  inStock: boolean;
  colors: { name: string; hex: string | null }[];
  ramGbs: number[];
  storageGbs: number[];
  conditions: Condition[];
  variantCount: number;
  featured: boolean;
  isDemo: boolean;
}

/** Configuration vendable (variante). */
export interface Variant {
  id: string;
  sku: string;
  label: string;
  color: string | null;
  colorHex: string | null;
  ramGb: number | null;
  storageGb: number | null;
  condition: Condition | null;
  optionValue: string | null;
  price: number;
  compareAtPrice: number | null;
  availability: Availability;
  availableQuantity: number;
}

export interface CatalogDetail extends CatalogCard {
  description: string;
  specs: { label: string; value: string }[];
  optionName: string | null;
  compatibleWith: string | null;
  images: ImageRef[];
  variants: Variant[];
}

export interface CatalogFacets {
  brands: { slug: string; name: string }[];
  categories: { slug: string; name: string }[];
  rams: number[];
  storages: number[];
  conditions: Condition[];
  price: { min: number; max: number } | null;
  hasPromotions: boolean;
}

/** Ligne de panier vérifiée par le serveur (prix et disponibilité actuels). */
export type CheckedLine =
  | { variantId: string; available: false; issue: string; name?: undefined }
  | {
      variantId: string;
      available: boolean;
      issue: string | null;
      maxQuantity: number;
      kind: ProductKind;
      name: string;
      slug: string;
      brand: string | null;
      label: string;
      sku: string;
      color: string | null;
      ramGb: number | null;
      storageGb: number | null;
      condition: Condition | null;
      optionName: string | null;
      optionValue: string | null;
      unitPrice: number;
      compareAtPrice: number | null;
      image: ImageRef | null;
    };

export interface OpeningHour {
  dayOfWeek: number;
  closed: boolean;
  opensAt: string | null;
  closesAt: string | null;
}

export interface PublicSettings {
  shopName: string;
  siteUrl?: string;
  tagline: string | null;
  logoUrl: string | null;
  heroImageUrl: string | null;
  heroImageAlt: string | null;
  phonesImageUrl: string | null;
  phonesImageAlt: string | null;
  shopImageUrl: string | null;
  shopImageAlt: string | null;
  social: { tiktok: string | null; instagram: string | null; facebook: string | null };
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  addressLine: string | null;
  city: string | null;
  country: string | null;
  mapUrl: string | null;
  location: { latitude: number; longitude: number } | null;
  legal: {
    legalName: string | null;
    legalForm: string | null;
    registrationNumber: string | null;
    taxId: string | null;
    publicationDirector: string | null;
    hostingProvider: string | null;
  };
  deliveryInfo: string | null;
  openingHours: OpeningHour[];
  checkout: {
    deliveryEnabled: boolean;
    deliveryFee: number;
    deliveryArea: string | null;
    payInStore: boolean;
    cashOnDelivery: boolean;
    mobileMoney: boolean;
  };
}

export interface PublicReview {
  id: string;
  rating: number;
  ratingWelcome: number | null;
  ratingValue: number | null;
  comment: string | null;
  displayName: string | null;
  serviceType: string;
  serviceLabel: string;
  verified: boolean;
  shopReply: string | null;
  createdAt: string;
}

export interface ReviewsPage extends Paginated<PublicReview> {
  summary: {
    count: number;
    verifiedCount: number;
    average: number | null;
    averageWelcome: number | null;
    averageValue: number | null;
  };
}
