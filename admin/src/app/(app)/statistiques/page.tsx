'use client';

import { Download } from 'lucide-react';
import { useState } from 'react';
import { ACTIVITY_COLORS, MarginChart, RevenueChart, SeriesTable, type Point } from '@/components/admin/stats-charts';
import { PageHeader, Panel } from '@/components/admin/ui';
import { ErrorState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/field';
import { LoadingBlock } from '@/components/ui/spinner';
import { qs } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatDate, formatPrice, todayLocal } from '@/lib/format';
import { useResource } from '@/lib/use-resource';

type Totals = Record<string, number>;
interface Report {
  period: { preset: string; label: string; startDate: string; endDate: string; granularity: 'day' | 'month'; previous: { startDate: string; endDate: string } };
  totals: Totals;
  previous: Totals;
  series: Point[];
  topProducts: { productId: string; label: string; sku: string; quantity: number; revenue: number; grossMargin: number }[];
  topRepairs: { name: string; count: number; revenue: number; grossMargin: number }[];
  expensesByCategory: { category: string; label: string; amount: number }[];
  snapshot: { stockValue: number; usedPhonesValue: number; productsToRestock: number; unpaidRepairs: number; pendingRepairs: number; readyRepairs: number };
}

const PRESETS = [
  ['today', 'Aujourd’hui'],
  ['yesterday', 'Hier'],
  ['this_week', 'Cette semaine'],
  ['last_week', 'Semaine précédente'],
  ['this_month', 'Ce mois'],
  ['last_month', 'Mois précédent'],
  ['this_year', 'Cette année'],
  ['last_year', 'Année précédente'],
  ['custom', 'Personnalisée'],
] as const;

function Delta({ now, before, inverse }: { now: number; before: number; inverse?: boolean }) {
  if (!before && !now) return <span className="text-faint">—</span>;
  if (!before) return <span className="text-muted">— </span>;
  const pct = ((now - before) / Math.abs(before)) * 100;
  const good = inverse ? pct < 0 : pct > 0;
  return (
    <span className={cn('num', Math.abs(pct) < 0.5 ? 'text-muted' : good ? 'text-ok' : 'text-bad')}>
      {pct > 0 ? '+' : pct < 0 ? '−' : ''}
      {Math.abs(pct).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} %
    </span>
  );
}

export default function StatsPage() {
  const [preset, setPreset] = useState('this_month');
  const [from, setFrom] = useState(todayLocal().slice(0, 8) + '01');
  const [to, setTo] = useState(todayLocal());
  const query = qs({ period: preset, from: preset === 'custom' ? from : undefined, to: preset === 'custom' ? to : undefined });
  const { data: r, error, reload, loading } = useResource<Report>(`/stats/report${query}`);
  const [showTable, setShowTable] = useState(false);

  const t = r?.totals;
  const p = r?.previous;
  const KPIS: [string, string, boolean?, string?][] = [
    ['revenue', 'Chiffre d’affaires', false, 'Ventes et réparations terminées'],
    ['cashIn', 'Encaissé', false, 'Paiements confirmés − remboursements'],
    ['directCosts', 'Coûts directs', true, 'Coût des articles vendus et des réparations'],
    ['grossMargin', 'Marge brute', false, 'CA − coûts directs'],
    ['expenses', 'Dépenses générales', true, 'Charges de fonctionnement'],
    ['estimatedResult', 'Résultat estimé', false, 'Marge brute − dépenses générales'],
  ];

  const activities = t
    ? [
        { key: 'accessories', label: 'Accessoires', revenue: t.revenueAccessories, cost: t.costAccessories },
        { key: 'phones', label: 'Téléphones d’occasion', revenue: t.revenuePhones, cost: t.costPhones },
        { key: 'repairs', label: 'Réparations', revenue: t.revenueRepairs, cost: t.costRepairs },
      ]
    : [];

  return (
    <>
      <PageHeader
        title="Statistiques"
        actions={
          <div className="flex flex-wrap gap-2">
            {(['summary', 'sales', 'repairs', 'expenses'] as const).map((type) => (
              <a key={type} href={`/api/stats/export${qs({ type, period: preset, from: preset === 'custom' ? from : undefined, to: preset === 'custom' ? to : undefined })}`} className="inline-flex h-9 items-center gap-1.5 rounded-sm border border-line-2 bg-surface px-3 text-[13px] font-medium hover:border-ink-2">
                <Download className="size-3.5" />
                {{ summary: 'Synthèse', sales: 'Ventes', repairs: 'Réparations', expenses: 'Dépenses' }[type]} CSV
              </a>
            ))}
          </div>
        }
      />

      <div className="sticky top-16 z-10 -mx-4 mb-6 border-b border-line bg-paper/95 px-4 py-3 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="scrollbar-none flex gap-1.5 overflow-x-auto" role="radiogroup" aria-label="Période">
          {PRESETS.map(([v, l]) => (
            <button key={v} type="button" role="radio" aria-checked={preset === v} onClick={() => setPreset(v)} className={cn('h-8 shrink-0 rounded-full border px-3 text-[13px]', preset === v ? 'border-ink bg-ink text-white' : 'border-line-2 bg-surface text-ink-2 hover:border-ink-2')}>
              {l}
            </button>
          ))}
        </div>
        {preset === 'custom' && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[13.5px]">
            <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} aria-label="Du" className="h-9 w-44 sm:h-9" />
            <span className="text-muted">au</span>
            <Input type="date" value={to} min={from} max={todayLocal()} onChange={(e) => setTo(e.target.value)} aria-label="Au" className="h-9 w-44 sm:h-9" />
          </div>
        )}
        {r && (
          <p className="mt-2 text-[12.5px] text-muted">
            Du {formatDate(r.period.startDate)} au {formatDate(r.period.endDate)} · comparé au {formatDate(r.period.previous.startDate)} – {formatDate(r.period.previous.endDate)}
            {loading && ' · mise à jour…'}
          </p>
        )}
      </div>

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !r || !t || !p ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <section className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line md:grid-cols-3 xl:grid-cols-6" aria-label="Indicateurs">
            {KPIS.map(([key, label, inverse, note]) => (
              <div key={key} className="bg-surface px-4 py-4 sm:px-5">
                <p className="text-[12.5px] text-muted">{label}</p>
                <p className={cn('num mt-1 text-[22px] font-semibold tracking-tight', key === 'estimatedResult' && t[key] < 0 && 'text-bad')}>{formatPrice(t[key])}</p>
                <p className="mt-1 flex items-center gap-1.5 whitespace-nowrap text-[12px] text-muted">
                  <Delta now={t[key]} before={p[key]} inverse={inverse} /> <span>vs période préc.</span>
                </p>
                <p className="mt-1.5 hidden text-[11.5px] leading-snug text-faint sm:block">{note}</p>
              </div>
            ))}
          </section>

          <div className="grid gap-6 xl:grid-cols-12">
            <Panel title="Chiffre d’affaires par activité" className="xl:col-span-7" actions={<button type="button" onClick={() => setShowTable((v) => !v)} className="text-[12.5px] text-accent underline">{showTable ? 'Masquer les données' : 'Voir les données'}</button>}>
              <RevenueChart data={r.series} />
            </Panel>
            <Panel title="Marge brute et dépenses" className="xl:col-span-5">
              <MarginChart data={r.series} />
            </Panel>
          </div>
          {showTable && (
            <Panel title="Données par période">
              <SeriesTable data={r.series} />
            </Panel>
          )}

          <Panel title="Résultats par activité" bodyClassName="">
            <div className="overflow-x-auto">
              <table className="w-full text-[14px]">
                <thead>
                  <tr className="border-b border-line text-left text-[11.5px] uppercase tracking-[0.08em] text-muted">
                    <th className="h-10 pl-5 font-medium">Activité</th>
                    <th className="px-3 text-right font-medium">Chiffre d’affaires</th>
                    <th className="px-3 text-right font-medium">Coûts directs</th>
                    <th className="px-3 text-right font-medium">Marge brute</th>
                    <th className="px-3 pr-5 text-right font-medium">Taux de marge</th>
                  </tr>
                </thead>
                <tbody>
                  {activities.map((a) => (
                    <tr key={a.key} className="border-b border-line">
                      <td className="py-3 pl-5">
                        <span className="flex items-center gap-2">
                          <span className="size-2.5 rounded-xs" style={{ background: ACTIVITY_COLORS[a.key as keyof typeof ACTIVITY_COLORS] }} aria-hidden="true" />
                          {a.label}
                        </span>
                      </td>
                      <td className="num px-3 text-right">{formatPrice(a.revenue)}</td>
                      <td className="num px-3 text-right">{formatPrice(a.cost)}</td>
                      <td className={cn('num px-3 text-right font-medium', a.revenue - a.cost < 0 && 'text-bad')}>{formatPrice(a.revenue - a.cost)}</td>
                      <td className="num px-3 pr-5 text-right">{a.revenue ? `${Math.round(((a.revenue - a.cost) / a.revenue) * 100)} %` : '—'}</td>
                    </tr>
                  ))}
                  {t.revenueDelivery > 0 && (
                    <tr className="border-b border-line">
                      <td className="py-3 pl-5 text-ink-2">Frais de livraison</td>
                      <td className="num px-3 text-right">{formatPrice(t.revenueDelivery)}</td>
                      <td className="num px-3 text-right">—</td>
                      <td className="num px-3 text-right">{formatPrice(t.revenueDelivery)}</td>
                      <td className="px-3 pr-5" />
                    </tr>
                  )}
                  <tr className="font-semibold">
                    <td className="py-3 pl-5">Total</td>
                    <td className="num px-3 text-right">{formatPrice(t.revenue)}</td>
                    <td className="num px-3 text-right">{formatPrice(t.directCosts)}</td>
                    <td className="num px-3 text-right">{formatPrice(t.grossMargin)}</td>
                    <td className="num px-3 pr-5 text-right">{t.revenue ? `${Math.round((t.grossMargin / t.revenue) * 100)} %` : '—'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="border-t border-line px-5 py-3 text-[12.5px] text-muted">
              {t.completedOrders} vente(s) terminée(s) · {t.repairsCompleted} réparation(s) terminée(s) · {t.repairsReceived} téléphone(s) reçu(s) en atelier
              {t.returns > 0 && ` · retours déduits : ${formatPrice(t.returns)}`}
              {t.refunds > 0 && ` · remboursements : ${formatPrice(t.refunds)}`}
            </p>
          </Panel>

          <div className="grid gap-6 lg:grid-cols-3">
            <Panel title="Articles les plus vendus" bodyClassName="">
              {r.topProducts.length === 0 ? <p className="px-5 py-5 text-[13.5px] text-muted">Aucune vente sur la période.</p> : (
                <ol className="divide-y divide-line">
                  {r.topProducts.map((x, i) => (
                    <li key={x.productId} className="flex items-start gap-3 px-5 py-2.5 text-[13.5px]">
                      <span className="num w-4 text-faint">{i + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{x.label}</span>
                        <span className="text-[12px] text-muted">{x.quantity} vendu(s) · marge {formatPrice(x.grossMargin)}</span>
                      </span>
                      <span className="num">{formatPrice(x.revenue)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </Panel>
            <Panel title="Réparations les plus fréquentes" bodyClassName="">
              {r.topRepairs.length === 0 ? <p className="px-5 py-5 text-[13.5px] text-muted">Aucune réparation terminée.</p> : (
                <ol className="divide-y divide-line">
                  {r.topRepairs.map((x, i) => (
                    <li key={x.name} className="flex items-start gap-3 px-5 py-2.5 text-[13.5px]">
                      <span className="num w-4 text-faint">{i + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{x.name}</span>
                        <span className="text-[12px] text-muted">{x.count} réparation(s) · marge {formatPrice(x.grossMargin)}</span>
                      </span>
                      <span className="num">{formatPrice(x.revenue)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </Panel>
            <Panel title="Dépenses par catégorie" bodyClassName="">
              {r.expensesByCategory.length === 0 ? <p className="px-5 py-5 text-[13.5px] text-muted">Aucune dépense sur la période.</p> : (
                <ul className="divide-y divide-line">
                  {r.expensesByCategory.map((x) => (
                    <li key={x.category} className="px-5 py-2.5 text-[13.5px]">
                      <div className="flex justify-between">
                        <span>{x.label}</span>
                        <span className="num">{formatPrice(x.amount)}</span>
                      </div>
                      <div className="mt-1.5 h-1 bg-paper-2" aria-hidden="true">
                        <div className="h-1 bg-ink-2" style={{ width: `${(x.amount / t.expenses) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          <section className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line lg:grid-cols-4" aria-label="Situation actuelle">
            {[
              ['Valeur du stock', formatPrice(r.snapshot.stockValue)],
              ['Téléphones d’occasion en stock', formatPrice(r.snapshot.usedPhonesValue)],
              ['Réparations non soldées', formatPrice(r.snapshot.unpaidRepairs)],
              ['Réparations en cours', String(r.snapshot.pendingRepairs)],
            ].map(([label, value]) => (
              <div key={label} className="bg-surface px-5 py-4">
                <p className="text-[12.5px] text-muted">{label}</p>
                <p className="num mt-1 text-[20px] font-semibold">{value}</p>
                <p className="text-[11.5px] text-faint">Situation à cet instant</p>
              </div>
            ))}
          </section>
        </div>
      )}
    </>
  );
}
