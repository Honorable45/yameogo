import { can } from '../auth/permissions';
import { canTransitionOrder, checkoutError } from '../orders/order-rules';

describe('Permissions par rôle', () => {
  it('réserve les coûts, marges, statistiques et réglages au Responsable', () => {
    for (const p of ['costs.read', 'stats.read', 'expenses.manage', 'users.manage', 'catalog.write', 'settings.manage'] as const) {
      expect(can('MANAGER', p)).toBe(true);
      expect(can('SELLER', p)).toBe(false);
    }
  });
  it('le vendeur encaisse, consulte le catalogue et remet les codes d’avis', () => {
    for (const p of ['orders.manage', 'catalog.read', 'stock.read', 'reviews.tokens'] as const) expect(can('SELLER', p)).toBe(true);
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
