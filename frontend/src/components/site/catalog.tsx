import { ArrowRight, ImageOff } from 'lucide-react';
import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { Availability, PhoneCondition, PublicPhone, PublicProduct } from '@/lib/types';
import { cn } from '@/lib/cn';
import { formatPrice } from '@/lib/format';
import { PHONE_CONDITIONS } from '@/lib/phone-conditions';
import { SITE_URL } from '@/lib/site';
import { buyMessage, waLink } from '@/lib/whatsapp';
import { BuyButton } from './buy-button';

export function availabilityText(a: Availability, qty: number) {
  if (a === 'OUT_OF_STOCK') return { text: 'Épuisé', tone: 'text-faint', dot: 'bg-line-2' };
  if (a === 'LOW_STOCK') return { text: qty === 1 ? 'Dernier exemplaire' : `Plus que ${qty}`, tone: 'text-warn', dot: 'bg-warn' };
  return { text: 'En stock', tone: 'text-ok', dot: 'bg-ok' };
}

const CONDITION_STYLE: Record<PhoneCondition, string> = {
  NEW: 'bg-ok text-white',
  IMPORTED: 'bg-ochre text-white',
  USED: 'bg-navy text-white',
};

/** Neuf / Venu / Occasion : toujours accompagné du libellé, jamais la couleur seule. */
export function ConditionBadge({ condition: value, className }: { condition: PhoneCondition | undefined; className?: string }) {
  const condition = value && PHONE_CONDITIONS[value] ? value : 'USED';
  return <span className={cn('inline-flex items-center rounded-xs px-2 py-1 text-[11.5px] font-semibold uppercase leading-none tracking-[0.06em]', CONDITION_STYLE[condition], className)}>{PHONE_CONDITIONS[condition].label}</span>;
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

const card = 'group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-[box-shadow,transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-line-2 hover:shadow-card';

export function ProductCard({ product, priority, whatsapp }: { product: PublicProduct; priority?: boolean; whatsapp?: string | null }) {
  const image = product.images[0];
  const out = product.availability === 'OUT_OF_STOCK';
  const brands = [...new Set(product.compatibility.map((c) => c.model ?? c.brand))].slice(0, 2);
  const href = `/accessoires/${product.slug}`;
  return (
    <article className={card}>
      <div className="relative">
        <Link href={href} className="block" tabIndex={-1} aria-hidden="true">
          <ProductImage src={image?.url} alt={image?.alt ?? product.name} sizes="(min-width: 1024px) 23vw, (min-width: 640px) 31vw, 48vw" priority={priority} />
        </Link>
        {product.availability === 'LOW_STOCK' && <span className="absolute left-2 top-2 rounded-full bg-ochre px-2.5 py-1 text-[11px] font-semibold leading-none text-white">{availabilityText(product.availability, product.availableQuantity).text}</span>}
        <BuyButton
          overlay
          size="sm"
          disabled={out}
          className="absolute bottom-2.5 right-2.5 z-20"
          href={waLink(whatsapp, buyMessage({ name: product.name, price: product.price, ref: product.sku, url: `${SITE_URL}${href}` }))}
        />
      </div>
      <div className="flex flex-1 flex-col p-3 sm:p-4">
        <h3 className="line-clamp-2 text-[14.5px] font-medium leading-snug text-ink">
          <Link href={href} className="after:absolute after:inset-0 hover:text-accent">
            {product.name}
          </Link>
        </h3>
        {brands.length > 0 && <p className="mt-0.5 truncate text-[12.5px] text-muted">{brands.join(', ')}</p>}
        <p className="num mt-auto pt-2.5 text-[16px] font-semibold text-accent">{formatPrice(product.price)}</p>
      </div>
    </article>
  );
}

export function PhoneSpecs({ phone, className }: { phone: PublicPhone; className?: string }) {
  const specs = [
    phone.storageGb ? `${phone.storageGb} Go` : null,
    phone.condition !== 'NEW' ? phone.gradeLabel : null,
    phone.batteryHealth !== null && phone.condition !== 'NEW' ? `Batterie ${phone.batteryHealth} %` : null,
  ].filter(Boolean);
  return <p className={cn('text-[13px] text-muted', className)}>{specs.join(' · ')}</p>;
}

export function PhoneCard({ phone, priority, whatsapp }: { phone: PublicPhone; priority?: boolean; whatsapp?: string | null }) {
  const image = phone.images[0];
  const href = `/telephones/${phone.slug}`;
  const name = `${phone.brand.name} ${phone.title} (${PHONE_CONDITIONS[phone.condition]?.label.toLowerCase() ?? ''})`;
  return (
    <article className={card}>
      <div className="relative">
        <Link href={href} className="block" tabIndex={-1} aria-hidden="true">
          <ProductImage src={image?.url} alt={image?.alt ?? phone.title} sizes="(min-width: 1024px) 23vw, (min-width: 640px) 31vw, 70vw" priority={priority} className="aspect-[4/5]" />
        </Link>
        <span className="absolute left-2.5 top-2.5 flex gap-1.5">
          <ConditionBadge condition={phone.condition} />
          {phone.status === 'RESERVED' && <span className="rounded-xs bg-ink px-2 py-1 text-[11.5px] font-medium leading-none text-white">Réservé</span>}
        </span>
        <BuyButton
          overlay
          size="sm"
          disabled={phone.status !== 'AVAILABLE'}
          className="absolute bottom-2.5 right-2.5 z-20"
          href={waLink(whatsapp, buyMessage({ name, price: phone.price, ref: phone.reference, url: `${SITE_URL}${href}` }))}
        />
      </div>
      <div className="flex flex-1 flex-col p-3 sm:p-4">
        <p className="eyebrow !text-[10.5px]">{phone.brand.name}</p>
        <h3 className="mt-1 text-[15px] font-medium leading-snug">
          <Link href={href} className="after:absolute after:inset-0 hover:text-accent">
            {phone.modelName}
            {phone.storageGb ? ` · ${phone.storageGb} Go` : ''}
          </Link>
        </h3>
        <PhoneSpecs phone={{ ...phone, storageGb: null }} className="mt-0.5" />
        <p className="num mt-auto pt-2.5 text-[16px] font-semibold text-accent">{formatPrice(phone.price)}</p>
      </div>
    </article>
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
