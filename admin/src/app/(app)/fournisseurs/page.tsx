'use client';

import { ClipboardList, Plus } from 'lucide-react';
import { useState } from 'react';
import { DataTable, PageHeader, SearchInput, Toolbar } from '@/components/admin/ui';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { Checkbox, Field, FormError, Input, Textarea } from '@/components/ui/field';
import { LoadingBlock } from '@/components/ui/spinner';
import { Tag } from '@/components/ui/status';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api';
import type { SupplierRow } from '@/lib/admin-types';
import { formatAmount, formatPhone } from '@/lib/format';
import { useDebounced, useResource } from '@/lib/use-resource';

function SupplierDialog({ supplier, onClose, onSaved }: { supplier: SupplierRow | 'new' | null; onClose: () => void; onSaved: () => void }) {
  const { notify } = useToast();
  const s = supplier && supplier !== 'new' ? supplier : null;
  const [form, setForm] = useState({ name: s?.name ?? '', phone: s?.phone ?? '', email: s?.email ?? '', address: s?.address ?? '', notes: s?.notes ?? '', active: s?.active ?? true });
  const [error, setError] = useState<string | null>(null);
  if (!supplier) return null;
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });
  const save = async () => {
    setError(null);
    try {
      const body = { name: form.name.trim(), phone: form.phone.trim() || undefined, email: form.email.trim() || undefined, address: form.address.trim() || undefined, notes: form.notes.trim() || undefined };
      if (s) await api.patch(`/suppliers/${s.id}`, { ...body, active: form.active });
      else await api.post('/suppliers', body);
      notify('Fournisseur enregistré.');
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  };
  return (
    <Dialog open onClose={onClose} title={s ? 'Modifier le fournisseur' : 'Nouveau fournisseur'} footer={<Button onClick={save} disabled={form.name.trim().length < 2}>Enregistrer</Button>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom" className="sm:col-span-2">{(p) => <Input {...p} value={form.name} onChange={set('name')} maxLength={120} />}</Field>
        <Field label="Téléphone" optional>{(p) => <Input {...p} type="tel" value={form.phone} onChange={set('phone')} />}</Field>
        <Field label="E-mail" optional>{(p) => <Input {...p} type="email" value={form.email} onChange={set('email')} />}</Field>
        <Field label="Adresse" optional className="sm:col-span-2">{(p) => <Input {...p} value={form.address} onChange={set('address')} maxLength={300} />}</Field>
        <Field label="Notes" optional className="sm:col-span-2">{(p) => <Textarea {...p} rows={2} value={form.notes} onChange={set('notes')} maxLength={1000} placeholder="Délais, conditions de paiement…" />}</Field>
        {s && <Checkbox className="sm:col-span-2" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} label="Fournisseur actif" />}
      </div>
      <div className="mt-3"><FormError message={error} /></div>
    </Dialog>
  );
}

export default function SuppliersPage() {
  const [q, setQ] = useState('');
  const term = useDebounced(q, 250);
  const { data, error, reload } = useResource<SupplierRow[]>(`/suppliers${term ? `?q=${encodeURIComponent(term)}` : ''}`);
  const [editing, setEditing] = useState<SupplierRow | 'new' | null>(null);
  return (
    <>
      <PageHeader title="Fournisseurs" actions={<Button onClick={() => setEditing('new')}><Plus className="size-4" /> Nouveau fournisseur</Button>} />
      <div className="rounded-md border border-line bg-surface">
        <Toolbar>
          <SearchInput value={q} onChange={setQ} placeholder="Nom" className="sm:max-w-sm sm:flex-1" />
        </Toolbar>
        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : !data ? (
          <LoadingBlock />
        ) : (
          <DataTable
            rows={data}
            columns={[
              { key: 'name', header: 'Fournisseur', cell: (s) => <button type="button" onClick={() => setEditing(s)} className="text-left font-medium hover:underline">{s.name}{!s.active && <Tag className="ml-2">Inactif</Tag>}</button> },
              { key: 'contact', header: 'Contact', cell: (s) => <span className="num">{[s.phone && formatPhone(s.phone), s.email].filter(Boolean).join(' · ') || '—'}</span> },
              { key: 'purchases', header: 'Approvisionnements', align: 'right', cell: (s) => s._count.purchases },
              { key: 'articles', header: 'Articles', align: 'right', cell: (s) => s._count.products },
              { key: 'due', header: 'Solde dû (FCFA)', align: 'right', cell: (s) => <span className={s.balanceDue > 0 ? 'font-medium text-bad' : undefined}>{formatAmount(s.balanceDue)}</span> },
            ]}
            empty={<EmptyState icon={ClipboardList} title="Aucun fournisseur" className="py-12" />}
          />
        )}
      </div>
      <SupplierDialog key={editing === 'new' ? 'new' : editing?.id} supplier={editing} onClose={() => setEditing(null)} onSaved={reload} />
    </>
  );
}
