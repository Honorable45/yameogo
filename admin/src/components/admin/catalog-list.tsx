'use client';

import { ImageOff, Package, Plus, Smartphone } from 'lucide-react';
import Image from 'next/image';
import { useCan } from '@/components/admin/session';
import { DataTable, PageHeader, Pagination, SearchInput, Tabs, Toolbar } from '@/components/admin/ui';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { LoadingBlock } from '@/components/ui/spinner';
import { Tag } from '@/components/ui/status';
import type { GroupRow, ProductKind } from '@/lib/admin-types';
import { formatAmount, pluralize } from '@/lib/format';
import { useList } from '@/lib/use-list';

/** Liste des fiches produits d'un rayon (smartphones ou accessoires). */
export function CatalogList({ kind }: { kind: ProductKind }) {
  const can = useCan();
  const phone = kind === 'PHONE';
  const list = useList<GroupRow>('/catalog-groups', (tab) => ({ kind, status: tab === 'archived' ? 'ARCHIVED' : 'ACTIVE' }), 'active');
  return (
    <>
      <PageHeader
        title={phone ? 'Smartphones' : 'Accessoires'}
        actions={
          can('catalog.write') && (
            <ButtonLink href={`/catalogue/nouveau?type=${phone ? 'telephone' : 'accessoire'}`}>
              <Plus className="size-4" /> {phone ? 'Nouveau smartphone' : 'Nouvel accessoire'}
            </ButtonLink>
          )
        }
      />
      <Tabs
        value={list.tab}
        onChange={list.setTab}
        items={[
          { value: 'active', label: 'En catalogue' },
          { value: 'archived', label: 'Archivés' },
        ]}
      />
      <div className="mt-4 rounded-md border border-line bg-surface">
        <Toolbar>
          <SearchInput value={list.q} onChange={list.setQ} placeholder={phone ? 'Modèle, marque ou référence' : 'Nom ou référence'} className="sm:max-w-md sm:flex-1" />
        </Toolbar>
        {list.error ? (
          <ErrorState message={list.error} onRetry={list.reload} />
        ) : !list.data ? (
          <LoadingBlock />
        ) : (
          <>
            <DataTable
              rows={list.data.items}
              href={(g) => `/catalogue/${g.id}`}
              columns={[
                {
                  key: 'name',
                  header: 'Produit',
                  cell: (g) => (
                    <span className="flex items-center gap-3">
                      <span className="relative hidden size-11 shrink-0 overflow-hidden rounded-xs bg-paper-2 md:block">
                        {g.image?.url ? <Image src={g.image.url} alt="" fill sizes="44px" className="object-cover" /> : <ImageOff className="m-auto mt-3.5 size-4 text-faint" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{g.name}</span>
                        <span className="flex flex-wrap items-center gap-1.5 text-[12px] text-muted">
                          {g.brand?.name ?? g.category.name}
                          {!g.published && <Tag>Masqué du site</Tag>}
                          {g.onSale && <Tag tone="warn">Promotion</Tag>}
                          {g.isDemo && <Tag tone="info">Démo</Tag>}
                        </span>
                      </span>
                    </span>
                  ),
                },
                { key: 'variants', header: 'Configurations', cell: (g) => pluralize(g.variantCount, 'configuration') },
                {
                  key: 'stock',
                  header: 'Stock',
                  cell: (g) => (
                    <span>
                      <span className="num">{g.stock}</span>
                      {g.outOfStock > 0 && <span className="ml-2 text-[12.5px] text-bad">{g.outOfStock} épuisée{g.outOfStock > 1 ? 's' : ''}</span>}
                    </span>
                  ),
                },
                {
                  key: 'price',
                  header: 'Prix (FCFA)',
                  align: 'right',
                  cell: (g) => (g.priceFrom === null ? '—' : g.priceFrom === g.priceTo ? formatAmount(g.priceFrom) : `${formatAmount(g.priceFrom)} – ${formatAmount(g.priceTo)}`),
                },
              ]}
              empty={
                <EmptyState icon={phone ? Smartphone : Package} title={phone ? 'Aucun smartphone' : 'Aucun accessoire'} className="py-12">
                  {list.q ? 'Aucun produit ne correspond.' : list.tab === 'archived' ? 'Aucun produit archivé.' : 'Ajoutez votre premier produit.'}
                </EmptyState>
              }
            />
            <Pagination page={list.data.page} pageCount={list.data.pageCount} total={list.data.total} onPage={list.setPage} />
          </>
        )}
      </div>
    </>
  );
}
