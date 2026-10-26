'use client';

import { useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import type { PaymentRow } from '@/lib/admin-types';
import { cn } from '@/lib/cn';
import { formatDateTime, formatPrice } from '@/lib/format';
import { PAYMENT_METHODS } from '@/lib/labels';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, FormError, Input, MoneyInput, Select } from '@/components/ui/field';
import { Tag } from '@/components/ui/status';
import { useToast } from '@/components/ui/toast';
import { ConfirmDialog, Panel } from './ui';
import { useCan } from './session';

/**
 * Paiements d'une commande ou d'une réparation.
 * Un paiement saisi ici est considéré comme confirmé : il ne doit l'être qu'après réception effective
 * des fonds (espèces reçues, transfert visible sur le téléphone de la boutique…).
 */
export function PaymentsPanel({
  payments,
  due,
  paid,
  endpoint,
  canRecord,
  allowRefund,
  onChange,
  disabledReason,
}: {
  payments: PaymentRow[];
  due: number;
  paid: number;
  endpoint: string;
  canRecord: boolean;
  allowRefund?: boolean;
  onChange: (data: unknown) => void;
  disabledReason?: string | null;
}) {
  const can = useCan();
  const { notify } = useToast();
  const [kind, setKind] = useState<'PAYMENT' | 'REFUND' | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('CASH');
  const [reference, setReference] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState<PaymentRow | null>(null);
  const remaining = Math.max(0, due - paid);

  const open = (k: 'PAYMENT' | 'REFUND') => {
    setKind(k);
    setAmount(k === 'PAYMENT' && remaining ? String(remaining) : '');
    setMethod('CASH');
    setReference('');
    setError(null);
  };

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const result = await api.post(endpoint, { kind, amount: Number(amount), method, externalReference: reference.trim() || undefined });
      onChange(result);
      notify(kind === 'PAYMENT' ? 'Paiement enregistré.' : 'Remboursement enregistré.');
      setKind(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const cancel = async (reason: string) => {
    if (!cancelling) return;
    try {
      await api.post(`/payments/${cancelling.id}/cancel`, { reason });
      notify('Écriture annulée.');
      setCancelling(null);
      onChange(null);
    } catch (err) {
      notify(errorMessage(err), 'bad');
    }
  };

  return (
    <Panel
      title="Paiements"
      actions={
        canRecord && (
          <>
            {allowRefund && paid > 0 && (
              <Button size="sm" variant="ghost" onClick={() => open('REFUND')}>
                Rembourser
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={() => open('PAYMENT')} disabled={remaining <= 0 || Boolean(disabledReason)} title={disabledReason ?? undefined}>
              Encaisser
            </Button>
          </>
        )
      }
    >
      <dl className="grid grid-cols-3 gap-3 text-[13px]">
        <div>
          <dt className="text-muted">Montant dû</dt>
          <dd className="num mt-0.5 text-[16px] font-semibold">{formatPrice(due)}</dd>
        </div>
        <div>
          <dt className="text-muted">Encaissé</dt>
          <dd className="num mt-0.5 text-[16px] font-semibold">{formatPrice(paid)}</dd>
        </div>
        <div>
          <dt className="text-muted">Reste dû</dt>
          <dd className={cn('num mt-0.5 text-[16px] font-semibold', remaining > 0 && 'text-bad')}>{formatPrice(remaining)}</dd>
        </div>
      </dl>
      {payments.length > 0 && (
        <ul className="mt-4 divide-y divide-line border-t border-line text-[13.5px]">
          {payments.map((p) => (
            <li key={p.id} className={cn('flex items-start justify-between gap-3 py-2.5', p.status !== 'CONFIRMED' && 'text-muted')}>
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2">
                  <span className={cn(p.status === 'CANCELLED' && 'line-through')}>
                    {p.kind === 'REFUND' ? 'Remboursement' : 'Paiement'} · {PAYMENT_METHODS[p.method]}
                  </span>
                  {p.status === 'PENDING' && <Tag tone="warn">En attente de l’opérateur</Tag>}
                  {p.status === 'FAILED' && <Tag tone="bad">Échoué</Tag>}
                  {p.status === 'CANCELLED' && <Tag tone="neutral">Annulé</Tag>}
                  {p.provider !== 'MANUAL' && <Tag tone="info">En ligne</Tag>}
                </p>
                <p className="mt-0.5 text-[12.5px] text-muted">
                  {formatDateTime(p.confirmedAt ?? p.createdAt)}
                  {p.recordedBy ? ` · ${p.recordedBy.name}` : ''}
                  {p.externalReference ? ` · réf. ${p.externalReference}` : ''}
                </p>
                {p.cancelReason && <p className="mt-0.5 text-[12.5px]">Motif : {p.cancelReason}</p>}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className={cn('num font-medium', p.kind === 'REFUND' && 'text-bad', p.status === 'CANCELLED' && 'line-through')}>
                  {p.kind === 'REFUND' ? '−' : ''}
                  {formatPrice(p.amount)}
                </span>
                {can('payments.cancel') && p.provider === 'MANUAL' && p.status === 'CONFIRMED' && (
                  <button type="button" onClick={() => setCancelling(p)} className="text-[12px] text-muted underline hover:text-bad">
                    Annuler
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {disabledReason && <p className="mt-3 text-[12.5px] text-muted">{disabledReason}</p>}

      <Dialog
        open={kind !== null}
        onClose={() => setKind(null)}
        title={kind === 'REFUND' ? 'Enregistrer un remboursement' : 'Encaisser un paiement'}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setKind(null)}>
              Annuler
            </Button>
            <Button onClick={submit} loading={saving} disabled={!Number(amount)}>
              Enregistrer
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Montant" hint={kind === 'PAYMENT' ? `Reste à payer : ${formatPrice(remaining)}` : `Encaissé : ${formatPrice(paid)}`}>
            {(p) => <MoneyInput {...p} value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />}
          </Field>
          <Field label="Moyen de paiement">
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
          {method !== 'CASH' && (
            <Field label="Référence de transaction" optional hint="Numéro de l’opération TMoney, Flooz ou bancaire.">
              {(p) => <Input {...p} value={reference} onChange={(e) => setReference(e.target.value)} maxLength={80} className="font-mono" />}
            </Field>
          )}
          {kind === 'PAYMENT' && method !== 'CASH' && <p className="text-[12.5px] text-muted">N’enregistrez ce paiement qu’après avoir constaté la réception des fonds.</p>}
          <FormError message={error} />
        </div>
      </Dialog>

      <ConfirmDialog
        open={cancelling !== null}
        onClose={() => setCancelling(null)}
        onConfirm={cancel}
        title="Annuler cette écriture ?"
        danger
        confirmLabel="Annuler l’écriture"
        reason={{ label: 'Motif de l’annulation', placeholder: 'Erreur de saisie : montant incorrect…' }}
      >
        L’écriture reste visible dans l’historique, barrée, avec le motif. Les montants encaissés sont recalculés.
      </ConfirmDialog>
    </Panel>
  );
}
