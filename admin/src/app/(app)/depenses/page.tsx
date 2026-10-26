'use client';

import { Paperclip, Plus, Wallet } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { ConfirmDialog, DataTable, Metric, PageHeader, Pagination, Toolbar } from '@/components/admin/ui';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { Field, FormError, Input, MoneyInput, Select, Textarea } from '@/components/ui/field';
import { LoadingBlock } from '@/components/ui/spinner';
import { Tag } from '@/components/ui/status';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage, qs } from '@/lib/api';
import { formatAmount, formatDate, formatPrice, todayLocal } from '@/lib/format';
import { EXPENSE_CATEGORIES, PAYMENT_METHODS } from '@/lib/labels';
import { useResource } from '@/lib/use-resource';

interface Expense {
  id: string;
  label: string;
  category: string;
  categoryLabel: string;
  amount: number;
  expenseDate: string;
  paymentMethod: string;
  comment: string | null;
  status: 'ACTIVE' | 'VOIDED';
  voidReason: string | null;
  receiptUrl: string | null;
  createdBy: { name: string };
  replaces: { id: string; label: string } | null;
}

interface ExpensePage {
  items: Expense[];
  page: number;
  pageCount: number;
  total: number;
  totalAmount: number;
  byCategory: { category: string; label: string; amount: number }[];
}

function monthBounds(month: string) {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` };
}

function ExpenseDialog({ open, onClose, onSaved, correcting }: { open: boolean; onClose: () => void; onSaved: () => void; correcting: Expense | null }) {
  const { notify } = useToast();
  const [f, setF] = useState({ label: '', category: 'OTHER', amount: '', expenseDate: todayLocal(), paymentMethod: 'CASH', comment: '', reason: '' });
  const [receipt, setReceipt] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setF(
      correcting
        ? { label: correcting.label, category: correcting.category, amount: String(correcting.amount), expenseDate: correcting.expenseDate.slice(0, 10), paymentMethod: correcting.paymentMethod, comment: correcting.comment ?? '', reason: '' }
        : { label: '', category: 'OTHER', amount: '', expenseDate: todayLocal(), paymentMethod: 'CASH', comment: '', reason: '' },
    );
    setReceipt(null);
    setError(null);
  }, [open, correcting]);

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      if (correcting) {
        await api.post(`/expenses/${correcting.id}/correct`, { label: f.label.trim(), category: f.category, amount: Number(f.amount), expenseDate: f.expenseDate, paymentMethod: f.paymentMethod, comment: f.comment.trim() || undefined, reason: f.reason.trim() });
      } else {
        const form = new FormData();
        form.set('label', f.label.trim());
        form.set('category', f.category);
        form.set('amount', f.amount);
        form.set('expenseDate', f.expenseDate);
        form.set('paymentMethod', f.paymentMethod);
        if (f.comment.trim()) form.set('comment', f.comment.trim());
        if (receipt) form.set('receipt', receipt);
        await api.post('/expenses', form);
      }
      notify(correcting ? 'Dépense corrigée : l’écriture d’origine est annulée et liée à la nouvelle.' : 'Dépense enregistrée.');
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={correcting ? 'Corriger la dépense' : 'Nouvelle dépense'}
      description={correcting ? undefined : 'Charges de fonctionnement uniquement. Les achats de marchandises et de pièces passent par « Approvisionnements ».'}
      footer={<Button onClick={save} loading={saving} disabled={f.label.trim().length < 2 || !Number(f.amount) || (Boolean(correcting) && f.reason.trim().length < 5)}>Enregistrer</Button>}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Libellé" className="sm:col-span-2">{(p) => <Input {...p} value={f.label} onChange={set('label')} maxLength={160} placeholder="Loyer d’octobre, facture d’électricité…" />}</Field>
        <Field label="Catégorie">
          {(p) => (
            <Select {...p} value={f.category} onChange={set('category')}>
              {Object.entries(EXPENSE_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Montant">{(p) => <MoneyInput {...p} value={f.amount} onChange={set('amount')} />}</Field>
        <Field label="Date">{(p) => <Input {...p} type="date" value={f.expenseDate} onChange={set('expenseDate')} max={todayLocal()} />}</Field>
        <Field label="Moyen de paiement">
          {(p) => (
            <Select {...p} value={f.paymentMethod} onChange={set('paymentMethod')}>
              {Object.entries(PAYMENT_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Commentaire" optional className="sm:col-span-2">{(p) => <Textarea {...p} rows={2} value={f.comment} onChange={set('comment')} maxLength={1000} />}</Field>
        {correcting ? (
          <Field label="Motif de la correction" className="sm:col-span-2">{(p) => <Textarea {...p} rows={2} value={f.reason} onChange={set('reason')} maxLength={300} />}</Field>
        ) : (
          <Field label="Justificatif" optional className="sm:col-span-2" hint="Photo ou PDF, 8 Mo maximum. Accessible uniquement au Responsable.">
            {(p) => <Input {...p} type="file" accept="image/*,application/pdf" onChange={(e) => setReceipt(e.target.files?.[0] ?? null)} className="py-2" />}
          </Field>
        )}
      </div>
      <div className="mt-3"><FormError message={error} /></div>
    </Dialog>
  );
}

function Expenses() {
  const { notify } = useToast();
  const search = useSearchParams();
  const [month, setMonth] = useState(todayLocal().slice(0, 7));
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(search.get('nouvelle') === '1');
  const [correcting, setCorrecting] = useState<Expense | null>(null);
  const [voiding, setVoiding] = useState<Expense | null>(null);
  const { from, to } = monthBounds(month);
  const { data, error, reload } = useResource<ExpensePage>(`/expenses${qs({ from, to, category, status, page, pageSize: 50 })}`);

  const voidExpense = async (reason: string) => {
    if (!voiding) return;
    try {
      await api.post(`/expenses/${voiding.id}/void`, { reason });
      notify('Dépense annulée.');
      setVoiding(null);
      reload();
    } catch (err) {
      notify(errorMessage(err), 'bad');
    }
  };

  return (
    <>
      <PageHeader title="Dépenses générales" actions={<Button onClick={() => { setCorrecting(null); setCreating(true); }}><Plus className="size-4" /> Nouvelle dépense</Button>} />
      {data && status === 'ACTIVE' && (
        <section className="mb-6 rounded-md border border-line bg-surface p-5">
          <Metric label={`Total du mois${category ? ` — ${EXPENSE_CATEGORIES[category]}` : ''}`} value={formatPrice(data.totalAmount)} />
          {data.byCategory.length > 1 && (
            <ul className="mt-4 grid gap-x-6 gap-y-2 text-[13.5px] sm:grid-cols-2 lg:grid-cols-4">
              {data.byCategory.map((c) => (
                <li key={c.category} className="flex justify-between border-b border-line pb-1.5">
                  <span className="text-muted">{c.label}</span>
                  <span className="num">{formatPrice(c.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      <div className="rounded-md border border-line bg-surface">
        <Toolbar>
          <Input type="month" value={month} onChange={(e) => { setMonth(e.target.value || todayLocal().slice(0, 7)); setPage(1); }} aria-label="Mois" className="sm:w-48" />
          <Select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} aria-label="Catégorie" className="sm:w-56">
            <option value="">Toutes les catégories</option>
            {Object.entries(EXPENSE_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Statut" className="sm:w-48">
            <option value="ACTIVE">Dépenses actives</option>
            <option value="VOIDED">Annulées ou corrigées</option>
          </Select>
        </Toolbar>
        {error ? <ErrorState message={error} onRetry={reload} /> : !data ? <LoadingBlock /> : (
          <>
            <DataTable
              rows={data.items}
              columns={[
                { key: 'date', header: 'Date', cell: (e) => <span className="num">{formatDate(e.expenseDate)}</span> },
                {
                  key: 'label',
                  header: 'Libellé',
                  cell: (e) => (
                    <span>
                      <span className="flex items-center gap-2 font-medium">
                        {e.label}
                        {e.receiptUrl && <a href={e.receiptUrl} target="_blank" rel="noopener noreferrer" aria-label="Justificatif" className="text-muted hover:text-accent"><Paperclip className="size-3.5" /></a>}
                        {e.replaces && <Tag tone="info">Correction</Tag>}
                      </span>
                      {(e.comment || e.voidReason) && <span className="block text-[12px] text-muted">{e.voidReason ?? e.comment}</span>}
                    </span>
                  ),
                },
                { key: 'category', header: 'Catégorie', cell: (e) => e.categoryLabel },
                { key: 'method', header: 'Paiement', cell: (e) => PAYMENT_METHODS[e.paymentMethod] },
                { key: 'by', header: 'Saisie par', cell: (e) => e.createdBy.name },
                { key: 'amount', header: 'Montant (FCFA)', align: 'right', cell: (e) => <span className={e.status === 'VOIDED' ? 'text-muted line-through' : undefined}>{formatAmount(e.amount)}</span> },
                {
                  key: 'actions',
                  header: '',
                  align: 'right',
                  cell: (e) =>
                    e.status === 'ACTIVE' ? (
                      <span className="flex justify-end gap-3 text-[12.5px]">
                        <button type="button" className="text-accent underline" onClick={() => { setCorrecting(e); setCreating(true); }}>Corriger</button>
                        <button type="button" className="text-muted underline hover:text-bad" onClick={() => setVoiding(e)}>Annuler</button>
                      </span>
                    ) : null,
                },
              ]}
              empty={<EmptyState icon={Wallet} title="Aucune dépense ce mois-ci" className="py-12" />}
            />
            <Pagination page={data.page} pageCount={data.pageCount} total={data.total} onPage={setPage} />
          </>
        )}
      </div>
      <ExpenseDialog open={creating} correcting={correcting} onClose={() => { setCreating(false); setCorrecting(null); }} onSaved={reload} />
      <ConfirmDialog open={voiding !== null} onClose={() => setVoiding(null)} onConfirm={voidExpense} title="Annuler cette dépense ?" danger confirmLabel="Annuler la dépense" reason={{ label: 'Motif', placeholder: 'Saisie en double…' }}>
        La dépense reste visible dans « Annulées ou corrigées » et n’est plus comptée dans les résultats.
      </ConfirmDialog>
    </>
  );
}

export default function ExpensesPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <Expenses />
    </Suspense>
  );
}
