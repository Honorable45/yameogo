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
  Truck,
  Users,
  UserCog,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  permission?: string;
  /** Clé du compteur de travail en attente (vue d'ensemble). */
  badge?: 'ordersPending' | 'unpaidSales' | 'lowStock';
  exact?: boolean;
}

/** Écrans du quotidien, toujours visibles. */
export const PRIMARY_NAV: NavItem[] = [
  { href: '/', label: 'Accueil', icon: Gauge, exact: true },
  { href: '/smartphones', label: 'Smartphones', icon: Smartphone, permission: 'catalog.read' },
  { href: '/accessoires', label: 'Accessoires', icon: Package, permission: 'catalog.read' },
  { href: '/vente', label: 'Caisse', icon: ShoppingCart, permission: 'orders.manage' },
  { href: '/commandes', label: 'Ventes', icon: ReceiptText, permission: 'orders.read', badge: 'ordersPending' },
  { href: '/statistiques', label: 'Statistiques', icon: BarChart3, permission: 'stats.read' },
];

/** Écrans occasionnels, regroupés dans « Plus ». */
export const SECONDARY_NAV: NavItem[] = [
  { href: '/stocks', label: 'Stocks', icon: Boxes, permission: 'stock.read', badge: 'lowStock' },
  { href: '/avis', label: 'Avis', icon: MessageSquareText, permission: 'reviews.moderate' },
  { href: '/approvisionnements', label: 'Approvisionnements', icon: Truck, permission: 'purchases.manage' },
  { href: '/fournisseurs', label: 'Fournisseurs', icon: ClipboardList, permission: 'suppliers.manage' },
  { href: '/clients', label: 'Clients', icon: Users, permission: 'customers.read' },
  { href: '/depenses', label: 'Dépenses', icon: Wallet, permission: 'expenses.manage' },
  { href: '/utilisateurs', label: 'Utilisateurs', icon: UserCog, permission: 'users.manage' },
  { href: '/parametres', label: 'Paramètres', icon: Cog, permission: 'settings.manage' },
  { href: '/journal', label: 'Journal', icon: ScrollText, permission: 'audit.read' },
];

export const QUICK_ACTIONS = [
  { href: '/vente', label: 'Nouvelle vente', permission: 'orders.manage', icon: ShoppingCart },
  { href: '/catalogue/nouveau?type=telephone', label: 'Nouveau smartphone', permission: 'catalog.write', icon: Smartphone },
  { href: '/catalogue/nouveau?type=accessoire', label: 'Nouvel accessoire', permission: 'catalog.write', icon: Package },
  { href: '/depenses?nouvelle=1', label: 'Dépense', permission: 'expenses.manage', icon: Wallet },
];
