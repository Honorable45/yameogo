import { Role } from '@prisma/client';

/**
 * Matrice des autorisations. Vérifiée côté serveur sur chaque route protégée.
 * Le frontend ne s'en sert que pour adapter l'affichage.
 */
export const PERMISSIONS = [
  'catalog.read',
  'catalog.write',
  'costs.read', // coûts d'achat, coût moyen, marges
  'stock.read',
  'stock.adjust',
  'purchases.manage',
  'suppliers.manage',
  'usedPhones.read',
  'usedPhones.write',
  'usedPhones.imei',
  'repairs.read',
  'repairs.write',
  'repairs.imei',
  'repairs.payments',
  'repairs.handover',
  'repairPricing.manage',
  'requests.manage',
  'orders.read',
  'orders.manage',
  'orders.returns',
  'payments.cancel',
  'customers.read',
  'customers.write',
  'reviews.moderate',
  'reviews.tokens',
  'expenses.manage',
  'stats.read',
  'users.manage',
  'settings.manage',
  'audit.read',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const TECHNICIAN: Permission[] = [
  'catalog.read',
  'stock.read',
  'usedPhones.read',
  'repairs.read',
  'repairs.write',
  'repairs.imei',
  'repairs.payments',
  'repairs.handover',
  'requests.manage',
  'customers.read',
  'customers.write',
  'reviews.tokens',
];

const SELLER: Permission[] = [
  'catalog.read',
  'stock.read',
  'usedPhones.read',
  'repairs.read',
  'repairs.payments',
  'repairs.handover',
  'orders.read',
  'orders.manage',
  'customers.read',
  'customers.write',
  'reviews.tokens',
];

export const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  MANAGER: new Set(PERMISSIONS),
  TECHNICIAN: new Set(TECHNICIAN),
  SELLER: new Set(SELLER),
};

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}

export const ROLE_LABELS: Record<Role, string> = {
  MANAGER: 'Responsable',
  TECHNICIAN: 'Réparateur',
  SELLER: 'Vendeur',
};
