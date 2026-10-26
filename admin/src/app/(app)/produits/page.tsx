'use client';

import { ImageOff, Package, Plus } from 'lucide-react';
import Image from 'next/image';
import { Suspense } from 'react';
import { useCan } from '@/components/admin/session';
import { DataTable, PageHeader, Pagination, SearchInput, Tabs, Toolbar } from '@/components/admin/ui';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { LoadingBlock } from '@/components/ui/spinner';
import { Tag } from '@/components/ui/status';
import { StockStatus } from '@/components/admin/stock-status';
import type { AdminProduct } from '@/lib/admin-types';
import { formatAmount } from '@/lib/format';
import { useList } from '@/lib/use-list';

const params = (tab: string) => (tab === 'ARCHIVED' ? { status: 'ARCHIVED' } : { kind: tab });

function ProductsList() {
  const can = useCan();
  const list = useList<AdminProduct>('/products', params, 'ACCESSORY');
  const costs = can('costs.read');
  return (
    <>
      <PageHeader
        title="Accessoires et pièces"
        actions={
          can('catalog.write') && (
            <ButtonLink href={`/produits/nouveau${list.tab === 'PART' ? '?type=piece' : ''}`}>
              <Plus className="size-4" /> {list.tab === 'PART' ? 'Nouvelle pièce' : 'Nouvel accessoire'}
            </ButtonLink>
          )
        }
      />
      <Tabs
        value={list.tab}
        onChange={list.setTab}
        items={[
          { value: 'ACCESSORY', label: 'Accessoires' },
          { value: 'PART', label: 'Pièces détachées' },
          { value: 'ARCHIVED', label: 'Archivés' },
        ]}
      />
      <div className="mt-4 rounded-md border border-line bg-surface">
        <Toolbar>
          <SearchInput value={list.q} onChange={list.setQ} placeholder="Nom ou référence" className="sm:max-w-md sm:flex-1" />
        </Toolbar>
        {list.error ? (
          <ErrorState message={list.error} onRetry={list.reload} />
        ) : !list.data ? (
          <LoadingBlock />
        ) : (
          <>
            <DataTable
              rows={list.data.items}
              href={(p) => `/produits/${p.id}`}
              columns={[
                {
                  key: 'name',
                  header: 'Article',
                  cell: (p) => (
                    <span className="flex items-center gap-3">
                      <span className="relative hidden size-10 shrink-0 overflow-hidden rounded-xs bg-paper-2 md:block">
                        {p.images[0]?.url ? <Image src={p.images[0].url} alt="" fill sizes="40px" className="object-cover" /> : <ImageOff className="m-auto mt-3 size-4 text-faint" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{p.name}</span>
                        <span className="flex items-center gap-2 text-[12px] text-muted">
                          <span className="font-mono">{p.sku}</span>
                          {p.kind === 'ACCESSORY' && !p.published && <Tag>Non publié</Tag>}
                          {p.isDemo && <Tag tone="warn">Démo</Tag>}
                        </span>
                      </span>
                    </span>
                  ),
                },
                { key: 'category', header: 'Catégorie', cell: (p) => p.category.name },
                { key: 'stock', header: 'Disponible', cell: (p) => <StockStatus p={p} /> },
                { key: 'price', header: 'Prix (FCFA)', align: 'right', cell: (p) => (p.kind === 'PART' && !p.salePrice ? '—' : formatAmount(p.salePrice)) },
                ...(costs
                  ? [
                      { key: 'cost', header: 'Coût moyen', align: 'right' as const, cell: (p: AdminProduct) => formatAmount(p.averageCost) },
                      { key: 'value', header: 'Valeur stock', align: 'right' as const, cell: (p: AdminProduct) => formatAmount(p.stockValue) },
                    ]
                  : []),
              ]}
              empty={<EmptyState icon={Package} title="Aucun article" className="py-12">{list.q ? 'Aucun article ne correspond.' : 'Ajoutez votre premier article.'}</EmptyState>}
            />
            <Pagination page={list.data.page} pageCount={list.data.pageCount} total={list.data.total} onPage={list.setPage} />
          </>
        )}
      </div>
    </>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <ProductsList />
    </Suspense>
  );
}
