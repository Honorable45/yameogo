// Types des réponses de l'API utilisées par le site public.

export interface ImageRef {
  id: string;
  url: string | null;
  alt: string;
  width: number | null;
  height: number | null;
}

export type Availability = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';

export interface Compatibility {
  brandId: string;
  brand: string;
  brandSlug: string;
  modelId: string | null;
  model: string | null;
}

export interface PublicProduct {
  id: string;
  slug: string;
  sku: string;
  name: string;
  description: string;
  price: number;
  category: { id: string; name: string; slug: string };
  images: ImageRef[];
  compatibility: Compatibility[];
  availability: Availability;
  availableQuantity: number;
  isDemo: boolean;
  createdAt: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface ShopCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  productCount: number;
  imageUrl: string | null;
}

export interface ShopBrand {
  id: string;
  name: string;
  slug: string;
  models: { id: string; name: string; slug: string }[];
}

export type PhoneCondition = 'NEW' | 'IMPORTED' | 'USED';

export interface PublicPhone {
  id: string;
  slug: string;
  reference: string;
  brand: { id: string; name: string; slug: string };
  modelName: string;
  condition: PhoneCondition;
  conditionLabel: string;
  title: string;
  storageGb: number | null;
  ramGb: number | null;
  color: string | null;
  grade: 'LIKE_NEW' | 'VERY_GOOD' | 'GOOD' | 'FAIR';
  gradeLabel: string;
  batteryHealth: number | null;
  knownDefects: string | null;
  includedAccessories: string | null;
  description: string | null;
  price: number;
  warrantyMonths: number;
  status: 'AVAILABLE' | 'RESERVED';
  images: ImageRef[];
  isDemo: boolean;
}

export interface OpeningHour {
  dayOfWeek: number;
  closed: boolean;
  opensAt: string | null;
  closesAt: string | null;
}

export interface PublicSettings {
  shopName: string;
  tagline: string | null;
  logoUrl: string | null;
  heroImageUrl: string | null;
  heroImageAlt: string | null;
  repairImageUrl: string | null;
  repairImageAlt: string | null;
  phonesImageUrl: string | null;
  phonesImageAlt: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  addressLine: string | null;
  city: string | null;
  country: string | null;
  mapUrl: string | null;
  legal: {
    legalName: string | null;
    legalForm: string | null;
    registrationNumber: string | null;
    taxId: string | null;
    publicationDirector: string | null;
    hostingProvider: string | null;
  };
  repairWarrantyText: string | null;
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

export interface RepairCatalog {
  brands: ShopBrand[];
  types: { id: string; name: string; slug: string; description: string | null }[];
}

export interface RepairEstimate {
  partsPrice: number;
  laborPrice: number;
  totalPrice: number;
  durationMinutes: number | null;
  conditions: string | null;
}

export interface PublicReview {
  id: string;
  rating: number;
  ratingRepair: number | null;
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
    averageRepair: number | null;
    averageWelcome: number | null;
    averageValue: number | null;
  };
}
