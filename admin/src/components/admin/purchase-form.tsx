'use client';

import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import type { AdminProduct, SupplierRow } from '@/lib/admin-types';
import { formatPrice, todayLocal } from '@/lib/format';
import { useDebounced } from '@/lib/use-resource';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, FormError, Input, MoneyInput, Select, Textarea } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { Panel, SearchInput } from './ui';

export interface PurchaseDraft {
  id: string;
  supplierId: string;
  invoiceNumber: string | null;
  purchaseDate: string;
  extraCosts: number;
  note: string | null;
  items: { productId: string; quantity: number; unitCost: number; product: { id: string; name: string; sku: string } }[];
}

interface Line {
  productId: string;
  name: string;
  sku: string;
  quantity: string;
  unitCost: string;
}

function SupplierDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (s: SupplierRow) => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Nouveau fournisseur"
      size="sm"
      footer={
        <Button
          disabled={name.trim().length < 2}
          onClick={async () => {
            try {
              onCreated(await api.post<SupplierRow>('/suppliers', { name: name.trim(), phone: phone.trim() || undefined }));
              setName('');
              setPhone('');
              onClose();
            } catch (err) {
              setError(errorMessage(err));
            }
          }}
        >
          Créer
        </Button>
      }
    >
      <div className="space-y-4">
        <Field label="Nom">{(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoFocus />}</Field>
        <Field label="Téléphone" optional>{(p) => <Input {...p} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />}</Field>
        <FormError message={error} />
      </div>
    </Dialog>
  );
}

export function PurchaseForm({ draft, suppliers: initialSuppliers }: { draft?: PurchaseDraft; suppliers: SupplierRow[] }) {
  const router = useRouter();
  const { notify } = useToast();
  const [suppliers, setSuppliers] = useState(initialSuppliers);
  const [supplierId, setSupplierId] = useState(draft?.supplierId ?? '');
  const [invoice, setInvoice] = useState(draft?.invoiceNumber ?? '');
  const [date, setDate] = useState(draft ? draft.purchaseDate.slice(0, 10) : todayLocal());
  const [extra, setExtra] = useState(String(draft?.extraCosts ?? 0));
  const [note, setNote] = useState(draft?.note ?? '');
  const [lines, setLines] = useState<Line[]>(draft?.items.map((i) => ({ productId: i.productId, name: i.product.name, sku: i.product.sku, quantity: String(i.quantity), unitCost: String(i.unitCost) })) ?? []);
  const [q, setQ] = useState('');
  const term = useDebounced(q, 200);
  const [results, setResults] = useState<AdminProduct[]>([]);
  const [newSupplier, setNewSupplier] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (term.trim().length < 2) return setResults([]);
    api.get<{ items: AdminProduct[] }>(`/products?pageSize=8&q=${encodeURIComponent(term.trim())}`).then((r) => setResults(r.items)).catch(() => setResults([]));
  }, [term]);

  const itemsTotal = lines.reduce((acc, l) => acc + (Number(l.quantity) || 0) * (Number(l.unitCost) || 0), 0);
  const total = itemsTotal + (Number(extra) || 0);

  const add = (p: AdminProduct) => {
    if (!lines.find((l) => l.productId === p.id)) setLines([...lines, { productId: p.id, name: p.name, sku: p.sku, quantity: '1', unitCost: p.averageCost ? String(p.averageCost) : '' }]);
    setQ('');
    setResults([]);
  };

  const save = async () => {
    setError(null);
    if (!supplierId) return setError('Choisissez un fournisseur.');
    if (!lines.length) return setError('Ajoutez au moins un article.');
    if (lines.some((l) => !Number(l.quantity) || l.unitCost === '')) return setError('Chaque ligne doit avoir une quantité et un prix unitaire.');
    setSaving(true);
    const body = {
      supplierId,
      invoiceNumber: invoice.trim() || undefined,
      purchaseDate: new Date(`${date}T12:00:00`).toISOString(),
      extraCosts: Number(extra) || 0,
      note: note.trim() || undefined,
      items: lines.map((l) => ({ productId: l.productId, quantity: Number(l.quantity), unitCost: Number(l.unitCost) })),
    };
    try {
      const saved = draft ? await api.put<{ id: string }>(`/purchases/${draft.id}`, body) : await api.post<{ id: string }>('/purchases', body);
      notify('Brouillon enregistré. Validez-le à la réception de la marchandise.');
      if (draft) router.refresh();
      router.push(`/approvisionnements/${saved.id}`);
      if (draft) setSaving(false);
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Panel title="Fournisseur et facture">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Fournisseur" hint={<button type="button" className="text-accent underline" onClick={() => setNewSupplier(true)}>Nouveau fournisseur</button>}>
            {(p) => (
              <Select {...p} value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                <option value="">Choisir…</option>
                {suppliers
                  .filter((s) => s.active || s.id === supplierId)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </Select>
            )}
          </Field>
          <Field label="Date d’achat">{(p) => <Input {...p} type="date" value={date} onChange={(e) => setDate(e.target.value)} max={todayLocal()} />}</Field>
          <Field label="N° de facture" optional>{(p) => <Input {...p} value={invoice} onChange={(e) => setInvoice(e.target.value)} maxLength={60} />}</Field>
          <Field label="Frais annexes" hint="Transport, dédouanement… répartis sur les lignes au prorata de leur valeur.">
            {(p) => <MoneyInput {...p} value={extra} onChange={(e) => setExtra(e.target.value)} />}
          </Field>
        </div>
      </Panel>

      <Panel title="Articles reçus" bodyClassName="">
        <div className="relative border-b border-line p-3">
          <SearchInput value={q} onChange={setQ} placeholder="Ajouter un article : nom ou référence" />
          {results.length > 0 && (
            <ul className="absolute inset-x-3 top-full z-20 mt-1 overflow-hidden rounded-md border border-line bg-surface shadow-pop">
              {results.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => add(p)} className="flex w-full justify-between gap-3 px-3 py-2.5 text-left text-[14px] hover:bg-paper">
                    <span>
                      {p.name} <span className="font-mono text-[12px] text-muted">{p.sku}</span>
                    </span>
                    <span className="text-[12.5px] text-muted">{p.kind === 'PART' ? 'Pièce' : 'Accessoire'}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {lines.length === 0 ? (
          <p className="px-5 py-6 text-center text-[13.5px] text-muted">Aucun article. Recherchez un article existant ; créez d’abord sa fiche s’il est nouveau.</p>
        ) : (
          <ul className="divide-y divide-line">
            {lines.map((l, i) => (
              <li key={l.productId} className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 sm:grid-cols-[1fr_6rem_9.5rem_7rem_auto] sm:px-5">
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-medium">{l.name}</span>
                  <span className="font-mono text-[12px] text-muted">{l.sku}</span>
                </span>
                <button type="button" onClick={() => setLines(lines.filter((_, j) => j !== i))} aria-label="Retirer" className="inline-flex size-9 items-center justify-center text-muted hover:text-bad sm:order-last">
                  <Trash2 className="size-4" />
                </button>
                <Input type="number" min={1} value={l.quantity} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))} aria-label="Quantité" className="num" />
                <MoneyInput value={l.unitCost} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, unitCost: e.target.value } : x)))} aria-label="Prix unitaire" />
                <span className="num text-right text-[14px]">{formatPrice((Number(l.quantity) || 0) * (Number(l.unitCost) || 0))}</span>
              </li>
            ))}
          </ul>
        )}
        <dl className="space-y-1 border-t border-line px-5 py-3 text-[14px]">
          <div className="flex justify-between">
            <dt className="text-muted">Articles</dt>
            <dd className="num">{formatPrice(itemsTotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Frais annexes</dt>
            <dd className="num">{formatPrice(Number(extra) || 0)}</dd>
          </div>
          <div className="flex justify-between pt-1 text-[16px] font-semibold">
            <dt>Total</dt>
            <dd className="num">{formatPrice(total)}</dd>
          </div>
        </dl>
      </Panel>

      <Field label="Note" optional>{(p) => <Textarea {...p} rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />}</Field>
      <FormError message={error} />
      <Button onClick={save} loading={saving}>
        Enregistrer le brouillon
      </Button>
      <SupplierDialog
        open={newSupplier}
        onClose={() => setNewSupplier(false)}
        onCreated={(s) => {
          setSuppliers([...suppliers, { ...s, balanceDue: 0, _count: { purchases: 0, products: 0 } }]);
          setSupplierId(s.id);
        }}
      />
    </div>
  );
}
