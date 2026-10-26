'use client';

import { ArrowRight, Boxes, PackageCheck, Timer, Wrench, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { Metric, PageHeader, Panel } from '@/components/admin/ui';
import { useSession } from '@/components/admin/session';
import { ErrorState } from '@/components/ui/empty-state';
import { LoadingBlock } from '@/components/ui/spinner';
import { Status } from '@/components/ui/status';
import { cn } from '@/lib/cn';
import { formatDate, formatDateLong, formatPrice } from '@/lib/format';
import { REPAIR_STATUS } from '@/lib/labels';
import { useResource } from '@/lib/use-resource';

interface Overview {
  queue: Record<string, number | null>;
  upcoming: {
    id: string;
    number: string;
    status: string;
    brandName: string;
    modelName: string;
    dueAt: string | null;
    receivedAt: string;
    customer: { name: string };
    technician: { name: string } | null;
  }[];
  today: null | {
    totals: Record<string, number>;
    snapshot: { stockValue: number; usedPhonesValue: number; productsToRestock: number; unpaidRepairs: number; pendingRepairs: number; readyRepairs: number };
  };
}

const QUEUE: { key: string; label: string; href: string; icon: LucideIcon }[] = [
  { key: 'quotesPending', label: 'Devis en attente de réponse du client', href: '/reparations?onglet=QUOTE_PENDING', icon: Timer },
  { key: 'repairsLate', label: 'Réparations en retard', href: '/reparations?onglet=late', icon: Wrench },
  { key: 'repairsReady', label: 'Téléphones prêts à remettre', href: '/reparations?onglet=ready', icon: PackageCheck },
  { key: 'lowStock', label: 'Articles à réapprovisionner', href: '/stocks', icon: Boxes },
];

export default function OverviewPage() {
  const user = useSession();
  const { data, error, reload } = useResource<Overview>('/stats/overview');
  const firstName = user.name.split(' ')[0];

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <LoadingBlock />;
  const t = data.today?.totals;
    // Seules les tâches réellement en attente sont affichées.
  const queue = QUEUE.filter((q) => (data.queue[q.key] ?? 0) > 0);

  return (
    <>
      <PageHeader title={`Bonjour ${firstName}`} description={<span className="first-letter:uppercase">{formatDateLong(new Date())}</span>} />

      {t && (
        <section className="mb-6 rounded-md border border-line bg-surface" aria-label="Aujourd’hui">
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <h2 className="text-[14.5px] font-medium">Aujourd’hui</h2>
            <Link href="/statistiques" className="inline-flex items-center gap-1 text-[13.5px] text-accent hover:underline">
              Statistiques <ArrowRight className="size-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-y-6 px-5 py-5 lg:grid-cols-4 lg:divide-x lg:divide-line lg:px-0">
            <Metric className="lg:px-5" label="Chiffre d’affaires" value={formatPrice(t.revenue)} note={`${t.completedOrders} vente${t.completedOrders > 1 ? 's' : ''} · ${t.repairsCompleted} réparation${t.repairsCompleted > 1 ? 's' : ''}`} />
            <Metric className="lg:px-5" label="Encaissé" value={formatPrice(t.cashIn)} note={t.refunds ? `dont remboursements : ${formatPrice(t.refunds)}` : 'Paiements confirmés'} />
            <Metric className="lg:px-5" label="Marge brute" value={formatPrice(t.grossMargin)} note={`Coûts directs : ${formatPrice(t.directCosts)}`} tone={t.grossMargin < 0 ? 'bad' : undefined} />
            <Metric className="lg:px-5" label="Résultat estimé" value={formatPrice(t.estimatedResult)} note={`Dépenses : ${formatPrice(t.expenses)}`} tone={t.estimatedResult < 0 ? 'bad' : undefined} />
          </div>
        </section>
      )}

      <div className="grid gap-6 xl:grid-cols-12">
        <Panel title="À traiter" className="xl:col-span-5" bodyClassName="">
          {queue.length === 0 && <p className="px-5 py-10 text-center text-[14px] text-muted">Rien en attente.</p>}
          <ul className="divide-y divide-line">
            {queue.map((q) => {
              const count = data.queue[q.key] ?? 0;
              return (
                <li key={q.key}>
                  <Link href={q.href} className="group flex items-center gap-3 px-4 py-3 hover:bg-paper/70 sm:px-5">
                    <q.icon className={cn('size-4 shrink-0', count ? 'text-accent' : 'text-faint')} strokeWidth={1.75} />
                    <span className={cn('flex-1 text-[14px]', count ? 'text-ink' : 'text-muted')}>{q.label}</span>
                    <span className={cn('num min-w-6 text-right text-[15px]', count ? 'font-semibold text-ink' : 'text-faint')}>{count}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel
          title="Prochaines réparations"
          className="xl:col-span-7"
          bodyClassName=""
          actions={
            <Link href="/reparations" className="text-[13px] text-accent hover:underline">
              Toutes les réparations
            </Link>
          }
        >
          {data.upcoming.length === 0 ? (
            <p className="px-5 py-10 text-center text-[14px] text-muted">Aucune réparation en cours.</p>
          ) : (
            <ul className="divide-y divide-line">
              {data.upcoming.map((r) => {
                const late = r.dueAt && new Date(r.dueAt) < new Date();
                return (
                  <li key={r.id}>
                    <Link href={`/reparations/${r.id}`} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 px-4 py-3 hover:bg-paper/70 sm:grid-cols-[7.5rem_1fr_auto] sm:px-5">
                      <span className="font-mono text-[13px] text-ink-2">{r.number}</span>
                      <span className="col-start-1 row-start-2 min-w-0 sm:col-start-2 sm:row-start-1">
                        <span className="block truncate text-[14px] font-medium">
                          {r.brandName} {r.modelName}
                        </span>
                        <span className="block truncate text-[12.5px] text-muted">
                          {r.customer.name}
                          {r.technician ? ` · ${r.technician.name}` : ''}
                        </span>
                      </span>
                      <span className="row-span-2 flex flex-col items-end gap-1 text-right sm:row-span-1">
                        <Status tone={REPAIR_STATUS[r.status].tone}>{REPAIR_STATUS[r.status].label}</Status>
                        <span className={cn('num text-[12.5px]', late ? 'font-medium text-bad' : 'text-muted')}>{r.dueAt ? `Prévu le ${formatDate(r.dueAt)}` : `Reçu le ${formatDate(r.receivedAt)}`}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

    </>
  );
}
