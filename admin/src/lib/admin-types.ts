// Types des réponses de l'API utilisées par l'administration.

export interface BrandWithModels {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  position: number;
  models: { id: string; name: string; slug: string; active: boolean; position: number; brandId: string }[];
}

export interface RepairTypeRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  active: boolean;
  position: number;
}

export interface StaffMember {
  id: string;
  name: string;
  role: string;
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

export interface RepairPart {
  id: string;
  source: 'STOCK' | 'EXTERNAL';
  productId: string | null;
  label: string;
  sku: string | null;
  quantity: number;
  unitCost: number | null;
  totalCost: number | null;
  status: 'USED' | 'RETURNED';
  returnedAt: string | null;
  returnNote: string | null;
  createdAt: string;
  addedBy: { name: string };
}

export interface RepairQuote {
  id: string;
  version: number;
  amount: number;
  details: string;
  durationMinutes: number | null;
  status: string;
  decidedAt: string | null;
  decidedVia: string | null;
  createdAt: string;
  createdBy: { name: string };
}

export interface RepairDetail {
  id: string;
  number: string;
  trackingCode: string;
  trackingUrl: string;
  status: string;
  statusLabel: string;
  allowedTransitions: string[];
  customer: { id: string; name: string; phone: string };
  brandName: string;
  phoneModelId: string | null;
  modelName: string;
  hasImei: boolean;
  imeiLast4: string | null;
  repairTypeId: string | null;
  repairType: { id: string; name: string } | null;
  reportedIssue: string;
  diagnosis: string | null;
  workDone: string | null;
  technicianId: string | null;
  technician: { id: string; name: string } | null;
  receivedAt: string;
  dueAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  deviceReturnedAt: string | null;
  billedAmount: number;
  consumablesCost: number | null;
  otherDirectCosts: number | null;
  otherCostsNote: string | null;
  amountPaid: number;
  paymentStatus: string;
  balanceDue: number;
  internalNotes: string | null;
  createdBy: { name: string };
  request: { id: string; reference: string } | null;
  parts: RepairPart[];
  quotes: RepairQuote[];
  history: { id: string; type: string; message: string; createdAt: string; user: { name: string } | null }[];
  payments: PaymentRow[];
  review: { id: string; rating: number; status: string; createdAt: string } | null;
  financials: null | {
    billedAmount: number;
    partsCost: number;
    consumablesCost: number;
    otherDirectCosts: number;
    directCosts: number;
    grossMargin: number;
    amountPaid: number;
    balanceDue: number;
  };
}

export interface AdminProduct {
  id: string;
  kind: 'ACCESSORY' | 'PART';
  sku: string;
  slug: string;
  name: string;
  description: string;
  category: { id: string; name: string; slug: string };
  supplier: { id: string; name: string } | null;
  salePrice: number;
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
  images: { id: string; url: string | null; alt: string; position: number }[];
  compatibility: { brandId: string; brand: string; modelId: string | null; model: string | null }[];
  createdAt: string;
  updatedAt: string;
}

export interface CategoryRow {
  id: string;
  kind: 'ACCESSORY' | 'PART';
  name: string;
  slug: string;
  description: string | null;
  position: number;
  active: boolean;
  _count: { products: number };
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
