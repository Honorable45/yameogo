'use client';

import Link from 'next/link';
import { ShoppingBag } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useCartCount } from '@/lib/cart';
import { cn } from '@/lib/cn';
import { waLink } from '@/lib/whatsapp';
import { Logo } from './logo';
import { WhatsAppIcon } from './whatsapp';

const NAV = [
  { href: '/telephones', label: 'Smartphones', short: 'Téléphones' },
  { href: '/accessoires', label: 'Accessoires', short: 'Accessoires' },
  { href: '/promotions', label: 'Promotions', short: 'Promos' },
  { href: '/contact', label: 'Contact', short: 'Contact' },
];

/**
 * En-tête flottant en verre dépoli. Toutes les rubriques restent visibles :
 * sur mobile, elles occupent une seconde ligne sous le logo (pas de menu caché).
 */
export function SiteHeader({ logoUrl, shopName, whatsapp }: { logoUrl: string | null; shopName: string; whatsapp: string | null }) {
  const pathname = usePathname();
  const count = useCartCount();
  const active = (href: string) => pathname.startsWith(href);
  const contact = waLink(whatsapp, `Bonjour ${shopName},`);

  const links = (compact: boolean) =>
    NAV.map((item) => (
      <li key={item.href} className={compact ? 'flex-1' : undefined}>
        <Link
          href={item.href}
          aria-current={active(item.href) ? 'page' : undefined}
          className={cn(
            'inline-flex items-center justify-center rounded-full transition-colors',
            compact ? 'h-9 w-full px-1 text-[12.5px]' : 'h-10 px-4 text-[14.5px]',
            active(item.href) ? 'bg-navy font-medium text-white' : 'text-ink-2 hover:bg-white/80 hover:text-ink',
          )}
        >
          {compact ? item.short : item.label}
        </Link>
      </li>
    ));

  return (
    <header className="fixed inset-x-0 top-0 z-40 px-3 pt-3 sm:px-5">
      <div className="glass-light mx-auto max-w-6xl rounded-[28px] lg:rounded-full">
        <div className="flex h-14 items-center justify-between gap-3 pl-5 pr-2">
          <Logo logoUrl={logoUrl} name={shopName} />
          <nav aria-label="Navigation principale" className="hidden lg:block">
            <ul className="flex items-center gap-0.5">{links(false)}</ul>
          </nav>
          <div className="flex items-center gap-1.5">
            <Link
              href="/panier"
              aria-label={`Panier${count ? ` : ${count} article${count > 1 ? 's' : ''}` : ''}`}
              aria-current={active('/panier') ? 'page' : undefined}
              className={cn('relative inline-flex h-10 items-center gap-2 rounded-full px-4 text-[14px] font-medium text-white transition-colors', active('/panier') ? 'bg-navy' : 'glass-dark hover:bg-navy')}
            >
              <ShoppingBag className="size-[17px]" strokeWidth={1.8} />
              <span className="hidden sm:inline">Panier</span>
              {count > 0 && <span className="num -mr-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[11.5px] leading-none">{count}</span>}
            </Link>
            {contact && (
              <a href={contact} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className="inline-flex h-10 items-center gap-2 rounded-full bg-[#1f9d55] px-3 text-[14px] font-medium text-white transition-colors hover:bg-[#188247] sm:px-4">
                <WhatsAppIcon className="size-[18px]" />
                <span className="hidden sm:inline">WhatsApp</span>
              </a>
            )}
          </div>
        </div>
        <nav aria-label="Navigation principale" className="border-t border-white/70 px-1.5 py-1.5 lg:hidden">
          <ul className="flex items-center gap-0.5">{links(true)}</ul>
        </nav>
      </div>
    </header>
  );
}
