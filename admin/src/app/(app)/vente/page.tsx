'use client';

import { Check, Minus, Plus, Printer, Smartphone, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CustomerPicker, type CustomerChoice } from '@/components/admin/customer-picker';
import { useCan } from '@/components/admin/session';
import { PageHeader, Panel, SearchInput } from '@/components/admin/ui';
import { Button } from '@/components/ui/button';
import { FormError, Input, MoneyInput, Select } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api';
import type { AdminProduct } from '@/lib/admin-types';
import { cn } from '@/lib/cn';
import { formatPrice } from '@/lib/format';
import { PAYMENT_METHODS } from '@/lib/labels';
import { useDebounced } from '@/lib/use-resource';
import { printSaleTicket, type TicketOrder } from '@/components/admin/receipts';

interface PhoneHit {
  id: string;
  reference: string;
  title: string;
  salePrice: number;
  status: string;
  brand: { name: string };
}

interface Line {
  key: string;
  productId?: string;
  usedPhoneId?: string;
  label: string;
  sku: string;
  catalogPrice: number;
  unitPrice: number;
  quantity: number;
  max: number;
}

interface Pay {
  method: string;
  amount: string;
  ref: string;
}

export default function CounterSalePage() {
  const can = useCan();
  const { notify } = useToast();
  const canPrice = can('catalog.write');
  const [q, setQ] = useState('');
  const term = useDebounced(q, 200);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [phones, setPhones] = useState<PhoneHit[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [customer, setCustomer] = useState<CustomerChoice>({ name: '', phone: '' });
  const [payments, setPayments] = useState<Pay[]>([{ method: 'CASH', amount: '', ref: '' }]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<{ id: string; number: string; total: number; amountPaid: number } | null>(null);

  useEffect(() => {
    const qq = encodeURIComponent(term.trim());
    api.get<{ items: AdminProduct[] }>(`/products?pageSize=10&q=${qq}`).then((r) => setProducts(r.items.filter((p) => p.kind === 'ACCESSORY' || p.salePrice > 0))).catch(() => setProducts([]));
    api.get<{ items: PhoneHit[] }>(`/used-phones?status=AVAILABLE&pageSize=6&q=${qq}`).then((r) => setPhones(r.items)).catch(() => setPhones([]));
  }, [term, done]);

  const total = lines.reduce((acc, l) => acc + l.unitPrice * l.quantity, 0);
  const paid = payments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

  useEffect(() => {
    // Le premier règlement suit le total tant qu'il n'y a qu'un seul moyen de paiement.
    setPayments((ps) => (ps.length === 1 ? [{ ...ps[0], amount: total ? String(total) : '' }] : ps));
  }, [total]);

  const addProduct = (p: AdminProduct) => {
    setLines((ls) => {
      const key = `p:${p.id}`;
      const existing = ls.find((l) => l.key === key);
      if (existing) return ls.map((l) => (l.key === key ? { ...l, quantity: Math.min(l.quantity + 1, l.max) } : l));
      return [...ls, { key, productId: p.id, label: p.name, sku: p.sku, catalogPrice: p.salePrice, unitPrice: p.salePrice, quantity: 1, max: p.available }];
    });
  };
  const addPhone = (p: PhoneHit) => {
    setLines((ls) => (ls.find((l) => l.key === `t:${p.id}`) ? ls : [...ls, { key: `t:${p.id}`, usedPhoneId: p.id, label: `${p.brand.name} ${p.title}`, sku: p.reference, catalogPrice: p.salePrice, unitPrice: p.salePrice, quantity: 1, max: 1 }]));
  };
  const setLine = (key: string, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const [printingTicket, setPrintingTicket] = useState(false);
  // Ticket de caisse : imprimé automatiquement à la fin de la vente, réimprimable depuis l'écran de confirmation.
  const printTicket = async (orderId: string) => {
    setPrintingTicket(true);
    try {
      await printSaleTicket(await api.get<TicketOrder>(`/orders/${orderId}`));
    } catch (err) {
      notify(`Ticket non imprimé : ${errorMessage(err)}`, 'bad');
    } finally {
      setPrintingTicket(false);
    }
  };

  const submit = async () => {
    setError(null);
    if (paid > total) return setError('Les règlements dépassent le total.');
    setSaving(true);
    try {
      const order = await api.post<{ id: string; number: string; total: number; amountPaid: number }>('/orders/counter-sale', {
        customerName: customer.name.trim() || undefined,
        customerPhone: customer.phone.trim() || undefined,
        items: lines.map((l) => ({
          productId: l.productId,
          usedPhoneId: l.usedPhoneId,
          quantity: l.quantity,
          unitPrice: canPrice && l.unitPrice !== l.catalogPrice ? l.unitPrice : undefined,
        })),
        payments: payments.filter((p) => Number(p.amount) > 0).map((p) => ({ method: p.method, amount: Number(p.amount), externalReference: p.ref.trim() || undefined })),
      });
      setDone(order);
      notify(`Vente ${order.number} enregistrée.`);
      void printTicket(order.id);
      setLines([]);
      setCustomer({ name: '', phone: '' });
      setPayments([{ method: 'CASH', amount: '', ref: '' }]);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    return (
      <div className="mx-auto max-w-lg py-10 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-ok-soft text-ok">
          <Check className="size-6" />
        </span>
        <h1 className="display mt-4 text-[30px]">Vente enregistrée</h1>
        <p className="mt-2 font-mono text-[15px]">{done.number}</p>
        <p className="num mt-4 text-[22px] font-semibold">{formatPrice(done.total)}</p>
        {done.amountPaid < done.total && <p className="mt-1 text-[14px] text-bad">Reste à encaisser : {formatPrice(done.total - done.amountPaid)}</p>}
        <div className="mt-8 flex justify-center gap-3">
          <Button variant="secondary" onClick={() => printTicket(done.id)} loading={printingTicket}>
            <Printer className="size-4" /> Imprimer le ticket
          </Button>
          <Button onClick={() => setDone(null)}>Nouvelle vente</Button>
          <Link href={`/commandes/${done.id}`} className="inline-flex h-10 items-center rounded-sm border border-line-2 bg-surface px-4 text-[14px] font-medium">
            Voir la vente
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHeader title="Nouvelle vente" />
      <div className="grid gap-6 lg:grid-cols-12">
        <Panel title="Articles" className="lg:col-span-6" bodyClassName="">
          <div className="border-b border-line p-3">
            <SearchInput value={q} onChange={setQ} placeholder="Nom, référence, modèle de téléphone…" />
          </div>
          <ul className="max-h-[62vh] divide-y divide-line overflow-y-auto">
            {phones.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => addPhone(p)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-paper">
                  <Smartphone className="size-4 shrink-0 text-muted" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium">
                      {p.brand.name} {p.title}
                    </span>
                    <span className="block font-mono text-[12px] text-muted">{p.reference} · occasion</span>
                  </span>
                  <span className="num text-[14px]">{formatPrice(p.salePrice)}</span>
                </button>
              </li>
            ))}
            {products.map((p) => (
              <li key={p.id}>
                <button type="button" disabled={p.available <= 0} onClick={() => addProduct(p)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-paper disabled:opacity-40">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium">{p.name}</span>
                    <span className="block text-[12px] text-muted">
                      <span className="font-mono">{p.sku}</span> · {p.available} disponible{p.available > 1 ? 's' : ''}
                      {p.kind === 'PART' && ' · pièce'}
                    </span>
                  </span>
                  <span className="num text-[14px]">{formatPrice(p.salePrice)}</span>
                </button>
              </li>
            ))}
            {!products.length && !phones.length && <li className="px-4 py-8 text-center text-[14px] text-muted">Aucun article trouvé.</li>}
          </ul>
        </Panel>

        <div className="space-y-6 lg:col-span-6">
          <Panel title="Ticket" bodyClassName="">
            {lines.length === 0 ? (
              <p className="px-5 py-8 text-center text-[14px] text-muted">Sélectionnez des articles dans la liste.</p>
            ) : (
              <ul className="divide-y divide-line">
                {lines.map((l) => (
                  <li key={l.key} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-2 px-4 py-3 sm:px-5">
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-medium">{l.label}</p>
                      <p className="font-mono text-[12px] text-muted">{l.sku}</p>
                    </div>
                    <button type="button" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} aria-label={`Retirer ${l.label}`} className="inline-flex size-8 items-center justify-center text-muted hover:text-bad">
                      <Trash2 className="size-4" />
                    </button>
                    <div className="col-span-2 flex items-center gap-3">
                      {l.max > 1 || l.productId ? (
                        <div className="inline-flex h-9 items-center rounded-sm border border-line-2">
                          <button type="button" aria-label="Moins" disabled={l.quantity <= 1} onClick={() => setLine(l.key, { quantity: l.quantity - 1 })} className="flex size-9 items-center justify-center disabled:opacity-30">
                            <Minus className="size-3.5" />
                          </button>
                          <span className="num w-7 text-center text-[14px]">{l.quantity}</span>
                          <button type="button" aria-label="Plus" disabled={l.quantity >= l.max} onClick={() => setLine(l.key, { quantity: l.quantity + 1 })} className="flex size-9 items-center justify-center disabled:opacity-30">
                            <Plus className="size-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[12.5px] text-muted">Exemplaire unique</span>
                      )}
                      <span className="text-[13px] text-muted">×</span>
                      {canPrice ? (
                        <MoneyInput value={String(l.unitPrice)} onChange={(e) => setLine(l.key, { unitPrice: Math.max(0, Number(e.target.value) || 0) })} aria-label="Prix unitaire" className={cn('h-9 w-36 sm:h-9', l.unitPrice !== l.catalogPrice && 'border-warn')} />
                      ) : (
                        <span className="num text-[14px]">{formatPrice(l.unitPrice)}</span>
                      )}
                      <span className="num ml-auto text-[14px] font-semibold">{formatPrice(l.unitPrice * l.quantity)}</span>
                    </div>
                    {l.unitPrice !== l.catalogPrice && <p className="col-span-2 text-[12px] text-warn">Prix modifié (catalogue : {formatPrice(l.catalogPrice)}) — tracé dans le journal.</p>}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex items-baseline justify-between border-t border-line px-5 py-4">
              <span className="font-medium">Total</span>
              <span className="num text-[24px] font-semibold">{formatPrice(total)}</span>
            </div>
          </Panel>

          <Panel title="Client" actions={<span className="text-[12px] text-muted">facultatif</span>}>
            <CustomerPicker value={customer} onChange={setCustomer} optional />
          </Panel>

          <Panel title="Règlement">
            <div className="space-y-3">
              {payments.map((p, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr] gap-2 sm:grid-cols-[10rem_1fr_1fr_auto]">
                  <Select value={p.method} onChange={(e) => setPayments((ps) => ps.map((x, j) => (j === i ? { ...x, method: e.target.value } : x)))} aria-label="Moyen de paiement">
                    {Object.entries(PAYMENT_METHODS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </Select>
                  <MoneyInput value={p.amount} onChange={(e) => setPayments((ps) => ps.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} aria-label="Montant" />
                  {p.method !== 'CASH' ? <Input value={p.ref} onChange={(e) => setPayments((ps) => ps.map((x, j) => (j === i ? { ...x, ref: e.target.value } : x)))} placeholder="Réf. transaction" className="font-mono" aria-label="Référence" /> : <span className="hidden sm:block" />}
                  {payments.length > 1 && (
                    <button type="button" onClick={() => setPayments((ps) => ps.filter((_, j) => j !== i))} className="text-[13px] text-muted underline">
                      Retirer
                    </button>
                  )}
                </div>
              ))}
              {payments.length < 3 && (
                <button type="button" onClick={() => setPayments((ps) => [...ps, { method: 'TMONEY', amount: String(Math.max(0, total - paid)), ref: '' }])} className="text-[13px] text-accent underline">
                  Ajouter un autre moyen de paiement
                </button>
              )}
              <div className="flex justify-between border-t border-line pt-3 text-[14px]">
                <span className="text-muted">Encaissé maintenant</span>
                <span className={cn('num font-medium', paid < total && 'text-warn')}>
                  {formatPrice(paid)}
                  {paid < total && total > 0 && ` · reste ${formatPrice(total - paid)}`}
                </span>
              </div>
              <FormError message={error} />
              <Button size="lg" className="w-full" disabled={!lines.length} loading={saving} onClick={submit}>
                Valider la vente
              </Button>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
