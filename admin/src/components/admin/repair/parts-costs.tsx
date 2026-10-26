'use client';

import { useEffect, useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import type { AdminProduct, RepairDetail } from '@/lib/admin-types';
import { cn } from '@/lib/cn';
import { formatDate, formatPrice } from '@/lib/format';
import { useDebounced } from '@/lib/use-resource';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, FormError, Input, MoneyInput, Textarea } from '@/components/ui/field';
import { Tag } from '@/components/ui/status';
import { useToast } from '@/components/ui/toast';
import { ConfirmDialog, Panel, SearchInput } from '../ui';
import { useCan } from '../session';

type Update = (r: RepairDetail) => void;
const closed = (s: string) => s === 'PICKED_UP' || s === 'CANCELLED';

function AddPartDialog({ repair, open, onClose, onUpdate }: { repair: RepairDetail; open: boolean; onClose: () => void; onUpdate: Update }) {
  const { notify } = useToast();
  const [source, setSource] = useState<'STOCK' | 'EXTERNAL'>('STOCK');
  const [q, setQ] = useState(repair.modelName);
  const [results, setResults] = useState<AdminProduct[]>([]);
  const [product, setProduct] = useState<AdminProduct | null>(null);
  const [label, setLabel] = useState('');
  const [qty, setQty] = useState('1');
  const [cost, setCost] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const term = useDebounced(q, 250);

  useEffect(() => {
    if (!open || source !== 'STOCK') return;
    api
      .get<{ items: AdminProduct[] }>(`/products?kind=PART&pageSize=8&q=${encodeURIComponent(term.trim())}`)
      .then((r) => setResults(r.items))
      .catch(() => setResults([]));
  }, [term, open, source]);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const body = source === 'STOCK' ? { source, productId: product?.id, quantity: Number(qty) } : { source, label: label.trim(), quantity: Number(qty), unitCost: Number(cost) };
      onUpdate(await api.post<RepairDetail>(`/repairs/${repair.id}/parts`, body));
      notify(source === 'STOCK' ? 'Pièce ajoutée et sortie du stock.' : 'Pièce ajoutée.');
      setProduct(null);
      setLabel('');
      setCost('');
      setQty('1');
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const valid = Number(qty) > 0 && (source === 'STOCK' ? Boolean(product) : label.trim().length > 1 && cost !== '');

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Ajouter une pièce"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={submit} loading={saving} disabled={!valid}>
            Ajouter
          </Button>
        </>
      }
    >
      <div role="radiogroup" className="mb-5 grid grid-cols-2 gap-2">
        {(['STOCK', 'EXTERNAL'] as const).map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={source === s}
            onClick={() => setSource(s)}
            className={cn('rounded-sm border px-3 py-2.5 text-left text-[14px]', source === s ? 'border-accent ring-1 ring-accent' : 'border-line-2')}
          >
            <span className="block font-medium">{s === 'STOCK' ? 'Depuis le stock' : 'Achetée pour ce dossier'}</span>
            <span className="block text-[12.5px] text-muted">{s === 'STOCK' ? 'Sortie de stock immédiate' : 'Hors stock, coût saisi'}</span>
          </button>
        ))}
      </div>

      {source === 'STOCK' ? (
        <div className="space-y-3">
          <SearchInput value={q} onChange={setQ} placeholder="Rechercher une pièce" />
          <ul className="max-h-64 divide-y divide-line overflow-y-auto rounded-sm border border-line">
            {results.length === 0 && <li className="px-3 py-4 text-center text-[13.5px] text-muted">Aucune pièce trouvée.</li>}
            {results.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  disabled={p.available <= 0}
                  onClick={() => setProduct(p)}
                  className={cn('flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-[14px] disabled:opacity-40', product?.id === p.id ? 'bg-accent-soft' : 'hover:bg-paper')}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{p.name}</span>
                    <span className="block font-mono text-[12px] text-muted">{p.sku}</span>
                  </span>
                  <span className={cn('num shrink-0 text-[13px]', p.available <= 0 ? 'text-bad' : 'text-ink-2')}>{p.available} en stock</span>
                </button>
              </li>
            ))}
          </ul>
          <Field label="Quantité">{(p) => <Input {...p} type="number" min={1} max={product?.available} value={qty} onChange={(e) => setQty(e.target.value)} className="num w-28" />}</Field>
          <p className="text-[12.5px] text-muted">Le coût est figé au coût moyen du stock au moment de l’ajout. Une pièce retirée plus tard retourne en stock à ce même coût.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
          <Field label="Désignation">{(p) => <Input {...p} value={label} onChange={(e) => setLabel(e.target.value)} maxLength={140} placeholder="Écran iPhone 11, fournisseur local" />}</Field>
          <Field label="Quantité">{(p) => <Input {...p} type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} className="num" />}</Field>
          <Field label="Coût d’achat unitaire" className="sm:col-span-2">
            {(p) => <MoneyInput {...p} value={cost} onChange={(e) => setCost(e.target.value)} />}
          </Field>
        </div>
      )}
      <div className="mt-4">
        <FormError message={error} />
      </div>
    </Dialog>
  );
}

export function PartsPanel({ repair, onUpdate }: { repair: RepairDetail; onUpdate: Update }) {
  const can = useCan();
  const { notify } = useToast();
  const [adding, setAdding] = useState(false);
  const [returning, setReturning] = useState<string | null>(null);
  const editable = can('repairs.write') && !closed(repair.status);

  const returnPart = async (note: string) => {
    if (!returning) return;
    try {
      onUpdate(await api.post<RepairDetail>(`/repairs/${repair.id}/parts/${returning}/return`, { note }));
      notify('Pièce retirée du dossier.');
      setReturning(null);
    } catch (err) {
      notify(errorMessage(err), 'bad');
    }
  };

  return (
    <Panel
      title="Pièces utilisées"
      bodyClassName=""
      actions={
        editable && (
          <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
            Ajouter une pièce
          </Button>
        )
      }
    >
      {repair.parts.length === 0 ? (
        <p className="px-4 py-4 text-[13.5px] text-muted sm:px-5">Aucune pièce enregistrée.</p>
      ) : (
        <ul className="divide-y divide-line">
          {repair.parts.map((p) => (
            <li key={p.id} className={cn('flex items-start justify-between gap-3 px-4 py-3 sm:px-5', p.status === 'RETURNED' && 'text-muted')}>
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-[14px]">
                  <span className={cn(p.status === 'RETURNED' && 'line-through')}>
                    {p.quantity} × {p.label}
                  </span>
                  <Tag tone={p.source === 'STOCK' ? 'info' : 'neutral'}>{p.source === 'STOCK' ? 'Stock' : 'Hors stock'}</Tag>
                  {p.status === 'RETURNED' && <Tag tone="neutral">Retirée</Tag>}
                </p>
                <p className="mt-0.5 text-[12.5px] text-muted">
                  {p.sku && <span className="font-mono">{p.sku} · </span>}
                  {formatDate(p.createdAt)} · {p.addedBy.name}
                  {p.returnNote && ` · ${p.returnNote}`}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                {p.totalCost !== null && <span className={cn('num text-[14px]', p.status === 'RETURNED' && 'line-through')}>{formatPrice(p.totalCost)}</span>}
                {can('repairs.write') && p.status === 'USED' && repair.status !== 'PICKED_UP' && (
                  <button type="button" onClick={() => setReturning(p.id)} className="text-[12px] text-muted underline hover:text-ink">
                    Retirer
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <AddPartDialog repair={repair} open={adding} onClose={() => setAdding(false)} onUpdate={onUpdate} />
      <ConfirmDialog open={returning !== null} onClose={() => setReturning(null)} onConfirm={returnPart} title="Retirer cette pièce ?" confirmLabel="Retirer" reason={{ label: 'Motif', placeholder: 'Pièce non posée, erreur de saisie…' }}>
        La ligne reste dans le dossier, barrée, et n’est plus comptée dans les coûts. Une pièce issue du stock y est remise.
      </ConfirmDialog>
    </Panel>
  );
}

/** Montant facturé et coûts directs saisis ; synthèse de marge pour le Responsable. */
export function CostsPanel({ repair, onUpdate }: { repair: RepairDetail; onUpdate: Update }) {
  const can = useCan();
  const { notify } = useToast();
  const editable = can('repairs.write') && !closed(repair.status);
  const [billed, setBilled] = useState(String(repair.billedAmount));
  const [consumables, setConsumables] = useState(String(repair.consumablesCost ?? 0));
  const [other, setOther] = useState(String(repair.otherDirectCosts ?? 0));
  const [note, setNote] = useState(repair.otherCostsNote ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setBilled(String(repair.billedAmount));
    setConsumables(String(repair.consumablesCost ?? 0));
    setOther(String(repair.otherDirectCosts ?? 0));
    setNote(repair.otherCostsNote ?? '');
  }, [repair.billedAmount, repair.consumablesCost, repair.otherDirectCosts, repair.otherCostsNote]);

  const dirty = billed !== String(repair.billedAmount) || consumables !== String(repair.consumablesCost ?? 0) || other !== String(repair.otherDirectCosts ?? 0) || note !== (repair.otherCostsNote ?? '');

  const save = async () => {
    setSaving(true);
    try {
      onUpdate(
        await api.patch<RepairDetail>(`/repairs/${repair.id}`, {
          billedAmount: Number(billed || 0),
          consumablesCost: Number(consumables || 0),
          otherDirectCosts: Number(other || 0),
          otherCostsNote: note.trim() || null,
        }),
      );
      notify('Montants enregistrés.');
    } catch (err) {
      notify(errorMessage(err), 'bad');
    } finally {
      setSaving(false);
    }
  };

  const f = repair.financials;
  return (
    <Panel title="Montants et coûts">
      {can('repairs.write') ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Montant facturé">{(p) => <MoneyInput {...p} value={billed} onChange={(e) => setBilled(e.target.value)} disabled={!editable} />}</Field>
          <Field label="Consommables">{(p) => <MoneyInput {...p} value={consumables} onChange={(e) => setConsumables(e.target.value)} disabled={!editable} />}</Field>
          <Field label="Autres coûts directs">{(p) => <MoneyInput {...p} value={other} onChange={(e) => setOther(e.target.value)} disabled={!editable} />}</Field>
          {(Number(other) > 0 || note) && (
            <Field label="Nature des autres coûts" optional className="sm:col-span-3">
              {(p) => <Textarea {...p} rows={2} value={note} onChange={(e) => setNote(e.target.value)} disabled={!editable} maxLength={300} placeholder="Déplacement chez le fournisseur, sous-traitance…" />}
            </Field>
          )}
          {editable && dirty && (
            <div className="sm:col-span-3">
              <Button size="sm" onClick={save} loading={saving}>
                Enregistrer les montants
              </Button>
            </div>
          )}
        </div>
      ) : (
        <p className="text-[14px]">
          Montant facturé : <span className="num font-semibold">{formatPrice(repair.billedAmount)}</span>
        </p>
      )}

      {f && (
        <dl className="mt-5 border-t border-line pt-4 text-[14px]">
          {[
            ['Montant facturé', f.billedAmount, ''],
            ['Pièces utilisées', -f.partsCost, ''],
            ['Consommables', -f.consumablesCost, ''],
            ['Autres coûts directs', -f.otherDirectCosts, ''],
          ].map(([label, value]) => (
            <div key={label as string} className="flex justify-between py-1">
              <dt className="text-muted">{label}</dt>
              <dd className="num">{(value as number) < 0 ? `− ${formatPrice(-(value as number))}` : formatPrice(value as number)}</dd>
            </div>
          ))}
          <div className="mt-2 flex items-baseline justify-between border-t border-line pt-3">
            <dt className="font-medium">Marge brute</dt>
            <dd className={cn('num text-[20px] font-semibold', f.grossMargin < 0 && 'text-bad')}>{formatPrice(f.grossMargin)}</dd>
          </div>
          <p className="mt-1 text-right text-[12px] text-muted">Coût direct total : {formatPrice(f.directCosts)}</p>
        </dl>
      )}
    </Panel>
  );
}
