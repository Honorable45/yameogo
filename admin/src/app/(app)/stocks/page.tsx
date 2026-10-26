'use client';

import { Boxes, ClipboardCheck } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useCan } from '@/components/admin/session';
import { StockStatus } from '@/components/admin/stock-status';
import { DataTable, Metric, PageHeader, Pagination, Panel, SearchInput, Tabs, Toolbar } from '@/components/admin/ui';
import { Button, ButtonLink } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { Field, FormError, Input, Select, Textarea } from '@/components/ui/field';
import { LoadingBlock } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage, qs } from '@/lib/api';
import type { AdminProduct } from '@/lib/admin-types';
import { cn } from '@/lib/cn';
import { formatAmount, formatDate, formatDateTime, formatPrice } from '@/lib/format';
import { MOVEMENT_TYPES } from '@/lib/labels';
import { useList } from '@/lib/use-list';
import { useDebounced, useResource } from '@/lib/use-resource';

interface Summary {
  stockValue: number | null;
  units: number;
  usedPhonesValue: number | null;
  usedPhonesInStock: number;
  alerts: {
    outOfStock: { id: string; name: string; sku: string; available: number; threshold: number }[];
    lowStock: { id: string; name: string; sku: string; available: number; threshold: number }[];
    pendingPurchases: { id: string; number: string; purchaseDate: string; total: number; supplier: { name: string } }[];
    discrepancies: { id: string; expected: number; counted: number; difference: number; product: { id: string; name: string; sku: string }; count: { id: string; createdAt: string } }[];
  };
}

function AdjustDialog({ product, onClose, onDone }: { product: AdminProduct | null; onClose: () => void; onDone: () => void }) {
  const { notify } = useToast();
  const [direction, setDirection] = useState<'in' | 'out'>('out');
  const [qty, setQty] = useState('1');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  if (!product) return null;
  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.post('/inventory/adjustments', { productId: product.id, delta: (direction === 'in' ? 1 : -1) * Number(qty), reason: reason.trim() });
      notify('Correction enregistrée.');
      onDone();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title="Corriger le stock"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={submit} loading={saving} disabled={!Number(qty) || reason.trim().length < 5}>
            Enregistrer la correction
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Sens">
          {(p) => (
            <Select {...p} value={direction} onChange={(e) => setDirection(e.target.value as 'in' | 'out')}>
              <option value="out">Retirer du stock (casse, perte, usage interne)</option>
              <option value="in">Ajouter au stock (article retrouvé)</option>
            </Select>
          )}
        </Field>
        <Field label="Quantité">{(p) => <Input {...p} type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} className="num" />}</Field>
        <Field label="Justification" className="sm:col-span-2" hint="Obligatoire. La correction est tracée et valorisée au coût moyen.">
          {(p) => <Textarea {...p} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />}
        </Field>
      </div>
      <p className="mt-3 text-[12.5px] text-muted">Pour une marchandise reçue d’un fournisseur, utilisez plutôt un approvisionnement (coût d’achat pris en compte).</p>
      <div className="mt-3">
        <FormError message={error} />
      </div>
    </Dialog>
  );
}

const stockParams = (tab: string) => (tab === 'low' || tab === 'out' ? { stock: tab } : {});

function StockTable() {
  const can = useCan();
  const list = useList<AdminProduct>('/products', stockParams, 'all');
  const [adjusting, setAdjusting] = useState<AdminProduct | null>(null);
  const costs = can('costs.read');
  return (
    <>
      <div className="mb-3 flex flex-wrap gap-2">
        {[
          ['all', 'Tous les articles'],
          ['low', 'À réapprovisionner'],
          ['out', 'Épuisés'],
        ].map(([v, l]) => (
          <button key={v} type="button" onClick={() => list.setTab(v)} className={cn('rounded-full border px-3 py-1 text-[13px]', list.tab === v ? 'border-ink bg-ink text-white' : 'border-line-2 bg-surface text-ink-2')}>
            {l}
          </button>
        ))}
      </div>
      <div className="rounded-md border border-line bg-surface">
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
              columns={[
                { key: 'name', header: 'Article', cell: (p) => <Link href={`/produits/${p.id}`} className="hover:underline"><span className="block font-medium">{p.name}</span><span className="font-mono text-[12px] text-muted">{p.sku}</span></Link> },
                { key: 'kind', header: 'Type', cell: (p) => (p.kind === 'PART' ? 'Pièce' : 'Accessoire') },
                { key: 'stock', header: 'En stock', align: 'right', cell: (p) => p.stockQuantity },
                { key: 'reserved', header: 'Réservé', align: 'right', cell: (p) => p.reservedQuantity || '—' },
                { key: 'available', header: 'Disponible', cell: (p) => <StockStatus p={p} /> },
                { key: 'threshold', header: 'Seuil', align: 'right', cell: (p) => p.lowStockThreshold },
                ...(costs ? [{ key: 'value', header: 'Valeur (FCFA)', align: 'right' as const, cell: (p: AdminProduct) => formatAmount(p.stockValue) }] : []),
                ...(can('stock.adjust')
                  ? [{ key: 'actions', header: '', align: 'right' as const, cell: (p: AdminProduct) => <button type="button" onClick={() => setAdjusting(p)} className="text-[13px] text-accent underline">Corriger</button> }]
                  : []),
              ]}
              empty={<EmptyState icon={Boxes} title="Aucun article" className="py-12">Rien à afficher dans cette vue.</EmptyState>}
            />
            <Pagination page={list.data.page} pageCount={list.data.pageCount} total={list.data.total} onPage={list.setPage} />
          </>
        )}
      </div>
      <AdjustDialog product={adjusting} onClose={() => setAdjusting(null)} onDone={list.reload} />
    </>
  );
}

interface Movement {
  id: string;
  type: string;
  quantity: number;
  unitCost: number | null;
  stockAfter: number;
  reason: string | null;
  createdAt: string;
  product: { id: string; name: string; sku: string };
  user: { name: string } | null;
}

function Movements({ productId }: { productId: string | null }) {
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const term = useDebounced(q, 300);
  const { data, error, reload } = useResource<{ items: Movement[]; page: number; pageCount: number; total: number }>(`/inventory/movements${qs({ q: term, type, page, pageSize: 30, productId })}`);
  return (
    <div className="rounded-md border border-line bg-surface">
      <Toolbar>
        <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Article" className="sm:max-w-sm sm:flex-1" />
        <Select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} className="sm:w-60" aria-label="Type de mouvement">
          <option value="">Tous les mouvements</option>
          {Object.entries(MOVEMENT_TYPES).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
      </Toolbar>
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data ? (
        <LoadingBlock />
      ) : (
        <>
          <DataTable
            rows={data.items}
            columns={[
              { key: 'date', header: 'Date', cell: (m) => <span className="num">{formatDateTime(m.createdAt)}</span> },
              { key: 'product', header: 'Article', cell: (m) => <Link href={`/produits/${m.product.id}`} className="hover:underline">{m.product.name}</Link> },
              { key: 'type', header: 'Mouvement', cell: (m) => <span>{MOVEMENT_TYPES[m.type]}{m.reason && <span className="block max-w-xs truncate text-[12px] text-muted">{m.reason}</span>}</span> },
              { key: 'qty', header: 'Quantité', align: 'right', cell: (m) => <span className={m.quantity > 0 ? 'text-ok' : undefined}>{m.quantity > 0 ? `+${m.quantity}` : `−${Math.abs(m.quantity)}`}</span> },
              { key: 'after', header: 'Stock après', align: 'right', cell: (m) => m.stockAfter },
              { key: 'cost', header: 'Coût unit.', align: 'right', cell: (m) => formatAmount(m.unitCost) },
              { key: 'user', header: 'Par', cell: (m) => m.user?.name ?? 'Système' },
            ]}
            empty={<EmptyState title="Aucun mouvement" className="py-12" />}
          />
          <Pagination page={data.page} pageCount={data.pageCount} total={data.total} onPage={setPage} />
        </>
      )}
    </div>
  );
}

function Alerts({ summary }: { summary: Summary }) {
  const a = summary.alerts;
  const block = (title: string, rows: { id: string; name: string; sku: string; available: number; threshold: number }[], tone: string) => (
    <Panel title={`${title} (${rows.length})`} bodyClassName="">
      {rows.length === 0 ? (
        <p className="px-5 py-5 text-[13.5px] text-muted">Aucun article.</p>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/produits/${r.id}`} className="flex items-center justify-between gap-3 px-5 py-2.5 text-[14px] hover:bg-paper/70">
                <span className="min-w-0">
                  <span className="block truncate">{r.name}</span>
                  <span className="font-mono text-[12px] text-muted">{r.sku}</span>
                </span>
                <span className={cn('num shrink-0', tone)}>
                  {r.available} / seuil {r.threshold}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {block('Épuisés', a.outOfStock, 'text-bad')}
      {block('Stock faible', a.lowStock, 'text-warn')}
      <Panel title={`Approvisionnements en attente (${a.pendingPurchases.length})`} bodyClassName="">
        {a.pendingPurchases.length === 0 ? (
          <p className="px-5 py-5 text-[13.5px] text-muted">Aucun brouillon en attente de validation.</p>
        ) : (
          <ul className="divide-y divide-line">
            {a.pendingPurchases.map((p) => (
              <li key={p.id}>
                <Link href={`/approvisionnements/${p.id}`} className="flex justify-between px-5 py-2.5 text-[14px] hover:bg-paper/70">
                  <span>
                    <span className="font-mono">{p.number}</span> · {p.supplier.name}
                  </span>
                  <span className="num">{formatPrice(p.total)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title={`Écarts d’inventaire — 30 jours (${a.discrepancies.length})`} bodyClassName="">
        {a.discrepancies.length === 0 ? (
          <p className="px-5 py-5 text-[13.5px] text-muted">Aucun écart constaté récemment.</p>
        ) : (
          <ul className="divide-y divide-line">
            {a.discrepancies.map((d) => (
              <li key={d.id} className="flex justify-between gap-3 px-5 py-2.5 text-[14px]">
                <span>
                  {d.product.name}
                  <span className="block text-[12px] text-muted">Inventaire du {formatDate(d.count.createdAt)}</span>
                </span>
                <span className={cn('num', d.difference < 0 ? 'text-bad' : 'text-ok')}>
                  {d.difference > 0 ? '+' : '−'}
                  {Math.abs(d.difference)} ({d.expected} → {d.counted})
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function StocksView() {
  const can = useCan();
  const search = useSearchParams();
  const [tab, setTab] = useState(search.get('onglet') === 'movements' ? 'movements' : 'stock');
  const summary = useResource<Summary>('/inventory/summary');
  const s = summary.data;
  const alertCount = s ? s.alerts.outOfStock.length + s.alerts.lowStock.length : null;

  return (
    <>
      <PageHeader
        title="Stocks"
        actions={
          can('stock.adjust') && (
            <ButtonLink href="/stocks/inventaire" variant="secondary">
              <ClipboardCheck className="size-4" /> Faire un inventaire
            </ButtonLink>
          )
        }
      />
      {s && (
        <section className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line lg:grid-cols-4">
          {s.stockValue !== null && (
            <div className="bg-surface px-5 py-4">
              <Metric label="Valeur du stock" value={formatPrice(s.stockValue)} note={`${s.units} unités · coût moyen pondéré`} />
            </div>
          )}
          {s.usedPhonesValue !== null && (
            <div className="bg-surface px-5 py-4">
              <Metric label="Téléphones d’occasion" value={formatPrice(s.usedPhonesValue)} note={`${s.usedPhonesInStock} appareils, au prix d’achat`} />
            </div>
          )}
          <div className="bg-surface px-5 py-4">
            <Metric label="Épuisés" value={String(s.alerts.outOfStock.length)} tone={s.alerts.outOfStock.length ? 'bad' : 'muted'} />
          </div>
          <div className="bg-surface px-5 py-4">
            <Metric label="Stock faible" value={String(s.alerts.lowStock.length)} tone="muted" />
          </div>
        </section>
      )}
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: 'stock', label: 'État du stock' },
          { value: 'alerts', label: 'Alertes', count: alertCount },
          { value: 'movements', label: 'Mouvements' },
        ]}
      />
      <div className="mt-4">
        {tab === 'stock' && <StockTable />}
        {tab === 'alerts' && (s ? <Alerts summary={s} /> : <LoadingBlock />)}
        {tab === 'movements' && <Movements productId={search.get('produit')} />}
      </div>
    </>
  );
}

export default function StocksPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <StocksView />
    </Suspense>
  );
}
