'use client';

import { Users } from 'lucide-react';
import { Suspense } from 'react';
import { DataTable, PageHeader, Pagination, SearchInput, Toolbar } from '@/components/admin/ui';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { LoadingBlock } from '@/components/ui/spinner';
import { formatDate, formatPhone } from '@/lib/format';
import { useList } from '@/lib/use-list';

interface CustomerRow {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { orders: number; repairJobs: number };
}

const params = () => ({});

function CustomersList() {
  const list = useList<CustomerRow>('/customers', params, 'all');
  return (
    <>
      <PageHeader title="Clients" />
      <div className="rounded-md border border-line bg-surface">
        <Toolbar>
          <SearchInput value={list.q} onChange={list.setQ} placeholder="Nom, téléphone ou e-mail" className="sm:max-w-md sm:flex-1" />
        </Toolbar>
        {list.error ? (
          <ErrorState message={list.error} onRetry={list.reload} />
        ) : !list.data ? (
          <LoadingBlock />
        ) : (
          <>
            <DataTable
              rows={list.data.items}
              href={(c) => `/clients/${c.id}`}
              columns={[
                { key: 'name', header: 'Client', cell: (c) => <span className="font-medium">{c.name}</span> },
                { key: 'phone', header: 'Téléphone', cell: (c) => <span className="num">{formatPhone(c.phone)}</span> },
                { key: 'repairs', header: 'Réparations', align: 'right', cell: (c) => c._count.repairJobs },
                { key: 'orders', header: 'Commandes', align: 'right', cell: (c) => c._count.orders },
                { key: 'since', header: 'Client depuis', cell: (c) => <span className="num">{formatDate(c.createdAt)}</span> },
              ]}
              empty={<EmptyState icon={Users} title="Aucun client" className="py-12" />}
            />
            <Pagination page={list.data.page} pageCount={list.data.pageCount} total={list.data.total} onPage={list.setPage} />
          </>
        )}
      </div>
    </>
  );
}

export default function CustomersPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <CustomersList />
    </Suspense>
  );
}
