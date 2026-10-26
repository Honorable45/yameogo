/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { cn } from '@/lib/cn';

/** Logo téléversé par la boutique, ou logotype typographique par défaut : « YAMEOGO » et son point cobalt. */
export function Logo({ logoUrl, name = 'YAMEOGO', inverted, className }: { logoUrl?: string | null; name?: string; inverted?: boolean; className?: string }) {
  return (
    <Link href="/" className={cn('inline-flex items-center', className)} aria-label={`${name} — accueil`}>
      {logoUrl ? (
        <img src={logoUrl.replace(/-1600\.webp$/, '-480.webp')} alt={name} className="h-8 w-auto" />
      ) : (
        <span className={cn('flex items-baseline text-[17px] font-semibold uppercase leading-none tracking-[0.24em]', inverted ? 'text-paper' : 'text-ink')}>
          {name}
          <span className="ml-0.5 inline-block size-[6px] rounded-full bg-accent" aria-hidden="true" />
        </span>
      )}
    </Link>
  );
}
