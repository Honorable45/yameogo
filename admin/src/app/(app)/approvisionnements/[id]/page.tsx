'use client';

import Link from 'next/link';
import { use, useState } from 'react';
import { PurchaseForm, type PurchaseDraft } from '@/components/admin/purchase-form';
import { ConfirmDialog, DetailList, PageHeader, Panel } from '@/components/admin/ui';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { ErrorState } from '@/components/ui/empty-state';
import { Field, FormError, Input, MoneyInput, Select } from '@/components/ui/field';
import { LoadingBlock } from '@/components/ui/spinner';
import { Status, Tag } from '@/components/ui/status';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api';
import type { SupplierRow } from '@/lib/admin-types';
import { cn } from '@/lib/cn';
import { formatDate, formatDateTime, formatPrice, todayLocal } from '@/lib/format';
import { PAYMENT_METHODS, PURCHASE_STATUS, SETTLEMENT } from '@/lib/labels';
import { useResource } from '@/lib/use-resource';

interface Purchase extends PurchaseDraft {
  number: string;
  status: string;
  itemsTotal: number;
  total: number;
  amountPaid: number;
  paymentStatus: string;
  validatedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  supplier: { id: string; name: string };
  createdBy: { name: string };
  items: (PurchaseDraft['items'][number] & { id: string; lineTotal: number; allocatedExtra: number; landedUnitCost: number })[];
  payments: { id: string; amount: number; method: string; paidAt: string; note: string | null; cancelledAt: string | null; cancelReason: string | null; recordedBy: { name: string } }[];
}

export default function PurchasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { notify } = useToast();
  const { data: p, error, reload, setData } = useResource<Purchase>(`/purchases/${id}`);
  const suppliers = useResource<SupplierRow[]>('/suppliers');
  const [confirm, setConfirm] = useState<'validate' | 'cancel' | null>(null);
  const [cancelPay, setCancelPay] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('CASH');
  const [paidAt, setPaidAt] = useState(todayLocal());
  const [payError, setPayError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!p || !suppliers.data) return <LoadingBlock />;
  const st = PURCHASE_STATUS[p.status];
  const remaining = p.total - p.amountPaid;

  const act = async (path: string, body: Record<string, unknown>, message: string) => {
    setBusy(true);
    try {
      setData(await api.post<Purchase>(`/purchases/${p.id}/${path}`, body));
      notify(message);
      setConfirm(null);
      setCancelPay(null);
    } catch (err) {
      notify(errorMessage(err), 'bad');
    } finally {
      setBusy(false);
    }
  };

  const addPayment = async () => {
    setPayError(null);
    try {
      setData(await api.post<Purchase>(`/purchases/${p.id}/payments`, { amount: Number(amount), method, paidAt: new Date(`${paidAt}T12:00:00`).toISOString() }));
      notify('Règlement enregistré.');
      setPaying(false);
    } catch (err) {
      setPayError(errorMessage(err));
    }
  };

  return (
    <>
      <PageHeader
        back={{ href: '/approvisionnements', label: 'Approvisionnements' }}
        title={
          <span>
            <span className="font-mono">{p.number}</span> · {p.supplier.name}
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-4">
            <Status tone={st.tone}>{st.label}</Status>
            {p.status !== 'CANCELLED' && <Status tone={SETTLEMENT[p.paymentStatus].tone}>{SETTLEMENT[p.paymentStatus].label}</Status>}
            <span>Achat du {formatDate(p.purchaseDate)}</span>
          </span>
        }
        actions={
          <>
            {p.status === 'DRAFT' && (
              <Button onClick={() => setConfirm('validate')}>Valider la réception</Button>
            )}
            {p.status !== 'CANCELLED' && (
              <Button variant="ghost" onClick={() => setConfirm('cancel')}>
                Annuler
              </Button>
            )}
          </>
        }
      />

      {p.status === 'DRAFT' ? (
        <div className="max-w-4xl">
          <PurchaseForm key={p.id + p.total} draft={p} suppliers={suppliers.data} />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-8">
            <Panel title="Articles" bodyClassName="">
              <div className="overflow-x-auto">
                <table className="w-full text-[14px]">
                  <thead>
                    <tr className="border-b border-line text-left text-[11.5px] uppercase tracking-[0.08em] text-muted">
                      <th className="h-10 pl-5 font-medium">Article</th>
                      <th className="px-3 text-right font-medium">Qté</th>
                      <th className="px-3 text-right font-medium">Prix unit.</th>
                      <th className="px-3 text-right font-medium">Frais répartis</th>
                      <th className="px-3 pr-5 text-right font-medium">Coût de revient unit.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.items.map((i) => (
                      <tr key={i.id} className="border-b border-line last:border-0">
                        <td className="py-3 pl-5">
                          <Link href={`/produits/${i.productId}`} className="hover:underline">
                            {i.product.name}
                          </Link>
                          <span className="block font-mono text-[12px] text-muted">{i.product.sku}</span>
                        </td>
                        <td className="num px-3 text-right">{i.quantity}</td>
                        <td className="num px-3 text-right">{formatPrice(i.unitCost)}</td>
                        <td className="num px-3 text-right">{formatPrice(i.allocatedExtra)}</td>
                        <td className="num px-3 pr-5 text-right font-medium">{p.status === 'VALIDATED' || p.validatedAt ? formatPrice(i.landedUnitCost) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <dl className="space-y-1 border-t border-line px-5 py-3 text-[14px]">
                <div className="flex justify-between"><dt className="text-muted">Articles</dt><dd className="num">{formatPrice(p.itemsTotal)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted">Frais annexes</dt><dd className="num">{formatPrice(p.extraCosts)}</dd></div>
                <div className="flex justify-between text-[16px] font-semibold"><dt>Total</dt><dd className="num">{formatPrice(p.total)}</dd></div>
              </dl>
            </Panel>
            <Panel title="Informations">
              <DetailList
                items={[
                  ['Facture', p.invoiceNumber],
                  ['Saisi par', `${p.createdBy.name}, le ${formatDateTime(p.createdAt)}`],
                  ['Validé le', p.validatedAt && formatDateTime(p.validatedAt)],
                  ...(p.cancelledAt ? [['Annulé le', `${formatDateTime(p.cancelledAt)} — ${p.cancelReason}`] as [string, string]] : []),
                  ['Note', p.note],
                ]}
              />
            </Panel>
          </div>
          <div className="lg:col-span-4">
            <Panel
              title="Règlements au fournisseur"
              actions={
                p.status === 'VALIDATED' &&
                remaining > 0 && (
                  <Button size="sm" variant="secondary" onClick={() => { setAmount(String(remaining)); setPaying(true); }}>
                    Enregistrer
                  </Button>
                )
              }
            >
              <p className="text-[14px]">
                Payé <span className="num font-semibold">{formatPrice(p.amountPaid)}</span> sur <span className="num">{formatPrice(p.total)}</span>
                {remaining > 0 && p.status !== 'CANCELLED' && <span className="block text-bad">Reste dû : {formatPrice(remaining)}</span>}
              </p>
              {p.payments.length > 0 && (
                <ul className="mt-3 divide-y divide-line border-t border-line text-[13.5px]">
                  {p.payments.map((pay) => (
                    <li key={pay.id} className={cn('flex justify-between gap-3 py-2', pay.cancelledAt && 'text-muted')}>
                      <span>
                        <span className={cn(pay.cancelledAt && 'line-through')}>{PAYMENT_METHODS[pay.method]}</span>
                        {pay.cancelledAt && <Tag className="ml-2">Annulé</Tag>}
                        <span className="block text-[12px] text-muted">{formatDate(pay.paidAt)} · {pay.recordedBy.name}{pay.cancelReason ? ` · ${pay.cancelReason}` : ''}</span>
                      </span>
                      <span className="flex flex-col items-end">
                        <span className={cn('num', pay.cancelledAt && 'line-through')}>{formatPrice(pay.amount)}</span>
                        {!pay.cancelledAt && <button type="button" className="text-[12px] text-muted underline" onClick={() => setCancelPay(pay.id)}>Annuler</button>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-[12px] text-muted">Un achat de stock n’est pas une dépense générale : son coût est compté au moment de la vente ou de l’utilisation des articles.</p>
            </Panel>
          </div>
        </div>
      )}

      <ConfirmDialog open={confirm === 'validate'} onClose={() => setConfirm(null)} onConfirm={() => act('validate', {}, 'Approvisionnement validé : stock et coûts moyens mis à jour.')} title="Valider la réception ?" confirmLabel="Valider" loading={busy}>
        Les quantités entrent en stock, valorisées au coût de revient (prix + part des frais annexes). Vérifiez les quantités reçues : l’opération ne se modifie plus, elle ne peut qu’être annulée.
      </ConfirmDialog>
      <ConfirmDialog open={confirm === 'cancel'} onClose={() => setConfirm(null)} onConfirm={(reason) => act('cancel', { reason }, 'Approvisionnement annulé.')} title="Annuler cet approvisionnement ?" danger confirmLabel="Annuler l’approvisionnement" reason={{ label: 'Motif' }} loading={busy}>
        {p.status === 'VALIDATED' ? 'Les quantités reçues sont retirées du stock (impossible si elles ont déjà été vendues). Annulez d’abord les règlements éventuels.' : 'Le brouillon est conservé avec le statut « Annulé ».'}
      </ConfirmDialog>
      <ConfirmDialog open={cancelPay !== null} onClose={() => setCancelPay(null)} onConfirm={(reason) => act(`payments/${cancelPay}/cancel`, { reason }, 'Règlement annulé.')} title="Annuler ce règlement ?" danger confirmLabel="Annuler le règlement" reason={{ label: 'Motif' }} loading={busy} />
      <Dialog open={paying} onClose={() => setPaying(false)} title="Règlement fournisseur" size="sm" footer={<Button onClick={addPayment} disabled={!Number(amount)}>Enregistrer</Button>}>
        <div className="space-y-4">
          <Field label="Montant" hint={`Reste dû : ${formatPrice(remaining)}`}>{(f) => <MoneyInput {...f} value={amount} onChange={(e) => setAmount(e.target.value)} />}</Field>
          <Field label="Moyen">
            {(f) => (
              <Select {...f} value={method} onChange={(e) => setMethod(e.target.value)}>
                {Object.entries(PAYMENT_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Date">{(f) => <Input {...f} type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} max={todayLocal()} />}</Field>
          <FormError message={payError} />
        </div>
      </Dialog>
    </>
  );
}
