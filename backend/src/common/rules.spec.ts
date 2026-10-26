import { can } from '../auth/permissions';
import { canTransitionOrder, checkoutError } from '../orders/order-rules';
import { canTransitionRepair, DONE_STATUSES } from '../repairs/repair-rules';

describe('Permissions par rôle', () => {
  it('réserve les coûts, marges et statistiques au Responsable', () => {
    for (const p of ['costs.read', 'stats.read', 'expenses.manage', 'users.manage', 'usedPhones.imei'] as const) {
      expect(can('MANAGER', p)).toBe(true);
      expect(can('TECHNICIAN', p)).toBe(false);
      expect(can('SELLER', p)).toBe(false);
    }
  });
  it('le réparateur gère les réparations mais pas les commandes', () => {
    expect(can('TECHNICIAN', 'repairs.write')).toBe(true);
    expect(can('TECHNICIAN', 'orders.manage')).toBe(false);
  });
  it('le vendeur gère les ventes mais pas l’atelier', () => {
    expect(can('SELLER', 'orders.manage')).toBe(true);
    expect(can('SELLER', 'repairs.write')).toBe(false);
    expect(can('SELLER', 'repairs.handover')).toBe(true);
  });
});

describe('Transitions de réparation', () => {
  it('interdit de sauter du dépôt à la remise', () => {
    expect(canTransitionRepair('RECEIVED', 'PICKED_UP')).toBe(false);
    expect(canTransitionRepair('COMPLETED', 'PICKED_UP')).toBe(true);
  });
  it('un dossier annulé ou récupéré est définitif', () => {
    expect(canTransitionRepair('CANCELLED', 'IN_PROGRESS')).toBe(false);
    expect(canTransitionRepair('PICKED_UP', 'IN_PROGRESS')).toBe(false);
  });
  it('une réparation annulée ne compte jamais comme terminée', () => {
    expect(DONE_STATUSES).not.toContain('CANCELLED');
  });
});

describe('Commandes', () => {
  const s = { deliveryEnabled: true, payInStoreEnabled: true, cashOnDeliveryEnabled: false, mobileMoneyAvailable: false };
  it('vérifie la cohérence réception / paiement', () => {
    expect(checkoutError('PICKUP', 'PAY_IN_STORE', s)).toBeNull();
    expect(checkoutError('DELIVERY', 'PAY_IN_STORE', s)).not.toBeNull();
    expect(checkoutError('DELIVERY', 'CASH_ON_DELIVERY', s)).not.toBeNull();
    expect(checkoutError('PICKUP', 'TMONEY', s)).not.toBeNull();
    expect(checkoutError('DELIVERY', 'CASH_ON_DELIVERY', { ...s, deliveryEnabled: false, cashOnDeliveryEnabled: true })).not.toBeNull();
  });
  it('« prête à être retirée » n’existe que pour un retrait', () => {
    expect(canTransitionOrder('CONFIRMED', 'READY_FOR_PICKUP', 'PICKUP')).toBe(true);
    expect(canTransitionOrder('CONFIRMED', 'READY_FOR_PICKUP', 'DELIVERY')).toBe(false);
    expect(canTransitionOrder('COMPLETED', 'CANCELLED', 'PICKUP')).toBe(false);
  });
});
