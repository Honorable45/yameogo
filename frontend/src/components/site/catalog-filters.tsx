'use client';

import { Search, SlidersHorizontal, X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { cn } from '@/lib/cn';
import { formatAmount } from '@/lib/format';
import type { CatalogFacets, ProductKind } from '@/lib/types';
import { CONDITION_LABELS } from './catalog';

const chip = (active: boolean) =>
  cn('inline-flex h-9 items-center rounded-full border px-3.5 text-[13.5px] transition-colors', active ? 'border-ink bg-ink text-white' : 'border-line-2 bg-surface text-ink-2 hover:border-ink hover:text-ink');

/** Filtres du catalogue : l'état est porté par l'adresse (partageable, bouton Retour fonctionnel). */
export function CatalogFilters({ facets, kind, promoPage }: { facets: CatalogFacets | null; kind?: ProductKind; promoPage?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [open, setOpen] = useState(false);
  useEffect(() => setQ(params.get('q') ?? ''), [params]);

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === '') next.delete(k);
      else next.set(k, v);
    }
    next.delete('page');
    startTransition(() => router.replace(`${pathname}${next.size ? `?${next}` : ''}`, { scroll: false }));
  };
  const toggle = (key: string, value: string) => update({ [key]: params.get(key) === value ? null : value });
  const brands = (params.get('brand') ?? '').split(',').filter(Boolean);
  const toggleBrand = (slug: string) => update({ brand: (brands.includes(slug) ? brands.filter((b) => b !== slug) : [...brands, slug]).join(',') || null });
  const active = ['brand', 'category', 'condition', 'ram', 'storage', 'maxPrice', 'available', 'promo', 'q'].filter((k) => params.get(k) && !(promoPage && k === 'promo'));

  const groups = (
    <div className="space-y-5">
      {kind !== 'ACCESSORY' && facets && facets.brands.length > 1 && (
        <Group label="Marque">
          {facets.brands.map((b) => (
            <button key={b.slug} type="button" className={chip(brands.includes(b.slug))} aria-pressed={brands.includes(b.slug)} onClick={() => toggleBrand(b.slug)}>
              {b.name}
            </button>
          ))}
        </Group>
      )}
      {kind !== 'PHONE' && facets && facets.categories.length > 1 && (
        <Group label="Catégorie">
          {facets.categories.map((c) => (
            <button key={c.slug} type="button" className={chip(params.get('category') === c.slug)} aria-pressed={params.get('category') === c.slug} onClick={() => toggle('category', c.slug)}>
              {c.name}
            </button>
          ))}
        </Group>
      )}
      {facets && facets.conditions.length > 1 && (
        <Group label="État">
          {facets.conditions.map((c) => (
            <button key={c} type="button" className={chip(params.get('condition') === c)} aria-pressed={params.get('condition') === c} onClick={() => toggle('condition', c)}>
              {CONDITION_LABELS[c]}
            </button>
          ))}
        </Group>
      )}
      {facets && facets.rams.length > 1 && (
        <Group label="Mémoire RAM">
          {facets.rams.map((r) => (
            <button key={r} type="button" className={chip(params.get('ram') === String(r))} aria-pressed={params.get('ram') === String(r)} onClick={() => toggle('ram', String(r))}>
              {r} Go
            </button>
          ))}
        </Group>
      )}
      {facets && facets.storages.length > 1 && (
        <Group label="Stockage">
          {facets.storages.map((s) => (
            <button key={s} type="button" className={chip(params.get('storage') === String(s))} aria-pressed={params.get('storage') === String(s)} onClick={() => toggle('storage', String(s))}>
              {s} Go
            </button>
          ))}
        </Group>
      )}
      {facets?.price && facets.price.max > facets.price.min && (
        <Group label="Budget maximum">
          <select
            value={params.get('maxPrice') ?? ''}
            onChange={(e) => update({ maxPrice: e.target.value || null })}
            className="h-9 rounded-full border border-line-2 bg-surface px-3.5 text-[13.5px]"
            aria-label="Budget maximum"
          >
            <option value="">Tous les prix</option>
            {budgets(facets.price.min, facets.price.max).map((b) => (
              <option key={b} value={b}>
                Jusqu’à {formatAmount(b)} FCFA
              </option>
            ))}
          </select>
        </Group>
      )}
      <Group label="Affichage">
        <button type="button" className={chip(params.get('available') === '1')} aria-pressed={params.get('available') === '1'} onClick={() => toggle('available', '1')}>
          En stock
        </button>
        {!promoPage && facets?.hasPromotions && (
          <button type="button" className={chip(params.get('promo') === '1')} aria-pressed={params.get('promo') === '1'} onClick={() => toggle('promo', '1')}>
            En promotion
          </button>
        )}
      </Group>
    </div>
  );

  return (
    <div className={cn('transition-opacity', pending && 'opacity-60')}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <form
          role="search"
          className="relative flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            update({ q: q.trim() || null });
          }}
        >
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onBlur={() => q.trim() !== (params.get('q') ?? '') && update({ q: q.trim() || null })}
            placeholder={kind === 'ACCESSORY' ? 'Coque, chargeur, iPhone 13…' : kind === 'PHONE' ? 'Galaxy A56, iPhone, Tecno…' : 'Rechercher'}
            aria-label="Rechercher"
            className="h-11 w-full rounded-full border border-line-2 bg-surface pl-11 pr-4 text-[15px] placeholder:text-faint focus:border-accent focus:outline-none sm:text-[14.5px]"
          />
        </form>
        <div className="flex gap-2">
          <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="inline-flex h-11 items-center gap-2 rounded-full border border-line-2 bg-surface px-4 text-[14px] font-medium lg:hidden">
            <SlidersHorizontal className="size-4" /> Filtres{active.length ? ` (${active.length})` : ''}
          </button>
          <select
            value={params.get('order') ?? 'newest'}
            onChange={(e) => update({ order: e.target.value === 'newest' ? null : e.target.value })}
            aria-label="Trier"
            className="h-11 flex-1 rounded-full border border-line-2 bg-surface px-4 text-[14px] sm:flex-none"
          >
            <option value="newest">Nouveautés</option>
            <option value="price_asc">Prix croissant</option>
            <option value="price_desc">Prix décroissant</option>
          </select>
        </div>
      </div>
      <div className={cn('mt-5', open ? 'block' : 'hidden lg:block')}>{groups}</div>
      {active.length > 0 && (
        <button type="button" onClick={() => update(Object.fromEntries(active.map((k) => [k, null])))} className="mt-4 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-accent">
          <X className="size-4" /> Effacer les filtres
        </button>
      )}
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-4">
      <p className="w-32 shrink-0 text-[12.5px] font-medium uppercase tracking-[0.08em] text-muted">{label}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

/** Paliers de budget arrondis entre le prix minimum et maximum du catalogue. */
function budgets(min: number, max: number) {
  const steps = [5_000, 10_000, 25_000, 50_000, 75_000, 100_000, 150_000, 200_000, 300_000, 500_000, 750_000, 1_000_000];
  return steps.filter((s) => s > min && s < max);
}
