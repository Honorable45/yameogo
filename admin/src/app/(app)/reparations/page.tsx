'use client';

import { Plus, Wrench } from 'lucide-react';
import { Suspense } from 'react';
import { DataTable, PageHeader, Pagination, SearchInput, Tabs, Toolbar } from '@/components/admin/ui';
import { useCan } from '@/components/admin/session';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { LoadingBlock } from '@/components/ui/spinner';
import { Status } from '@/components/ui/status';
import { cn } from '@/lib/cn';
import { formatAmount, formatDate } from '@/lib/format';
import { REPAIR_STATUS, SETTLEMENT } from '@/lib/labels';
import { useList } from '@/lib/use-list';

interface RepairRow {
  id: string;
  number: string;
  status: string;
  brandName: string;
  modelName: string;
  reportedIssue: string;
  receivedAt: string;
  dueAt: string | null;
  completedAt: string | null;
  deviceReturnedAt: string | null;
  billedAmount: number;
  amountPaid: number;
  paymentStatus: string;
  customer: { id: string; name: string; phone: string };
  technician: { id: string; name: string } | null;
  repairType: { name: string } | null;
}

const TABS = [
  { value: 'open', label: 'En cours' },
  { value: 'QUOTE_PENDING', label: 'Devis à confirmer' },
  { value: 'late', label: 'En retard' },
  { value: 'ready', label: 'Prêtes à remettre' },
  { value: 'mine', label: 'Mes dossiers' },
  { value: 'done', label: 'Terminées' },
  { value: 'CANCELLED', label: 'Annulées' },
  { value: 'all', label: 'Toutes' },
];

const params = (tab: string) => (['open', 'late', 'ready', 'mine', 'done'].includes(tab) ? { scope: tab } : tab === 'all' ? {} : { status: tab });

function RepairsList() {
  const can = useCan();
  const list = useList<RepairRow>('/repairs', params, 'open');

  return (
    <>
      <PageHeader
        title="Réparations"
        actions={
          can('repairs.write') && (
            <ButtonLink href="/reparations/nouvelle">
              <Plus className="size-4" /> Nouvelle réparation
            </ButtonLink>
          )
        }
      />
      <Tabs value={list.tab} onChange={list.setTab} items={TABS.filter((t) => t.value !== 'mine' || can('repairs.write'))} />
      <div className="mt-4 rounded-md border border-line bg-surface">
        <Toolbar>
          <SearchInput value={list.q} onChange={list.setQ} placeholder="N° de dossier, client, téléphone, modèle, 4 derniers chiffres IMEI" className="sm:max-w-md sm:flex-1" />
        </Toolbar>
        {list.error ? (
          <ErrorState message={list.error} onRetry={list.reload} />
        ) : !list.data ? (
          <LoadingBlock />
        ) : (
          <>
            <DataTable
              rows={list.data.items}
              href={(r) => `/reparations/${r.id}`}
              mobileTitle={(r) => (
                <span className="flex items-baseline justify-between gap-3">
                  <span>
                    {r.brandName} {r.modelName}
                  </span>
                  <span className="font-mono text-[12px] font-normal text-muted">{r.number}</span>
                </span>
              )}
              columns={[
                { key: 'number', header: 'Dossier', cell: (r) => <span className="font-mono text-[13px]">{r.number}</span>, hideOnMobile: true },
                {
                  key: 'device',
                  header: 'Appareil',
                  hideOnMobile: true,
                  cell: (r) => (
                    <span className="block max-w-[16rem]">
                      <span className="block truncate font-medium">
                        {r.brandName} {r.modelName}
                      </span>
                      <span className="block truncate text-[12.5px] text-muted">{r.repairType?.name ?? r.reportedIssue}</span>
                    </span>
                  ),
                },
                { key: 'customer', header: 'Client', cell: (r) => r.customer.name },
                { key: 'status', header: 'Statut', cell: (r) => <Status tone={REPAIR_STATUS[r.status].tone}>{REPAIR_STATUS[r.status].label}</Status> },
                { key: 'payment', header: 'Paiement', cell: (r) => (r.billedAmount ? <Status tone={SETTLEMENT[r.paymentStatus].tone}>{SETTLEMENT[r.paymentStatus].label}</Status> : <span className="text-faint">—</span>) },
                {
                  key: 'date',
                  header: 'Échéance',
                  cell: (r) => {
                    const late = r.dueAt && !r.completedAt && r.status !== 'CANCELLED' && new Date(r.dueAt) < new Date();
                    return <span className={cn('num', late && 'font-medium text-bad')}>{r.completedAt ? `Fini le ${formatDate(r.completedAt)}` : r.dueAt ? formatDate(r.dueAt) : '—'}</span>;
                  },
                },
                { key: 'amount', header: 'Montant (FCFA)', align: 'right', cell: (r) => (r.billedAmount ? formatAmount(r.billedAmount) : '—') },
              ]}
              empty={<EmptyState icon={Wrench} title="Aucun dossier" className="py-12">{list.q ? 'Aucun dossier ne correspond à cette recherche.' : 'Aucun dossier dans cette vue.'}</EmptyState>}
            />
            <Pagination page={list.data.page} pageCount={list.data.pageCount} total={list.data.total} onPage={list.setPage} />
          </>
        )}
      </div>
    </>
  );
}

export default function RepairsPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <RepairsList />
    </Suspense>
  );
}
