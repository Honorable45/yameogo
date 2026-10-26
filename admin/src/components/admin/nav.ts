import {
  BarChart3,
  Boxes,
  ClipboardList,
  Cog,
  Gauge,
  MessageSquareText,
  Package,
  ReceiptText,
  ScrollText,
  ShoppingCart,
  Smartphone,
  Tags,
  Truck,
  Users,
  UserCog,
  Wallet,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  permission?: string;
  /** Clé du compteur de travail en attente (vue d'ensemble). */
  badge?: 'ordersPending' | 'requestsNew' | 'reviewsPending' | 'repairsReady' | 'lowStock';
  exact?: boolean;
}

/** Écrans du quotidien, toujours visibles. */
export const PRIMARY_NAV: NavItem[] = [
  { href: '/', label: 'Accueil', icon: Gauge, exact: true },
  { href: '/reparations', label: 'Réparations', icon: Wrench, permission: 'repairs.read', badge: 'repairsReady' },
  { href: '/occasions', label: 'Téléphones', icon: Smartphone, permission: 'usedPhones.read' },
  { href: '/produits', label: 'Accessoires', icon: Package, permission: 'catalog.read' },
  { href: '/vente', label: 'Caisse', icon: ShoppingCart, permission: 'orders.manage' },
  { href: '/statistiques', label: 'Statistiques', icon: BarChart3, permission: 'stats.read' },
];

/**
 * Écrans occasionnels, regroupés dans « Plus ».
 * Les commandes en ligne et les demandes de devis passent désormais par WhatsApp : leurs écrans
 * restent accessibles par adresse directe (historique), mais ne figurent plus au menu.
 */
export const SECONDARY_NAV: NavItem[] = [
  { href: '/stocks', label: 'Stocks', icon: Boxes, permission: 'stock.read', badge: 'lowStock' },
  { href: '/commandes', label: 'Ventes', icon: ReceiptText, permission: 'orders.read' },
  { href: '/avis', label: 'Avis', icon: MessageSquareText, permission: 'reviews.moderate' },
  { href: '/tarifs', label: 'Tarifs de réparation', icon: Tags, permission: 'repairs.read' },
  { href: '/approvisionnements', label: 'Approvisionnements', icon: Truck, permission: 'purchases.manage' },
  { href: '/fournisseurs', label: 'Fournisseurs', icon: ClipboardList, permission: 'suppliers.manage' },
  { href: '/clients', label: 'Clients', icon: Users, permission: 'customers.read' },
  { href: '/depenses', label: 'Dépenses', icon: Wallet, permission: 'expenses.manage' },
  { href: '/utilisateurs', label: 'Utilisateurs', icon: UserCog, permission: 'users.manage' },
  { href: '/parametres', label: 'Paramètres', icon: Cog, permission: 'settings.manage' },
  { href: '/journal', label: 'Journal', icon: ScrollText, permission: 'audit.read' },
];

export const QUICK_ACTIONS = [
  { href: '/reparations/nouvelle', label: 'Nouvelle réparation', permission: 'repairs.write', icon: Wrench },
  { href: '/vente', label: 'Nouvelle vente', permission: 'orders.manage', icon: ShoppingCart },
  { href: '/produits/nouveau', label: 'Nouvel accessoire', permission: 'catalog.write', icon: Package },
  { href: '/occasions/nouveau', label: 'Nouveau téléphone', permission: 'usedPhones.write', icon: Smartphone },
  { href: '/depenses?nouvelle=1', label: 'Dépense', permission: 'expenses.manage', icon: Wallet },
];
