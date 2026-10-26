import { PackageSearch } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import { serverGet } from '@/lib/server-api';
import type { CatalogCard, CatalogFacets, Paginated, ProductKind } from '@/lib/types';
import { ProductGrid } from './catalog';
import { CatalogFilters } from './catalog-filters';

export type CatalogSearch = Record<string, string | undefined>;

const FILTERS = ['q', 'brand', 'category', 'condition', 'ram', 'storage', 'minPrice', 'maxPrice', 'available', 'promo', 'order', 'page'] as const;

/** Liste filtrable du catalogue (smartphones, accessoires ou promotions). */
export async function CatalogListing({ kind, search, promo, basePath }: { kind?: ProductKind; search: CatalogSearch; promo?: boolean; basePath: string }) {
  const query = new URLSearchParams({ pageSize: '24' });
  if (kind) query.set('kind', kind);
  for (const key of FILTERS) {
    const value = search[key];
    if (value) query.set(key, value);
  }
  if (promo) query.set('promo', '1');
  const [result, facets] = await Promise.all([
    serverGet<Paginated<CatalogCard>>(`/shop/catalog?${query}`, 30),
    serverGet<CatalogFacets>(`/shop/catalog-facets${kind ? `?kind=${kind}` : ''}`, 60),
  ]);
  const pageHref = (page: number) => {
    const p = new URLSearchParams();
    for (const key of FILTERS) if (key !== 'page' && search[key]) p.set(key, search[key]!);
    if (page > 1) p.set('page', String(page));
    return `${basePath}${p.size ? `?${p}` : ''}`;
  };

  return (
    <>
      <Suspense>
        <CatalogFilters facets={facets} kind={kind} promoPage={promo} />
      </Suspense>
      {!result ? (
        <p className="py-20 text-center text-muted">Le catalogue est momentanément indisponible. Réessayez dans un instant.</p>
      ) : result.items.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <PackageSearch className="size-8 text-faint" strokeWidth={1.4} />
          <p className="mt-4 text-[16px] font-medium">{promo ? 'Aucune promotion en cours.' : 'Aucun produit ne correspond.'}</p>
          {!promo && (
            <Link href={basePath} className="mt-3 text-[14px] font-medium text-accent underline">
              Voir tout le catalogue
            </Link>
          )}
        </div>
      ) : (
        <>
          <p className="mt-6 text-[13.5px] text-muted" aria-live="polite">
            {result.total} produit{result.total > 1 ? 's' : ''}
          </p>
          <ProductGrid products={result.items} className="mt-3" />
          {result.pageCount > 1 && (
            <nav aria-label="Pages" className="mt-10 flex items-center justify-center gap-2">
              {Array.from({ length: result.pageCount }, (_, i) => i + 1).map((n) => (
                <Link
                  key={n}
                  href={pageHref(n)}
                  aria-current={n === result.page ? 'page' : undefined}
                  className={n === result.page ? 'flex size-10 items-center justify-center rounded-full bg-ink text-[14px] text-white' : 'flex size-10 items-center justify-center rounded-full border border-line-2 text-[14px] hover:border-ink'}
                >
                  {n}
                </Link>
              ))}
            </nav>
          )}
        </>
      )}
    </>
  );
}
