'use client';

import { Inbox } from 'lucide-react';
import { Suspense } from 'react';
import { DataTable, PageHeader, Pagination, SearchInput, Tabs, Toolbar } from '@/components/admin/ui';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { LoadingBlock } from '@/components/ui/spinner';
import { Status } from '@/components/ui/status';
import { formatDateTime, formatPhone, formatPrice } from '@/lib/format';
import { REQUEST_STATUS } from '@/lib/labels';
import { useList } from '@/lib/use-list';

interface RequestRow {
  id: string;
  reference: string;
  brandName: string;
  modelName: string;
  issueLabel: string;
  estimatedTotal: number | null;
  customerName: string | null;
  customerPhone: string;
  status: string;
  createdAt: string;
  repairJob: { id: string; number: string } | null;
}

const params = (tab: string) => (tab === 'all' ? {} : { status: tab });

function RequestsList() {
  const list = useList<RequestRow>('/repair-requests', params, 'NEW');
  return (
    <>
      <PageHeader title="Demandes de devis" />
      <Tabs
        value={list.tab}
        onChange={list.setTab}
        items={[
          { value: 'NEW', label: 'Nouvelles' },
          { value: 'CONTACTED', label: 'Client contacté' },
          { value: 'CONVERTED', label: 'Prises en charge' },
          { value: 'CLOSED', label: 'Classées' },
          { value: 'all', label: 'Toutes' },
        ]}
      />
      <div className="mt-4 rounded-md border border-line bg-surface">
        <Toolbar>
          <SearchInput value={list.q} onChange={list.setQ} placeholder="Référence, client, téléphone, modèle" className="sm:max-w-md sm:flex-1" />
        </Toolbar>
        {list.error ? (
          <ErrorState message={list.error} onRetry={list.reload} />
        ) : !list.data ? (
          <LoadingBlock />
        ) : (
          <>
            <DataTable
              rows={list.data.items}
              href={(r) => `/demandes/${r.id}`}
              columns={[
                { key: 'ref', header: 'Référence', cell: (r) => <span className="font-mono text-[13px]">{r.reference}</span> },
                { key: 'device', header: 'Appareil', cell: (r) => <span><span className="font-medium">{r.brandName} {r.modelName}</span><span className="block text-[12.5px] text-muted">{r.issueLabel}</span></span> },
                { key: 'customer', header: 'Client', cell: (r) => <span>{r.customerName ?? '—'}<span className="num block text-[12.5px] text-muted">{formatPhone(r.customerPhone)}</span></span> },
                { key: 'estimate', header: 'Estimation', cell: (r) => (r.estimatedTotal !== null ? <span className="num">{formatPrice(r.estimatedTotal)}</span> : <span className="text-muted">Personnalisée</span>) },
                { key: 'status', header: 'Statut', cell: (r) => <Status tone={REQUEST_STATUS[r.status].tone}>{REQUEST_STATUS[r.status].label}</Status> },
                { key: 'date', header: 'Reçue', cell: (r) => <span className="num">{formatDateTime(r.createdAt)}</span> },
              ]}
              empty={<EmptyState icon={Inbox} title="Aucune demande" className="py-12">Les demandes envoyées depuis la page « Devis de réparation » apparaissent ici.</EmptyState>}
            />
            <Pagination page={list.data.page} pageCount={list.data.pageCount} total={list.data.total} onPage={list.setPage} />
          </>
        )}
      </div>
    </>
  );
}

export default function RequestsPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <RequestsList />
    </Suspense>
  );
}
