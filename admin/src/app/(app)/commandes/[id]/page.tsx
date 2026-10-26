'use client';

import { Printer } from 'lucide-react';
import Link from 'next/link';
import { use, useState } from 'react';
import { PaymentsPanel } from '@/components/admin/payments-panel';
import { useCan } from '@/components/admin/session';
import { ConfirmDialog, DetailList, PageHeader, Panel } from '@/components/admin/ui';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Checkbox, Field, FormError, Input, MoneyInput, Select, Textarea } from '@/components/ui/field';
import { ErrorState } from '@/components/ui/empty-state';
import { LoadingBlock } from '@/components/ui/spinner';
import { Status, Tag } from '@/components/ui/status';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api';
import type { PaymentRow } from '@/lib/admin-types';
import { cn } from '@/lib/cn';
import { formatDateTime, formatPhone, formatPrice } from '@/lib/format';
import { ORDER_STATUS, PAYMENT_METHODS, PAYMENT_PREFERENCE, SETTLEMENT } from '@/lib/labels';
import { useResource } from '@/lib/use-resource';
import { ReviewCodePanel } from '@/components/admin/review-code-panel';
import { printSaleTicket } from '@/components/admin/receipts';

interface OrderItem {
  id: string;
  productId: string | null;
  usedPhoneId: string | null;
  label: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  unitCost: number | null;
  returnedQuantity: number;
  grossMargin: number | null;
}

interface OrderDetail {
  id: string;
  number: string;
  channel: 'ONLINE' | 'IN_STORE';
  status: string;
  allowedTransitions: string[];
  customer: { id: string; name: string; phone: string } | null;
  customerName: string;
  customerPhone: string;
  fulfillment: 'PICKUP' | 'DELIVERY';
  deliveryAddress: string | null;
  paymentPreference: string;
  comment: string | null;
  subtotal: number;
  deliveryFee: number;
  total: number;
  amountPaid: number;
  paymentStatus: string;
  returnedAmount: number;
  balanceDue: number;
  grossMargin: number | null;
  createdAt: string;
  completedAt: string | null;
  cancelReason: string | null;
  createdBy: { name: string } | null;
  items: OrderItem[];
  payments: PaymentRow[];
  history: { id: string; fromStatus: string | null; toStatus: string; note: string | null; createdAt: string; user: { name: string } | null }[];
  returns: { id: string; orderItemId: string; quantity: number; amount: number; restocked: boolean; reason: string; createdAt: string; createdBy: { name: string } }[];
}

const NEXT_LABELS: Record<string, string> = {
  CONFIRMED: 'Confirmer la commande',
  PREPARING: 'En préparation',
  READY_FOR_PICKUP: 'Prête à être retirée',
  OUT_FOR_DELIVERY: 'Partie en livraison',
  COMPLETED: 'Remise au client',
  CANCELLED: 'Annuler la commande',
};

function ReturnDialog({ order, item, onClose, onDone }: { order: OrderDetail; item: OrderItem | null; onClose: () => void; onDone: (o: OrderDetail) => void }) {
  const [qty, setQty] = useState('1');
  const [restock, setRestock] = useState(true);
  const [reason, setReason] = useState('');
  const [refund, setRefund] = useState('');
  const [method, setMethod] = useState('CASH');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  if (!item) return null;
  const max = item.quantity - item.returnedQuantity;
  const value = item.unitPrice * (Number(qty) || 0);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      onDone(
        await api.post<OrderDetail>(`/orders/${order.id}/returns`, {
          itemId: item.id,
          quantity: Number(qty),
          restock: item.usedPhoneId ? true : restock,
          reason: reason.trim(),
          refund: Number(refund) > 0 ? { method, amount: Number(refund) } : undefined,
        }),
      );
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
      title="Enregistrer un retour"
      description={item.label}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={submit} loading={saving} disabled={reason.trim().length < 5 || !Number(qty)}>
            Enregistrer le retour
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {!item.usedPhoneId && (
          <Field label="Quantité retournée" hint={`Maximum : ${max}`}>
            {(p) => <Input {...p} type="number" min={1} max={max} value={qty} onChange={(e) => setQty(e.target.value)} className="num w-28" />}
          </Field>
        )}
        {item.usedPhoneId ? (
          <p className="text-[13.5px] text-muted">Le téléphone repasse au statut « Retourné » : vérifiez-le avant de le remettre en vente.</p>
        ) : (
          <Checkbox checked={restock} onChange={(e) => setRestock(e.target.checked)} label="Remettre en stock" />
        )}
        <Field label="Motif">{(p) => <Textarea {...p} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />}</Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Remboursement" optional hint={`Valeur retournée : ${formatPrice(value)} · encaissé : ${formatPrice(order.amountPaid)}`}>
            {(p) => <MoneyInput {...p} value={refund} onChange={(e) => setRefund(e.target.value)} />}
          </Field>
          <Field label="Moyen">
            {(p) => (
              <Select {...p} value={method} onChange={(e) => setMethod(e.target.value)}>
                {Object.entries(PAYMENT_METHODS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <FormError message={error} />
      </div>
    </Dialog>
  );
}

export default function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const can = useCan();
  const { notify } = useToast();
  const { data: order, error, reload, setData } = useResource<OrderDetail>(`/orders/${id}`);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [returning, setReturning] = useState<OrderItem | null>(null);
  const [loading, setLoading] = useState(false);

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!order) return <LoadingBlock />;

  const transition = async (status: string, note?: string) => {
    setLoading(true);
    try {
      setData(await api.post<OrderDetail>(`/orders/${order.id}/status`, { status, note }));
      notify('Commande mise à jour.');
      setConfirm(null);
    } catch (err) {
      notify(errorMessage(err), 'bad');
    } finally {
      setLoading(false);
    }
  };

  const st = ORDER_STATUS[order.status];
  const pay = SETTLEMENT[order.paymentStatus];

  return (
    <>
      <PageHeader
        back={{ href: '/commandes', label: 'Commandes' }}
        title={<span className="font-mono">{order.number}</span>}
        description={
          <span className="flex flex-wrap items-center gap-x-5 gap-y-1">
            <Status tone={st.tone}>{st.label}</Status>
            <Status tone={pay.tone}>{pay.label}</Status>
            <span>{order.channel === 'ONLINE' ? `En ligne · ${order.fulfillment === 'DELIVERY' ? 'livraison' : 'retrait en boutique'}` : 'Vente au comptoir'}</span>
            <span className="num">{formatDateTime(order.createdAt)}</span>
          </span>
        }
      >
        {order.status !== 'CANCELLED' && (
          <Button variant="secondary" onClick={() => printSaleTicket(order).catch((err) => notify(errorMessage(err), 'bad'))}>
            <Printer className="size-4" /> Ticket
          </Button>
        )}
        {can('orders.manage') && order.allowedTransitions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {order.allowedTransitions.map((t) => (
              <Button key={t} size="sm" variant={t === 'CANCELLED' ? 'danger' : t === order.allowedTransitions[0] ? 'primary' : 'secondary'} disabled={loading} onClick={() => (t === 'CANCELLED' || t === 'COMPLETED' ? setConfirm(t) : transition(t))}>
                {NEXT_LABELS[t] ?? ORDER_STATUS[t].label}
              </Button>
            ))}
          </div>
        )}
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          <Panel title="Articles" bodyClassName="">
            <ul className="divide-y divide-line">
              {order.items.map((i) => (
                <li key={i.id} className="flex items-start justify-between gap-4 px-4 py-3 sm:px-5">
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium">
                      {i.productId ? <Link href={`/produits/${i.productId}`} className="hover:underline">{i.label}</Link> : <Link href={`/occasions/${i.usedPhoneId}`} className="hover:underline">{i.label}</Link>}
                    </p>
                    <p className="text-[12.5px] text-muted">
                      <span className="font-mono">{i.sku}</span> · {i.quantity} × {formatPrice(i.unitPrice)}
                      {i.unitCost !== null && ` · coût ${formatPrice(i.unitCost)}`}
                      {i.returnedQuantity > 0 && <span className="text-bad"> · {i.returnedQuantity} retourné(s)</span>}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="num text-[14px] font-medium">{formatPrice(i.lineTotal)}</span>
                    {i.grossMargin !== null && <span className={cn('num text-[12px]', i.grossMargin < 0 ? 'text-bad' : 'text-muted')}>marge {formatPrice(i.grossMargin)}</span>}
                    {can('orders.returns') && order.status === 'COMPLETED' && i.returnedQuantity < i.quantity && (
                      <button type="button" onClick={() => setReturning(i)} className="text-[12px] text-muted underline hover:text-ink">
                        Retour
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <dl className="space-y-1 border-t border-line px-4 py-3 text-[14px] sm:px-5">
              <div className="flex justify-between">
                <dt className="text-muted">Sous-total</dt>
                <dd className="num">{formatPrice(order.subtotal)}</dd>
              </div>
              {order.deliveryFee > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted">Livraison</dt>
                  <dd className="num">{formatPrice(order.deliveryFee)}</dd>
                </div>
              )}
              {order.returnedAmount > 0 && (
                <div className="flex justify-between text-bad">
                  <dt>Retours</dt>
                  <dd className="num">− {formatPrice(order.returnedAmount)}</dd>
                </div>
              )}
              <div className="flex justify-between pt-1 text-[16px] font-semibold">
                <dt>Total</dt>
                <dd className="num">{formatPrice(order.total)}</dd>
              </div>
              {order.grossMargin !== null && (
                <div className="flex justify-between text-[13px] text-muted">
                  <dt>Marge brute de la vente</dt>
                  <dd className="num">{formatPrice(order.grossMargin)}</dd>
                </div>
              )}
            </dl>
          </Panel>

          <Panel title="Historique">
            <ol className="space-y-2.5 text-[13.5px]">
              {[...order.history].reverse().map((h) => (
                <li key={h.id} className="grid grid-cols-[8.5rem_1fr] gap-3">
                  <span className="num text-muted">{formatDateTime(h.createdAt)}</span>
                  <span>
                    {h.note && h.fromStatus === h.toStatus ? h.note : ORDER_STATUS[h.toStatus].label}
                    {h.note && h.fromStatus !== h.toStatus && <span className="text-muted"> — {h.note}</span>}
                    {h.user && <span className="text-muted"> · {h.user.name}</span>}
                  </span>
                </li>
              ))}
            </ol>
          </Panel>
        </div>

        <div className="space-y-6 lg:col-span-5">
          <Panel title="Client et réception">
            <DetailList
              items={[
                ['Client', order.customer ? <Link key="c" href={`/clients/${order.customer.id}`} className="font-medium hover:underline">{order.customerName}</Link> : order.customerName],
                ['Téléphone', order.customerPhone ? <a key="p" href={`tel:${order.customerPhone}`} className="num hover:underline">{formatPhone(order.customerPhone)}</a> : null],
                ['Réception', order.fulfillment === 'DELIVERY' ? 'Livraison' : 'Retrait en boutique'],
                ...(order.deliveryAddress ? [['Adresse', order.deliveryAddress] as [string, string]] : []),
                ['Paiement prévu', PAYMENT_PREFERENCE[order.paymentPreference]],
                ...(order.comment ? [['Commentaire', order.comment] as [string, string]] : []),
                ...(order.cancelReason ? [['Motif d’annulation', order.cancelReason] as [string, string]] : []),
                ...(order.createdBy ? [['Saisie par', order.createdBy.name] as [string, string]] : []),
              ]}
            />
          </Panel>
          <PaymentsPanel
            payments={order.payments}
            due={order.total - order.returnedAmount}
            paid={order.amountPaid}
            endpoint={`/orders/${order.id}/payments`}
            canRecord={can('orders.manage')}
            allowRefund={can('payments.cancel')}
            onChange={(o) => (o ? setData(o as OrderDetail) : void reload())}
            disabledReason={order.status === 'CANCELLED' ? 'Commande annulée.' : null}
          />
          {order.status !== 'CANCELLED' && <ReviewCodePanel kind="vente" id={order.id} customerPhone={order.customerPhone} />}
          {order.returns.length > 0 && (
            <Panel title="Retours">
              <ul className="space-y-2 text-[13.5px]">
                {order.returns.map((r) => (
                  <li key={r.id}>
                    {r.quantity} × {order.items.find((i) => i.id === r.orderItemId)?.label} — <span className="num">{formatPrice(r.amount)}</span> <Tag tone={r.restocked ? 'info' : 'bad'}>{r.restocked ? 'Remis en stock' : 'Perte'}</Tag>
                    <p className="text-[12px] text-muted">
                      {formatDateTime(r.createdAt)} · {r.createdBy.name} · {r.reason}
                    </p>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>

      <ConfirmDialog open={confirm === 'CANCELLED'} onClose={() => setConfirm(null)} onConfirm={(r) => transition('CANCELLED', r)} title="Annuler la commande ?" danger confirmLabel="Annuler la commande" reason={{ label: 'Motif', placeholder: 'Client injoignable, article indisponible…' }} loading={loading}>
        Les articles réservés redeviennent disponibles. Une commande déjà payée doit d’abord être remboursée.
      </ConfirmDialog>
      <ConfirmDialog open={confirm === 'COMPLETED'} onClose={() => setConfirm(null)} onConfirm={() => transition('COMPLETED')} title="Commande remise au client ?" confirmLabel="Confirmer la remise" loading={loading}>
        {order.paymentStatus !== 'PAID' ? <p className="text-bad">Il reste {formatPrice(order.total - order.amountPaid)} à encaisser. Encaissez le paiement avant la remise, ou confirmez une vente à crédit.</p> : <p>Les articles sortent du stock et la vente est comptée dans le chiffre d’affaires du jour.</p>}
      </ConfirmDialog>
      <ReturnDialog order={order} item={returning} onClose={() => setReturning(null)} onDone={(o) => { setData(o); notify('Retour enregistré.'); }} />
    </>
  );
}
