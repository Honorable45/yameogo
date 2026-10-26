'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { PageHeader, Panel, SearchInput, Tabs } from '@/components/admin/ui';
import { Button } from '@/components/ui/button';
import { Field, FormError, Input } from '@/components/ui/field';
import { LoadingBlock } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api';
import type { AdminProduct } from '@/lib/admin-types';
import { cn } from '@/lib/cn';
import { formatDateTime } from '@/lib/format';
import { useResource } from '@/lib/use-resource';

interface CountResult {
  id: string;
  createdAt: string;
  lines: { id: string; expected: number; counted: number; difference: number; product: { id: string; name: string; sku: string } }[];
}

interface CountRow {
  id: string;
  note: string | null;
  createdAt: string;
  createdBy: { name: string };
  _count: { lines: number };
  lines: { id: string }[];
}

/** Charge toutes les pages d'articles actifs (inventaire complet). */
async function loadAllProducts() {
  const all: AdminProduct[] = [];
  for (let page = 1; page < 50; page++) {
    const res = await api.get<{ items: AdminProduct[]; pageCount: number }>(`/products?pageSize=100&page=${page}&sort=name&dir=asc`);
    all.push(...res.items);
    if (page >= res.pageCount) break;
  }
  return all;
}

export default function InventoryCountPage() {
  const { notify } = useToast();
  const [products, setProducts] = useState<AdminProduct[] | null>(null);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [kind, setKind] = useState<'ALL' | 'ACCESSORY' | 'PART'>('ALL');
  const [q, setQ] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<CountResult | null>(null);
  const history = useResource<CountRow[]>('/inventory/counts');

  useEffect(() => {
    loadAllProducts().then(setProducts).catch((err) => setError(errorMessage(err)));
  }, []);

  const visible = useMemo(
    () => (products ?? []).filter((p) => (kind === 'ALL' || p.kind === kind) && (!q || `${p.name} ${p.sku}`.toLowerCase().includes(q.toLowerCase()))),
    [products, kind, q],
  );
  const entered = Object.entries(counts).filter(([, v]) => v !== '');

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await api.post<CountResult>('/inventory/counts', { note: note.trim() || undefined, lines: entered.map(([productId, v]) => ({ productId, counted: Number(v) })) });
      setResult(res);
      setCounts({});
      history.reload();
      notify('Inventaire enregistré.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (result) {
    const diffs = result.lines.filter((l) => l.difference !== 0);
    return (
      <>
        <PageHeader title="Inventaire enregistré" back={{ href: '/stocks', label: 'Stocks' }} />
        <Panel title={diffs.length ? `${diffs.length} écart(s) corrigé(s)` : 'Aucun écart'} bodyClassName="">
          {diffs.length === 0 ? (
            <p className="px-5 py-5 text-[14px] text-muted">Le stock compté correspond au stock enregistré.</p>
          ) : (
            <ul className="divide-y divide-line">
              {diffs.map((l) => (
                <li key={l.id} className="flex justify-between px-5 py-2.5 text-[14px]">
                  <span>{l.product.name}</span>
                  <span className={cn('num', l.difference < 0 ? 'text-bad' : 'text-ok')}>
                    {l.expected} → {l.counted} ({l.difference > 0 ? '+' : ''}
                    {l.difference})
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <div className="mt-4 flex gap-2">
          <Button onClick={() => setResult(null)}>Nouvel inventaire</Button>
          <Link href="/stocks?onglet=movements" className="inline-flex h-10 items-center px-3 text-[14px] text-accent underline">
            Voir les mouvements
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Inventaire" back={{ href: '/stocks', label: 'Stocks' }} />
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <Tabs value={kind} onChange={setKind} items={[{ value: 'ALL', label: 'Tous' }, { value: 'ACCESSORY', label: 'Accessoires' }, { value: 'PART', label: 'Pièces' }]} />
          <div className="mt-3">
            <SearchInput value={q} onChange={setQ} placeholder="Filtrer" />
          </div>
          {!products ? (
            <LoadingBlock />
          ) : (
            <div className="mt-3 rounded-md border border-line bg-surface">
              <ul className="divide-y divide-line">
                {visible.map((p) => {
                  const v = counts[p.id] ?? '';
                  const diff = v === '' ? null : Number(v) - p.stockQuantity;
                  return (
                    <li key={p.id} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px]">{p.name}</p>
                        <p className="text-[12px] text-muted">
                          <span className="font-mono">{p.sku}</span> · enregistré : <span className="num">{p.stockQuantity}</span>
                        </p>
                      </div>
                      {diff !== null && diff !== 0 && <span className={cn('num text-[13px]', diff < 0 ? 'text-bad' : 'text-ok')}>{diff > 0 ? `+${diff}` : diff}</span>}
                      <Input type="number" min={0} inputMode="numeric" value={v} onChange={(e) => setCounts({ ...counts, [p.id]: e.target.value })} aria-label={`Quantité comptée — ${p.name}`} className="num w-24" placeholder="—" />
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
        <div className="space-y-6 lg:col-span-4">
          <Panel title="Validation">
            <p className="text-[14px]">
              <span className="num font-semibold">{entered.length}</span> article(s) compté(s)
            </p>
            <Field label="Note" optional className="mt-4">
              {(p) => <Input {...p} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Inventaire mensuel, rayon câbles…" />}
            </Field>
            <div className="mt-4">
              <FormError message={error} />
            </div>
            <Button className="mt-4 w-full" disabled={!entered.length} loading={saving} onClick={submit}>
              Valider l’inventaire
            </Button>
          </Panel>
          <Panel title="Inventaires précédents" bodyClassName="">
            {!history.data?.length ? (
              <p className="px-5 py-4 text-[13.5px] text-muted">Aucun inventaire enregistré.</p>
            ) : (
              <ul className="divide-y divide-line">
                {history.data.map((c) => (
                  <li key={c.id} className="px-5 py-2.5 text-[13.5px]">
                    <p>
                      {formatDateTime(c.createdAt)} · {c.createdBy.name}
                    </p>
                    <p className="text-[12px] text-muted">
                      {c._count.lines} article(s), {c.lines.length} écart(s){c.note ? ` · ${c.note}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
