/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { BrandMark } from '@/components/ui/brand-mark';
import { cn } from '@/lib/cn';

/** Logo téléversé par la boutique, ou par défaut le sac orange suivi du nom. */
export function Logo({ logoUrl, name = 'Le Marchand', inverted, className }: { logoUrl?: string | null; name?: string; inverted?: boolean; className?: string }) {
  return (
    <Link href="/" className={cn('inline-flex items-center', className)} aria-label={`${name} — accueil`}>
      {logoUrl ? (
        <img src={logoUrl.replace(/-1600\.webp$/, '-480.webp')} alt={name} className="h-8 w-auto" />
      ) : (
        <span className={cn('flex items-center gap-2 leading-none', inverted ? 'text-paper' : 'text-ink')}>
          <BrandMark className="h-8 w-auto shrink-0" />
          <span className="whitespace-nowrap text-[18px] font-semibold tracking-tight">{name}</span>
        </span>
      )}
    </Link>
  );
}
