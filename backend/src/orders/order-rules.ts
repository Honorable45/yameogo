import { FulfillmentMethod, OrderStatus, PaymentPreference } from '@prisma/client';

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: 'En attente de confirmation',
  CONFIRMED: 'Confirmée',
  PREPARING: 'En préparation',
  READY_FOR_PICKUP: 'Prête à être retirée',
  OUT_FOR_DELIVERY: 'En livraison',
  COMPLETED: 'Terminée',
  CANCELLED: 'Annulée',
};

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'COMPLETED', 'CANCELLED'],
  PREPARING: ['READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'CANCELLED'],
  READY_FOR_PICKUP: ['COMPLETED', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['COMPLETED', 'PREPARING', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export function allowedOrderTransitions(status: OrderStatus, fulfillment: FulfillmentMethod): OrderStatus[] {
  return TRANSITIONS[status].filter((s) => {
    if (s === 'READY_FOR_PICKUP') return fulfillment === 'PICKUP';
    if (s === 'OUT_FOR_DELIVERY') return fulfillment === 'DELIVERY';
    return true;
  });
}

export function canTransitionOrder(from: OrderStatus, to: OrderStatus, fulfillment: FulfillmentMethod) {
  return allowedOrderTransitions(from, fulfillment).includes(to);
}

export interface CheckoutSettings {
  deliveryEnabled: boolean;
  payInStoreEnabled: boolean;
  cashOnDeliveryEnabled: boolean;
  mobileMoneyAvailable: boolean;
}

/** Vérifie la cohérence mode de réception / mode de paiement avec la configuration de la boutique. */
export function checkoutError(fulfillment: FulfillmentMethod, payment: PaymentPreference, s: CheckoutSettings): string | null {
  if (fulfillment === 'DELIVERY' && !s.deliveryEnabled) return "La livraison n'est pas proposée actuellement.";
  switch (payment) {
    case 'PAY_IN_STORE':
      if (!s.payInStoreEnabled) return "Le paiement en boutique n'est pas proposé.";
      if (fulfillment !== 'PICKUP') return 'Le paiement en boutique nécessite un retrait en boutique.';
      return null;
    case 'CASH_ON_DELIVERY':
      if (fulfillment !== 'DELIVERY' || !s.cashOnDeliveryEnabled) return "Le paiement à la livraison n'est pas proposé.";
      return null;
    case 'TMONEY':
    case 'FLOOZ':
      return s.mobileMoneyAvailable ? null : "Le paiement mobile en ligne n'est pas disponible.";
  }
}
