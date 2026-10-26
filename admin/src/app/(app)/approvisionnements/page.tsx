'use client';

import { Plus, Truck } from 'lucide-react';
import { Suspense } from 'react';
import { DataTable, PageHeader, Pagination, SearchInput, Tabs, Toolbar } from '@/components/admin/ui';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { LoadingBlock } from '@/components/ui/spinner';
import { Status } from '@/components/ui/status';
import { formatAmount, formatDate } from '@/lib/format';
import { PURCHASE_STATUS, SETTLEMENT } from '@/lib/labels';
import { useList } from '@/lib/use-list';

interface PurchaseRow {
  id: string;
  number: string;
  invoiceNumber: string | null;
  purchaseDate: string;
  status: string;
  total: number;
  amountPaid: number;
  paymentStatus: string;
  supplier: { name: string };
  _count: { items: number };
}

const params = (tab: string) => (tab === 'all' ? {} : { status: tab });

function PurchasesList() {
  const list = useList<PurchaseRow>('/purchases', params, 'all');
  return (
    <>
      <PageHeader
        title="Approvisionnements"
        actions={
          <ButtonLink href="/approvisionnements/nouveau">
            <Plus className="size-4" /> Nouvel approvisionnement
          </ButtonLink>
        }
      />
      <Tabs
        value={list.tab}
        onChange={list.setTab}
        items={[
          { value: 'all', label: 'Tous' },
          { value: 'DRAFT', label: 'Brouillons' },
          { value: 'VALIDATED', label: 'Validés' },
          { value: 'CANCELLED', label: 'Annulés' },
        ]}
      />
      <div className="mt-4 rounded-md border border-line bg-surface">
        <Toolbar>
          <SearchInput value={list.q} onChange={list.setQ} placeholder="N°, facture, fournisseur" className="sm:max-w-md sm:flex-1" />
        </Toolbar>
        {list.error ? (
          <ErrorState message={list.error} onRetry={list.reload} />
        ) : !list.data ? (
          <LoadingBlock />
        ) : (
          <>
            <DataTable
              rows={list.data.items}
              href={(p) => `/approvisionnements/${p.id}`}
              columns={[
                { key: 'number', header: 'N°', cell: (p) => <span className="font-mono text-[13px]">{p.number}</span> },
                { key: 'supplier', header: 'Fournisseur', cell: (p) => <span>{p.supplier.name}{p.invoiceNumber && <span className="block text-[12px] text-muted">Facture {p.invoiceNumber}</span>}</span> },
                { key: 'date', header: 'Date', cell: (p) => <span className="num">{formatDate(p.purchaseDate)}</span> },
                { key: 'status', header: 'Statut', cell: (p) => <Status tone={PURCHASE_STATUS[p.status].tone}>{PURCHASE_STATUS[p.status].label}</Status> },
                { key: 'payment', header: 'Règlement', cell: (p) => (p.status === 'CANCELLED' ? '—' : <Status tone={SETTLEMENT[p.paymentStatus].tone}>{SETTLEMENT[p.paymentStatus].label}</Status>) },
                { key: 'total', header: 'Total (FCFA)', align: 'right', cell: (p) => formatAmount(p.total) },
              ]}
              empty={<EmptyState icon={Truck} title="Aucun approvisionnement" className="py-12">Enregistrez vos achats ici pour suivre le stock et le coût réel des articles.</EmptyState>}
            />
            <Pagination page={list.data.page} pageCount={list.data.pageCount} total={list.data.total} onPage={list.setPage} />
          </>
        )}
      </div>
    </>
  );
}

export default function PurchasesPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <PurchasesList />
    </Suspense>
  );
}
