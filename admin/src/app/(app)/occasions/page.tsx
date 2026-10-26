'use client';

import { ImageOff, Plus, Smartphone } from 'lucide-react';
import Image from 'next/image';
import { Suspense } from 'react';
import { useCan } from '@/components/admin/session';
import { DataTable, PageHeader, Pagination, SearchInput, Tabs, Toolbar } from '@/components/admin/ui';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { LoadingBlock } from '@/components/ui/spinner';
import { Status, Tag } from '@/components/ui/status';
import { cn } from '@/lib/cn';
import { formatAmount, formatDate } from '@/lib/format';
import { CONDITIONS, PHONE_STATUS } from '@/lib/labels';
import { useList } from '@/lib/use-list';

interface PhoneRow {
  id: string;
  reference: string;
  title: string;
  condition: string;
  brand: { name: string };
  gradeLabel: string;
  batteryHealth: number | null;
  status: string;
  salePrice: number;
  purchasePrice: number | null;
  estimatedMargin: number | null;
  acquiredAt: string;
  imeiLast4: string | null;
  isDemo: boolean;
  images: { url: string | null }[];
}

const params = (tab: string) => (tab === 'all' ? {} : { status: tab });

function PhonesList() {
  const can = useCan();
  const costs = can('costs.read');
  const list = useList<PhoneRow>('/used-phones', params, 'AVAILABLE');
  return (
    <>
      <PageHeader
        title="Téléphones"
        actions={
          can('usedPhones.write') && (
            <ButtonLink href="/occasions/nouveau">
              <Plus className="size-4" /> Enregistrer un téléphone
            </ButtonLink>
          )
        }
      />
      <Tabs
        value={list.tab}
        onChange={list.setTab}
        items={[
          { value: 'PENDING_CHECK', label: 'À vérifier' },
          { value: 'AVAILABLE', label: 'En vente' },
          { value: 'RESERVED', label: 'Réservés' },
          { value: 'SOLD', label: 'Vendus' },
          { value: 'RETURNED', label: 'Retournés' },
          { value: 'ARCHIVED', label: 'Archivés' },
          { value: 'all', label: 'Tous' },
        ]}
      />
      <div className="mt-4 rounded-md border border-line bg-surface">
        <Toolbar>
          <SearchInput value={list.q} onChange={list.setQ} placeholder="Référence, modèle, 4 derniers chiffres de l’IMEI" className="sm:max-w-md sm:flex-1" />
        </Toolbar>
        {list.error ? (
          <ErrorState message={list.error} onRetry={list.reload} />
        ) : !list.data ? (
          <LoadingBlock />
        ) : (
          <>
            <DataTable
              rows={list.data.items}
              href={(p) => `/occasions/${p.id}`}
              columns={[
                {
                  key: 'phone',
                  header: 'Téléphone',
                  cell: (p) => (
                    <span className="flex items-center gap-3">
                      <span className="relative hidden h-12 w-10 shrink-0 overflow-hidden rounded-xs bg-paper-2 md:block">
                        {p.images[0]?.url ? <Image src={p.images[0].url} alt="" fill sizes="40px" className="object-cover" /> : <ImageOff className="m-auto mt-4 size-4 text-faint" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium">
                          {p.brand.name} {p.title}
                        </span>
                        <span className="flex items-center gap-2 text-[12px] text-muted">
                          <span className="font-mono">{p.reference}</span>
                          {p.imeiLast4 && <span>IMEI ••{p.imeiLast4}</span>}
                          {p.isDemo && <Tag tone="warn">Démo</Tag>}
                        </span>
                      </span>
                    </span>
                  ),
                },
                { key: 'condition', header: 'Catégorie', cell: (p) => <Tag tone={p.condition === 'NEW' ? 'ok' : p.condition === 'IMPORTED' ? 'warn' : 'info'}>{CONDITIONS[p.condition]}</Tag> },
                { key: 'grade', header: 'État', cell: (p) => p.condition === 'NEW' ? <span className="text-muted">—</span> : <span className="whitespace-nowrap">{p.gradeLabel}{p.batteryHealth !== null && <span className="text-muted"> · {p.batteryHealth} %</span>}</span> },
                { key: 'status', header: 'Statut', cell: (p) => <Status tone={PHONE_STATUS[p.status].tone}>{PHONE_STATUS[p.status].label}</Status> },
                { key: 'acquired', header: 'Acquis le', cell: (p) => <span className="num whitespace-nowrap">{formatDate(p.acquiredAt)}</span> },
                { key: 'price', header: 'Prix (FCFA)', align: 'right', cell: (p) => formatAmount(p.salePrice) },
                ...(costs
                  ? [
                      { key: 'buy', header: 'Achat', align: 'right' as const, cell: (p: PhoneRow) => formatAmount(p.purchasePrice) },
                      { key: 'margin', header: 'Marge estimée', align: 'right' as const, cell: (p: PhoneRow) => <span className={cn((p.estimatedMargin ?? 0) < 0 && 'text-bad')}>{formatAmount(p.estimatedMargin)}</span> },
                    ]
                  : []),
              ]}
              empty={<EmptyState icon={Smartphone} title="Aucun téléphone" className="py-12">Aucun appareil dans cette vue.</EmptyState>}
            />
            <Pagination page={list.data.page} pageCount={list.data.pageCount} total={list.data.total} onPage={list.setPage} />
          </>
        )}
      </div>
    </>
  );
}

export default function UsedPhonesAdminPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <PhonesList />
    </Suspense>
  );
}
