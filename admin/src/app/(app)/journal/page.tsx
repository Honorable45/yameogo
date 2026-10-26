'use client';

import { Suspense } from 'react';
import { DataTable, PageHeader, Pagination, SearchInput, Toolbar } from '@/components/admin/ui';
import { ErrorState } from '@/components/ui/empty-state';
import { LoadingBlock } from '@/components/ui/spinner';
import { formatDateTime } from '@/lib/format';
import { useList } from '@/lib/use-list';

interface AuditRow {
  id: string;
  action: string;
  entity: string;
  summary: string;
  createdAt: string;
  user: { name: string } | null;
}

const params = () => ({});

function Journal() {
  const list = useList<AuditRow>('/audit', params, 'all');
  return (
    <>
      <PageHeader title="Journal des opérations" />
      <div className="rounded-md border border-line bg-surface">
        <Toolbar>
          <SearchInput value={list.q} onChange={list.setQ} placeholder="Rechercher" className="sm:max-w-md sm:flex-1" />
        </Toolbar>
        {list.error ? <ErrorState message={list.error} onRetry={list.reload} /> : !list.data ? <LoadingBlock /> : (
          <>
            <DataTable
              rows={list.data.items}
              columns={[
                { key: 'date', header: 'Date', cell: (a) => <span className="num whitespace-nowrap">{formatDateTime(a.createdAt)}</span> },
                { key: 'user', header: 'Utilisateur', cell: (a) => a.user?.name ?? 'Système / client' },
                { key: 'summary', header: 'Opération', cell: (a) => a.summary },
                { key: 'action', header: 'Code', cell: (a) => <span className="font-mono text-[12px] text-muted">{a.action}</span> },
              ]}
            />
            <Pagination page={list.data.page} pageCount={list.data.pageCount} total={list.data.total} onPage={list.setPage} />
          </>
        )}
      </div>
    </>
  );
}

export default function JournalPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <Journal />
    </Suspense>
  );
}
