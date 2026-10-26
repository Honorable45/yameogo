import { ArrowRight, ImageOff } from 'lucide-react';
import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { Availability, CatalogCard, Condition } from '@/lib/types';
import { cn } from '@/lib/cn';
import { formatPrice } from '@/lib/format';

export function availabilityText(a: Availability, qty: number) {
  if (a === 'OUT_OF_STOCK') return { text: 'Épuisé', tone: 'text-faint', dot: 'bg-line-2' };
  if (a === 'LOW_STOCK') return { text: qty === 1 ? 'Dernière unité' : `Plus que ${qty}`, tone: 'text-warn', dot: 'bg-warn' };
  return { text: 'En stock', tone: 'text-ok', dot: 'bg-ok' };
}

export const CONDITION_LABELS: Record<Condition, string> = { NEW: 'Neuf', USED: 'Occasion' };

/** Neuf / Occasion : toujours accompagné du libellé, jamais la couleur seule. */
export function ConditionBadge({ condition, className }: { condition: Condition; className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-xs px-2 py-1 text-[11px] font-semibold uppercase leading-none tracking-[0.06em]', condition === 'NEW' ? 'bg-surface text-ink ring-1 ring-line-2' : 'bg-navy text-white', className)}>
      {CONDITION_LABELS[condition]}
    </span>
  );
}

/** « −12 % » : réduction arrondie, seulement si le prix barré est renseigné. */
export function discount(price: number, compareAt: number | null) {
  return compareAt && compareAt > price ? Math.round(((compareAt - price) / compareAt) * 100) : null;
}

export function PriceTag({ price, compareAt, from, size = 'md', className }: { price: number; compareAt?: number | null; from?: boolean; size?: 'md' | 'lg'; className?: string }) {
  const off = discount(price, compareAt ?? null);
  return (
    <p className={cn('flex flex-wrap items-baseline gap-x-2 gap-y-0.5', className)}>
      {from && <span className="text-[12.5px] text-muted">À partir de</span>}
      <span className={cn('num font-semibold', off ? 'text-ochre-ink' : 'text-accent', size === 'lg' ? 'text-[30px] leading-none sm:text-[34px]' : 'text-[16px]')}>{formatPrice(price)}</span>
      {off && compareAt && (
        <>
          <span className={cn('num text-muted line-through', size === 'lg' ? 'text-[16px]' : 'text-[12.5px]')}>{formatPrice(compareAt)}</span>
          {size === 'lg' && <span className="rounded-full bg-ochre-soft px-2 py-0.5 text-[12.5px] font-semibold text-ochre-ink">−{off} %</span>}
        </>
      )}
    </p>
  );
}

export function ProductImage({ src, alt, sizes, priority, className }: { src: string | null | undefined; alt: string; sizes: string; priority?: boolean; className?: string }) {
  return (
    <div className={cn('relative aspect-square overflow-hidden bg-paper-2', className)}>
      {src ? (
        <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]" />
      ) : (
        <div className="flex h-full items-center justify-center text-faint">
          <ImageOff className="size-6" strokeWidth={1.25} aria-hidden="true" />
          <span className="sr-only">Photo à venir</span>
        </div>
      )}
    </div>
  );
}

/** Pastilles de couleur (avec leur nom en infobulle et pour les lecteurs d'écran). */
export function ColorDots({ colors, max = 5, className }: { colors: { name: string; hex: string | null }[]; max?: number; className?: string }) {
  if (!colors.length) return null;
  return (
    <ul className={cn('flex items-center gap-1', className)} aria-label={`Couleurs : ${colors.map((c) => c.name).join(', ')}`}>
      {colors.slice(0, max).map((c) => (
        <li key={c.name} title={c.name} className="size-3.5 rounded-full ring-1 ring-black/15" style={{ background: c.hex ?? 'var(--color-paper-3)' }} />
      ))}
      {colors.length > max && <li className="text-[11.5px] text-muted">+{colors.length - max}</li>}
    </ul>
  );
}

const card = 'group relative flex w-full flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-[box-shadow,transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-line-2 hover:shadow-card';

/** Résumé des capacités proposées : « 8 Go RAM · 128 / 256 Go ». */
function capacities(p: CatalogCard) {
  const parts = [p.ramGbs.length ? `${p.ramGbs.join(' / ')} Go RAM` : null, p.storageGbs.length ? `${p.storageGbs.join(' / ')} Go` : null];
  return parts.filter(Boolean).join(' · ');
}

/** `compact` : nom et prix seulement (accueil), sans capacités, état ni couleurs. */
export function ProductCard({ product: p, priority, compact }: { product: CatalogCard; priority?: boolean; compact?: boolean }) {
  const href = `/${p.kind === 'PHONE' ? 'telephones' : 'accessoires'}/${p.slug}`;
  const off = p.priceFrom !== null ? discount(p.priceFrom, p.compareAtPrice) : null;
  const phone = p.kind === 'PHONE';
  const details = phone && !compact;
  return (
    <article className={card}>
      <Link href={href} className="relative block" tabIndex={-1} aria-hidden="true">
        <ProductImage src={p.image?.url} alt={p.image?.alt ?? p.name} sizes="(min-width: 1024px) 23vw, (min-width: 640px) 31vw, 48vw" priority={priority} className={phone ? 'aspect-[4/5]' : undefined} />
        <span className="absolute left-2.5 top-2.5 flex flex-wrap gap-1.5">
          {off && <span className="rounded-full bg-ochre px-2.5 py-1 text-[11px] font-semibold leading-none text-white">−{off} %</span>}
          {!p.inStock && <span className="rounded-full bg-ink/80 px-2.5 py-1 text-[11px] font-medium leading-none text-white">Épuisé</span>}
        </span>
      </Link>
      <div className="flex flex-1 flex-col p-3 sm:p-4">
        {p.brand && <p className="eyebrow !text-[10.5px]">{p.brand.name}</p>}
        <h3 className={cn('line-clamp-2 text-[14.5px] font-medium leading-snug text-ink sm:text-[15px]', p.brand && 'mt-1')}>
          <Link href={href} className="after:absolute after:inset-0 hover:text-accent">
            {p.name}
          </Link>
        </h3>
        {details && capacities(p) && <p className="mt-1 text-[12.5px] text-muted">{capacities(p)}</p>}
        {details && p.conditions.length > 0 && <p className="mt-0.5 text-[12.5px] text-muted">{p.conditions.map((c) => CONDITION_LABELS[c]).join(' ou ')}</p>}
        {!compact && <ColorDots colors={p.colors} className="mt-2.5" />}
        {p.priceFrom !== null && <PriceTag price={p.priceFrom} compareAt={p.compareAtPrice} from={p.priceTo !== null && p.priceTo > p.priceFrom} className="mt-auto pt-3" />}
      </div>
    </article>
  );
}

/** `compact` : sur mobile, rangée qui défile horizontalement (une carte et demie visible) au lieu d'une longue grille. */
export function ProductGrid({ products, className, compact }: { products: CatalogCard[]; className?: string; compact?: boolean }) {
  return (
    <ul
      className={cn(
        compact
          ? 'scrollbar-none -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:scroll-px-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0 lg:grid-cols-4 lg:gap-5'
          : 'grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 lg:gap-5',
        className,
      )}
    >
      {products.map((p, i) => (
        <li key={p.id} className={cn('flex min-w-0', compact && 'w-[44%] shrink-0 snap-start sm:w-auto')}>
          <ProductCard product={p} priority={i < 4} compact={compact} />
        </li>
      ))}
    </ul>
  );
}

export function Stars({ value, size = 'sm', label }: { value: number; size?: 'sm' | 'md'; label?: string }) {
  const rounded = Math.round(value * 2) / 2;
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={label ?? `${value.toLocaleString('fr-FR')} sur 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} viewBox="0 0 20 20" className={size === 'sm' ? 'size-3.5' : 'size-5'} aria-hidden="true">
          <defs>
            <linearGradient id={`half-${i}`}>
              <stop offset="50%" stopColor="currentColor" />
              <stop offset="50%" stopColor="transparent" />
            </linearGradient>
          </defs>
          <path
            d="M10 1.8l2.47 5.3 5.8.67-4.3 3.95 1.17 5.73L10 14.6l-5.14 2.85 1.17-5.73-4.3-3.95 5.8-.67z"
            className="text-ochre"
            fill={rounded >= i ? 'currentColor' : rounded === i - 0.5 ? `url(#half-${i})` : 'none'}
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        </svg>
      ))}
    </span>
  );
}

export function SectionHeading({ eyebrow, title, action, className, text }: { eyebrow?: string; title: string; action?: ReactNode; className?: string; text?: string }) {
  return (
    <div className={cn('flex items-end justify-between gap-6', className)}>
      <div>
        {eyebrow && <p className="eyebrow mb-2 !text-ochre">{eyebrow}</p>}
        <h2 className="display text-[28px] sm:text-[34px]">{title}</h2>
        {text && <p className="mt-2 max-w-xl text-[15px] text-ink-2">{text}</p>}
      </div>
      {action && <div className="shrink-0 pb-1">{action}</div>}
    </div>
  );
}

export function MoreLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="group inline-flex items-center gap-1.5 whitespace-nowrap text-[14px] font-medium text-accent">
      <span className="hidden sm:inline">{children}</span>
      <span className="sm:hidden">Tout voir</span>
      <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
