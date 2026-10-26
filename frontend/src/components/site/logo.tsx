/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { cn } from '@/lib/cn';

/**
 * Logo téléversé par la boutique, ou logotype typographique par défaut :
 * premier mot en gras (« YAMEOGO »), point orange, puis le reste du nom en petites capitales espacées (« SMART TECH »).
 */
export function Logo({ logoUrl, name = 'Yameogo Smart Tech', inverted, className }: { logoUrl?: string | null; name?: string; inverted?: boolean; className?: string }) {
  const [first, ...rest] = name.trim().split(/\s+/);
  return (
    <Link href="/" className={cn('inline-flex items-center', className)} aria-label={`${name} — accueil`}>
      {logoUrl ? (
        <img src={logoUrl.replace(/-1600\.webp$/, '-480.webp')} alt={name} className="h-8 w-auto" />
      ) : (
        <span className={cn('flex items-center uppercase leading-none', inverted ? 'text-paper' : 'text-ink')}>
          <span className="text-[17px] font-semibold tracking-[0.2em]">{first}</span>
          <span className="mx-1.5 inline-block size-[5px] rounded-full bg-ochre" aria-hidden="true" />
          {rest.length > 0 && <span className={cn('text-[10.5px] font-medium tracking-[0.3em]', inverted ? 'text-paper/70' : 'text-ink-2')}>{rest.join(' ')}</span>}
        </span>
      )}
    </Link>
  );
}
