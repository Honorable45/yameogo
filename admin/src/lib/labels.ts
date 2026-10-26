import type { Tone } from '@/components/ui/status';

type Labels = Record<string, { label: string; tone: Tone }>;

export const REPAIR_STATUS: Labels = {
  RECEIVED: { label: 'Téléphone reçu', tone: 'neutral' },
  DIAGNOSING: { label: 'Diagnostic en cours', tone: 'info' },
  QUOTE_PENDING: { label: 'Devis à confirmer', tone: 'warn' },
  QUOTE_ACCEPTED: { label: 'Devis accepté', tone: 'info' },
  WAITING_PARTS: { label: 'En attente de pièces', tone: 'warn' },
  IN_PROGRESS: { label: 'Réparation en cours', tone: 'info' },
  COMPLETED: { label: 'Réparation terminée', tone: 'ok' },
  PICKED_UP: { label: 'Téléphone récupéré', tone: 'done' },
  CANCELLED: { label: 'Annulée', tone: 'bad' },
};

export const ORDER_STATUS: Labels = {
  PENDING: { label: 'À confirmer', tone: 'warn' },
  CONFIRMED: { label: 'Confirmée', tone: 'info' },
  PREPARING: { label: 'En préparation', tone: 'info' },
  READY_FOR_PICKUP: { label: 'Prête à être retirée', tone: 'ok' },
  OUT_FOR_DELIVERY: { label: 'En livraison', tone: 'info' },
  COMPLETED: { label: 'Terminée', tone: 'done' },
  CANCELLED: { label: 'Annulée', tone: 'bad' },
};

export const SETTLEMENT: Labels = {
  UNPAID: { label: 'Non payé', tone: 'bad' },
  PARTIAL: { label: 'Partiellement payé', tone: 'warn' },
  PAID: { label: 'Payé', tone: 'ok' },
};

export const PHONE_STATUS: Labels = {
  PENDING_CHECK: { label: 'À vérifier', tone: 'warn' },
  AVAILABLE: { label: 'Disponible', tone: 'ok' },
  RESERVED: { label: 'Réservé', tone: 'info' },
  SOLD: { label: 'Vendu', tone: 'done' },
  RETURNED: { label: 'Retourné', tone: 'bad' },
  ARCHIVED: { label: 'Archivé', tone: 'neutral' },
};

export const PURCHASE_STATUS: Labels = {
  DRAFT: { label: 'Brouillon', tone: 'warn' },
  VALIDATED: { label: 'Validé', tone: 'ok' },
  CANCELLED: { label: 'Annulé', tone: 'bad' },
};

export const REVIEW_STATUS: Labels = {
  PENDING: { label: 'En attente', tone: 'warn' },
  PUBLISHED: { label: 'Publié', tone: 'ok' },
  HIDDEN: { label: 'Masqué', tone: 'neutral' },
  FLAGGED: { label: 'Signalé', tone: 'bad' },
};

export const REQUEST_STATUS: Labels = {
  NEW: { label: 'Nouvelle', tone: 'warn' },
  CONTACTED: { label: 'Client contacté', tone: 'info' },
  CONVERTED: { label: 'Prise en charge', tone: 'ok' },
  CLOSED: { label: 'Classée', tone: 'neutral' },
};

export const PAYMENT_METHODS: Record<string, string> = {
  CASH: 'Espèces',
  TMONEY: 'TMoney',
  FLOOZ: 'Flooz',
  CARD: 'Carte bancaire',
  BANK_TRANSFER: 'Virement',
  OTHER: 'Autre',
};

export const PAYMENT_PREFERENCE: Record<string, string> = {
  PAY_IN_STORE: 'En boutique',
  CASH_ON_DELIVERY: 'À la livraison',
  TMONEY: 'TMoney en ligne',
  FLOOZ: 'Flooz en ligne',
};

export const MOVEMENT_TYPES: Record<string, string> = {
  INITIAL: 'Stock initial',
  PURCHASE: 'Approvisionnement',
  PURCHASE_CANCEL: 'Annulation d’approvisionnement',
  SALE: 'Vente',
  SALE_RETURN: 'Retour client',
  REPAIR_USE: 'Utilisée en réparation',
  REPAIR_RETURN: 'Retirée d’une réparation',
  ADJUSTMENT: 'Correction',
  COUNT: 'Inventaire',
};

export const EXPENSE_CATEGORIES: Record<string, string> = {
  RENT: 'Loyer',
  ELECTRICITY: 'Électricité',
  INTERNET: 'Internet et téléphone',
  TRANSPORT: 'Transport',
  SALARIES: 'Salaires',
  EQUIPMENT_MAINTENANCE: 'Entretien du matériel',
  SUPPLIES: 'Fournitures',
  OTHER: 'Autres dépenses',
};

export const ROLES: Record<string, string> = { MANAGER: 'Responsable', TECHNICIAN: 'Réparateur', SELLER: 'Vendeur' };

export const GRADES: Record<string, string> = { LIKE_NEW: 'Comme neuf', VERY_GOOD: 'Très bon état', GOOD: 'Bon état', FAIR: 'État correct' };

export const CONDITIONS: Record<string, string> = { NEW: 'Neuf', IMPORTED: 'Venu (importé)', USED: 'Occasion' };
