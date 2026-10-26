/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { cn } from '@/lib/cn';

/** Logo téléversé par la boutique, ou logotype typographique par défaut. */
export function Logo({ logoUrl, name = 'YAMEOGO', inverted, className }: { logoUrl?: string | null; name?: string; inverted?: boolean; className?: string }) {
  return (
    <Link href="/" className={cn('inline-flex items-center', className)} aria-label={`${name} — accueil`}>
      {logoUrl ? (
        <img src={logoUrl.replace(/-1600\.webp$/, '-480.webp')} alt={name} className="h-8 w-auto" />
      ) : (
        <span className="flex items-baseline gap-2">
          <span className={cn('font-serif text-[25px] font-semibold leading-none tracking-[-0.02em]', inverted ? 'text-paper' : 'text-ink')}>TH</span>
          <span className={cn('h-4 w-px self-center', inverted ? 'bg-paper/30' : 'bg-line-2')} aria-hidden="true" />
          <span className={cn('text-[11px] font-medium uppercase leading-none tracking-[0.28em]', inverted ? 'text-paper/80' : 'text-ink-2')}>Store</span>
        </span>
      )}
    </Link>
  );
}
