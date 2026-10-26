'use client';

import { useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import type { RepairDetail } from '@/lib/admin-types';
import { cn } from '@/lib/cn';
import { formatDateTime, formatDuration, formatPrice } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, FormError, Input, MoneyInput, Textarea } from '@/components/ui/field';
import { Tag } from '@/components/ui/status';
import { useToast } from '@/components/ui/toast';
import { ConfirmDialog, Panel } from '../ui';
import { useCan } from '../session';

type Update = (r: RepairDetail) => void;

const ACTIONS: Record<string, { label: string; variant: 'primary' | 'secondary' | 'danger' }> = {
  DIAGNOSING: { label: 'Commencer le diagnostic', variant: 'secondary' },
  IN_PROGRESS: { label: 'Démarrer la réparation', variant: 'secondary' },
  WAITING_PARTS: { label: 'En attente de pièces', variant: 'secondary' },
  COMPLETED: { label: 'Marquer comme terminée', variant: 'primary' },
  PICKED_UP: { label: 'Remettre au client', variant: 'primary' },
  CANCELLED: { label: 'Annuler le dossier', variant: 'danger' },
};

/** Boutons de changement de statut, limités aux transitions autorisées par le serveur. */
export function StatusActions({ repair, onUpdate }: { repair: RepairDetail; onUpdate: Update }) {
  const can = useCan();
  const { notify } = useToast();
  const [confirm, setConfirm] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const reopen = repair.status === 'COMPLETED';
  const transitions = repair.allowedTransitions.filter((t) => (t === 'PICKED_UP' ? can('repairs.handover') : can('repairs.write')));

  const run = async (status: string, note?: string) => {
    setLoading(true);
    try {
      onUpdate(await api.post<RepairDetail>(`/repairs/${repair.id}/status`, { status, note }));
      notify('Statut mis à jour.');
      setConfirm(null);
    } catch (err) {
      notify(errorMessage(err), 'bad');
    } finally {
      setLoading(false);
    }
  };

  const returnDevice = async () => {
    setLoading(true);
    try {
      onUpdate(await api.post<RepairDetail>(`/repairs/${repair.id}/device-returned`));
      notify('Remise du téléphone enregistrée.');
    } catch (err) {
      notify(errorMessage(err), 'bad');
    } finally {
      setLoading(false);
    }
  };

  if (!transitions.length && !(repair.status === 'CANCELLED' && !repair.deviceReturnedAt && can('repairs.handover'))) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {transitions.map((t) => {
        const a = reopen && t === 'IN_PROGRESS' ? { label: 'Reprendre la réparation', variant: 'secondary' as const } : ACTIONS[t];
        if (!a) return null;
        const needsConfirm = t === 'CANCELLED' || t === 'COMPLETED' || t === 'PICKED_UP';
        return (
          <Button key={t} size="sm" variant={a.variant} disabled={loading} onClick={() => (needsConfirm ? setConfirm(t) : run(t))}>
            {a.label}
          </Button>
        );
      })}
      {repair.status === 'CANCELLED' && !repair.deviceReturnedAt && can('repairs.handover') && (
        <Button size="sm" variant="secondary" onClick={returnDevice} loading={loading}>
          Téléphone rendu au client
        </Button>
      )}

      <ConfirmDialog open={confirm === 'CANCELLED'} onClose={() => setConfirm(null)} onConfirm={(r) => run('CANCELLED', r)} title="Annuler ce dossier ?" danger confirmLabel="Annuler le dossier" reason={{ label: 'Motif', placeholder: 'Le client a refusé le devis…' }} loading={loading}>
        Une réparation annulée n’est jamais comptée comme réalisée. Les pièces déjà posées restent comptées en coûts : retirez-les d’abord si elles retournent en stock.
      </ConfirmDialog>
      <ConfirmDialog open={confirm === 'COMPLETED'} onClose={() => setConfirm(null)} onConfirm={() => run('COMPLETED')} title="Réparation terminée ?" confirmLabel="Confirmer" loading={loading}>
        <p>
          Montant facturé : <strong className="num">{formatPrice(repair.billedAmount)}</strong>. Vérifiez qu’il est correct et que toutes les pièces utilisées sont saisies : la réparation sera comptée dans le chiffre d’affaires à cette date.
        </p>
      </ConfirmDialog>
      <ConfirmDialog open={confirm === 'PICKED_UP'} onClose={() => setConfirm(null)} onConfirm={() => run('PICKED_UP')} title="Remettre le téléphone au client ?" confirmLabel="Confirmer la remise" loading={loading}>
        {repair.balanceDue > 0 ? (
          <p className="text-bad">
            Attention : il reste <strong className="num">{formatPrice(repair.balanceDue)}</strong> à encaisser. Encaissez le solde avant la remise, ou confirmez une remise à crédit.
          </p>
        ) : (
          <p>Le dossier est réglé. La remise sera datée de maintenant.</p>
        )}
      </ConfirmDialog>
    </div>
  );
}

const QUOTE_TAG: Record<string, { label: string; tone: 'warn' | 'ok' | 'bad' | 'neutral' }> = {
  PENDING: { label: 'En attente du client', tone: 'warn' },
  ACCEPTED: { label: 'Accepté', tone: 'ok' },
  REFUSED: { label: 'Refusé', tone: 'bad' },
  SUPERSEDED: { label: 'Remplacé', tone: 'neutral' },
};

export function QuotesPanel({ repair, onUpdate, suggested }: { repair: RepairDetail; onUpdate: Update; suggested: number | null }) {
  const can = useCan();
  const { notify } = useToast();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [details, setDetails] = useState('');
  const [duration, setDuration] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const quotable = ['RECEIVED', 'DIAGNOSING', 'QUOTE_PENDING', 'QUOTE_ACCEPTED', 'WAITING_PARTS', 'IN_PROGRESS'].includes(repair.status);
  const pending = repair.quotes.find((q) => q.status === 'PENDING');

  const create = async () => {
    setSaving(true);
    setError(null);
    try {
      onUpdate(await api.post<RepairDetail>(`/repairs/${repair.id}/quotes`, { amount: Number(amount), details: details.trim(), durationMinutes: duration ? Number(duration) * 60 : null }));
      notify('Devis émis. Enregistrez la réponse du client dès qu’il l’a donnée.');
      setOpen(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const decide = async (accept: boolean) => {
    if (!pending) return;
    try {
      onUpdate(await api.post<RepairDetail>(`/repairs/${repair.id}/quotes/${pending.id}/decision`, { accept }));
      notify(accept ? 'Accord du client enregistré.' : 'Refus du client enregistré.');
    } catch (err) {
      notify(errorMessage(err), 'bad');
    }
  };

  return (
    <Panel
      title="Devis"
      actions={
        can('repairs.write') &&
        quotable && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setAmount(String(repair.billedAmount || suggested || ''));
              setDetails(repair.diagnosis ?? '');
              setDuration('');
              setError(null);
              setOpen(true);
            }}
          >
            {repair.quotes.length ? 'Nouveau devis' : 'Établir un devis'}
          </Button>
        )
      }
    >
      {repair.quotes.length === 0 ? (
        <p className="text-[13.5px] text-muted">Aucun devis. Après diagnostic, émettez un devis : le client l’accepte en ligne ou en boutique avant l’intervention.</p>
      ) : (
        <ul className="divide-y divide-line">
          {[...repair.quotes].reverse().map((q) => (
            <li key={q.id} className={cn('py-3 first:pt-0 last:pb-0', q.status === 'SUPERSEDED' && 'opacity-60')}>
              <div className="flex items-center justify-between gap-3">
                <p className="flex items-center gap-2 text-[14px]">
                  <span className="font-medium">Devis n°{q.version}</span>
                  <Tag tone={QUOTE_TAG[q.status].tone}>{QUOTE_TAG[q.status].label}</Tag>
                </p>
                <span className="num font-semibold">{formatPrice(q.amount)}</span>
              </div>
              <p className="mt-1 whitespace-pre-line text-[13.5px] text-ink-2">{q.details}</p>
              <p className="mt-1 text-[12.5px] text-muted">
                {formatDateTime(q.createdAt)} · {q.createdBy.name}
                {q.durationMinutes ? ` · ${formatDuration(q.durationMinutes)}` : ''}
                {q.decidedAt ? ` · décision ${q.decidedVia === 'CUSTOMER' ? 'en ligne' : 'en boutique'} le ${formatDateTime(q.decidedAt)}` : ''}
              </p>
            </li>
          ))}
        </ul>
      )}
      {pending && can('repairs.write') && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <span className="mr-auto text-[13px] text-muted">Accord donné en boutique ou par téléphone :</span>
          <Button size="sm" onClick={() => decide(true)}>
            Accepté par le client
          </Button>
          <Button size="sm" variant="secondary" onClick={() => decide(false)}>
            Refusé
          </Button>
        </div>
      )}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Établir un devis"
        description="Le précédent devis en attente est remplacé. Le client est invité à l’accepter avant l’intervention."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button onClick={create} loading={saving} disabled={!amount || details.trim().length < 3}>
              Émettre le devis
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Montant total" hint={suggested ? `Tarif configuré : ${formatPrice(suggested)}` : undefined}>
            {(p) => <MoneyInput {...p} value={amount} onChange={(e) => setAmount(e.target.value)} />}
          </Field>
          <Field label="Durée estimée (heures)" optional>
            {(p) => <Input {...p} type="number" min={0} step={0.5} inputMode="decimal" value={duration} onChange={(e) => setDuration(e.target.value)} />}
          </Field>
          <Field label="Détail visible par le client" className="sm:col-span-2">
            {(p) => <Textarea {...p} rows={4} value={details} onChange={(e) => setDetails(e.target.value)} maxLength={2000} placeholder="Remplacement de l’écran LCD, test complet…" />}
          </Field>
        </div>
        <div className="mt-3">
          <FormError message={error} />
        </div>
      </Dialog>
    </Panel>
  );
}

const HISTORY_TYPES: Record<string, string> = { STATUS: 'Statut', QUOTE: 'Devis', PART: 'Pièce', PAYMENT: 'Paiement', PRICE: 'Montant', COST: 'Coût', DEVICE: 'Remise', NOTE: 'Note', REVIEW: 'Avis' };

export function HistoryPanel({ repair }: { repair: RepairDetail }) {
  return (
    <Panel title="Historique du dossier">
      <ol className="relative space-y-3 border-l border-line pl-4">
        {repair.history.map((h) => (
          <li key={h.id} className="relative text-[13.5px]">
            <span className={cn('absolute -left-[21px] top-1.5 size-2 rounded-full border-2 border-surface', h.type === 'STATUS' ? 'bg-accent' : 'bg-line-2')} aria-hidden="true" />
            <p className="text-ink">{h.message}</p>
            <p className="text-[12px] text-muted">
              {formatDateTime(h.createdAt)} · {HISTORY_TYPES[h.type] ?? h.type}
              {h.user ? ` · ${h.user.name}` : h.type === 'QUOTE' ? ' · client' : ''}
            </p>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
