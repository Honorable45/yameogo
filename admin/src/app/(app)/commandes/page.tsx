'use client';

import { Plus, ReceiptText } from 'lucide-react';
import { Suspense } from 'react';
import { useCan } from '@/components/admin/session';
import { DataTable, PageHeader, Pagination, SearchInput, Tabs, Toolbar } from '@/components/admin/ui';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { LoadingBlock } from '@/components/ui/spinner';
import { Status, Tag } from '@/components/ui/status';
import { formatAmount, formatDateTime, formatPhone } from '@/lib/format';
import { ORDER_STATUS, PAYMENT_PREFERENCE, SETTLEMENT } from '@/lib/labels';
import { useList } from '@/lib/use-list';

interface OrderRow {
  id: string;
  number: string;
  channel: 'ONLINE' | 'IN_STORE';
  status: string;
  customerName: string;
  customerPhone: string;
  fulfillment: 'PICKUP' | 'DELIVERY';
  paymentPreference: string;
  total: number;
  amountPaid: number;
  paymentStatus: string;
  createdAt: string;
  _count: { items: number };
}

const params = (tab: string) => (tab === 'open' ? { scope: 'open' } : tab === 'all' ? {} : tab === 'IN_STORE' ? { channel: 'IN_STORE' } : { status: tab });

function OrdersList() {
  const can = useCan();
  const list = useList<OrderRow>('/orders', params, 'PENDING');
  return (
    <>
      <PageHeader
        title="Commandes"
        actions={
          can('orders.manage') && (
            <ButtonLink href="/vente">
              <Plus className="size-4" /> Nouvelle vente
            </ButtonLink>
          )
        }
      />
      <Tabs
        value={list.tab}
        onChange={list.setTab}
        items={[
          { value: 'PENDING', label: 'À confirmer' },
          { value: 'open', label: 'En cours' },
          { value: 'COMPLETED', label: 'Terminées' },
          { value: 'IN_STORE', label: 'Ventes au comptoir' },
          { value: 'CANCELLED', label: 'Annulées' },
          { value: 'all', label: 'Toutes' },
        ]}
      />
      <div className="mt-4 rounded-md border border-line bg-surface">
        <Toolbar>
          <SearchInput value={list.q} onChange={list.setQ} placeholder="N° de commande, client, téléphone" className="sm:max-w-md sm:flex-1" />
        </Toolbar>
        {list.error ? (
          <ErrorState message={list.error} onRetry={list.reload} />
        ) : !list.data ? (
          <LoadingBlock />
        ) : (
          <>
            <DataTable
              rows={list.data.items}
              href={(o) => `/commandes/${o.id}`}
              columns={[
                { key: 'number', header: 'Commande', cell: (o) => <span className="font-mono text-[13px]">{o.number}</span> },
                {
                  key: 'customer',
                  header: 'Client',
                  cell: (o) => (
                    <span>
                      {o.customerName}
                      {o.customerPhone && <span className="num block text-[12.5px] text-muted">{formatPhone(o.customerPhone)}</span>}
                    </span>
                  ),
                },
                { key: 'channel', header: 'Canal', cell: (o) => (o.channel === 'ONLINE' ? <Tag tone="info">En ligne · {o.fulfillment === 'DELIVERY' ? 'livraison' : 'retrait'}</Tag> : <Tag>Comptoir</Tag>) },
                { key: 'status', header: 'Statut', cell: (o) => <Status tone={ORDER_STATUS[o.status].tone}>{ORDER_STATUS[o.status].label}</Status> },
                { key: 'payment', header: 'Paiement', cell: (o) => <span><Status tone={SETTLEMENT[o.paymentStatus].tone}>{SETTLEMENT[o.paymentStatus].label}</Status>{o.paymentStatus !== 'PAID' && <span className="block text-[12px] text-muted">{PAYMENT_PREFERENCE[o.paymentPreference]}</span>}</span> },
                { key: 'date', header: 'Date', cell: (o) => <span className="num">{formatDateTime(o.createdAt)}</span> },
                { key: 'total', header: 'Total (FCFA)', align: 'right', cell: (o) => formatAmount(o.total) },
              ]}
              empty={<EmptyState icon={ReceiptText} title="Aucune commande" className="py-12">Aucune commande dans cette vue.</EmptyState>}
            />
            <Pagination page={list.data.page} pageCount={list.data.pageCount} total={list.data.total} onPage={list.setPage} />
          </>
        )}
      </div>
    </>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <OrdersList />
    </Suspense>
  );
}
