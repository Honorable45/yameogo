import { PackageSearch, Search, Smartphone } from 'lucide-react';
import Link from 'next/link';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/cn';
import { CONDITION_ORDER, conditionFromSlug, PHONE_CONDITIONS } from '@/lib/phone-conditions';
import { serverGet } from '@/lib/server-api';
import type { Paginated, PublicPhone, PublicProduct, ShopCategory } from '@/lib/types';
import { PhoneCard, ProductCard } from './catalog';
import { SortSelect } from './shop-filters';

export type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';
const ORDER_MAP: Record<string, string> = { nouveautes: 'newest', 'prix-croissant': 'price_asc', 'prix-decroissant': 'price_desc' };

/** Adresse de la boutique avec un rayon et des filtres. */
function shopHref(rayon: 'telephones' | 'accessoires', params: Record<string, string | number | null | undefined>) {
  const q = new URLSearchParams();
  if (rayon === 'accessoires') q.set('rayon', 'accessoires');
  for (const [k, v] of Object.entries(params)) if (v && !(k === 'tri' && v === 'nouveautes')) q.set(k, String(v));
  return `/boutique${q.size ? `?${q}` : ''}`;
}

const chip = (active: boolean) => cn('shrink-0 rounded-full px-4 py-2 text-[13.5px] transition-colors', active ? 'bg-navy text-white' : 'glass-light text-ink-2 hover:text-ink');

export async function PhonesListing({ sp, whatsapp }: { sp: Search; whatsapp: string | null }) {
  const brand = one(sp.marque);
  const type = conditionFromSlug(one(sp.type));
  const tri = one(sp.tri) || 'nouveautes';
  const query = new URLSearchParams({ order: ORDER_MAP[tri] ?? 'newest' });
  if (brand) query.set('brand', brand);
  if (type) query.set('condition', type);
  const [phones, all] = await Promise.all([serverGet<PublicPhone[]>(`/shop/phones?${query}`, 30), serverGet<PublicPhone[]>('/shop/phones', 30)]);
  const brands = [...new Map((all ?? []).filter((p) => !type || p.condition === type).map((p) => [p.brand.slug, p.brand])).values()];
  const href = (patch: { type?: string | null; marque?: string | null }) =>
    shopHref('telephones', {
      type: patch.type !== undefined ? patch.type : type ? PHONE_CONDITIONS[type].slug : null,
      marque: patch.marque !== undefined ? patch.marque : brand,
      tri,
    });

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav aria-label="Catégories de téléphones" className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 py-1 sm:mx-0 sm:px-0">
          <Link href={href({ type: null, marque: null })} className={chip(!type)}>
            Tous
          </Link>
          {CONDITION_ORDER.map((c) => (
            <Link key={c} href={href({ type: PHONE_CONDITIONS[c].slug, marque: null })} className={chip(type === c)}>
              {PHONE_CONDITIONS[c].plural}
            </Link>
          ))}
        </nav>
        <SortSelect value={tri} />
      </div>
      {type && <p className="mt-3 text-[14px] text-muted">{PHONE_CONDITIONS[type].text}</p>}
      {brands.length > 1 && (
        <nav aria-label="Marques" className="scrollbar-none -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {[{ slug: '', name: 'Toutes marques' }, ...brands].map((b) => (
            <Link key={b.slug || 'all'} href={href({ marque: b.slug || null })} className={cn('shrink-0 rounded-full border px-3.5 py-1.5 text-[13px]', (brand || '') === b.slug ? 'border-ink text-ink' : 'border-line-2 text-muted hover:text-ink')}>
              {b.name}
            </Link>
          ))}
        </nav>
      )}
      {!phones ? (
        <EmptyState icon={Smartphone} title="Momentanément indisponible" />
      ) : phones.length === 0 ? (
        <EmptyState icon={Smartphone} title="Aucun téléphone pour le moment" />
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 lg:gap-5">
          {phones.map((p, i) => (
            <PhoneCard key={p.id} phone={p} priority={i < 4} whatsapp={whatsapp} />
          ))}
        </div>
      )}
    </>
  );
}

export async function AccessoriesListing({ sp, whatsapp }: { sp: Search; whatsapp: string | null }) {
  const q = one(sp.q);
  const categorie = one(sp.categorie);
  const tri = one(sp.tri) || 'nouveautes';
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const query = new URLSearchParams({ order: ORDER_MAP[tri] ?? 'newest', page: String(page), pageSize: '24' });
  if (q) query.set('q', q);
  if (categorie) query.set('category', categorie);
  const [result, categories] = await Promise.all([serverGet<Paginated<PublicProduct>>(`/shop/products?${query}`, 30), serverGet<ShopCategory[]>('/shop/categories', 120)]);
  const shelves = (categories ?? []).filter((c) => c.productCount > 0);
  const link = (patch: Record<string, string | number | null>) => shopHref('accessoires', { q, categorie, tri, ...patch });

  return (
    <>
      <form action="/boutique" method="get" className="relative" role="search">
        <input type="hidden" name="rayon" value="accessoires" />
        {categorie && <input type="hidden" name="categorie" value={categorie} />}
        <Search className="pointer-events-none absolute left-4 top-1/2 z-10 size-4 -translate-y-1/2 text-muted" />
        <input type="search" name="q" defaultValue={q} placeholder="Rechercher un accessoire" aria-label="Rechercher un accessoire" className="glass-light h-12 w-full rounded-full pl-11 pr-4 text-[15px] outline-none placeholder:text-faint focus:ring-2 focus:ring-accent" />
      </form>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav aria-label="Catégories d’accessoires" className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 py-1 sm:mx-0 sm:flex-wrap sm:px-0">
          <Link href={link({ categorie: null, page: null })} className={chip(!categorie)}>
            Tout
          </Link>
          {shelves.map((c) => (
            <Link key={c.id} href={link({ categorie: c.slug, page: null })} className={chip(categorie === c.slug)}>
              {c.name}
            </Link>
          ))}
        </nav>
        <SortSelect value={tri} />
      </div>
      {!result ? (
        <EmptyState icon={PackageSearch} title="Momentanément indisponible" />
      ) : result.items.length === 0 ? (
        <EmptyState icon={PackageSearch} title="Aucun résultat" action={<Link href={shopHref('accessoires', {})} className="text-[14px] font-medium text-accent underline">Voir tout</Link>} />
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 lg:gap-5">
            {result.items.map((p, i) => (
              <ProductCard key={p.id} product={p} priority={i < 4} whatsapp={whatsapp} />
            ))}
          </div>
          {result.pageCount > 1 && (
            <nav aria-label="Pagination" className="mt-12 flex items-center justify-center gap-3 text-[14px]">
              {page > 1 && <Link href={link({ page: page - 1 })} className="glass-light rounded-full px-5 py-2.5 font-medium">← Précédent</Link>}
              <span className="num text-muted">
                {result.page} / {result.pageCount}
              </span>
              {page < result.pageCount && <Link href={link({ page: page + 1 })} className="glass-light rounded-full px-5 py-2.5 font-medium">Suivant →</Link>}
            </nav>
          )}
        </>
      )}
    </>
  );
}
