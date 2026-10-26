'use client';

import Link from 'next/link';
import { use, useState } from 'react';
import { useCan } from '@/components/admin/session';
import { PageHeader, Panel } from '@/components/admin/ui';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/empty-state';
import { Field, FormError, Input, Textarea } from '@/components/ui/field';
import { LoadingBlock } from '@/components/ui/spinner';
import { Status } from '@/components/ui/status';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api';
import { formatDate, formatPhone, formatPrice, whatsappLink } from '@/lib/format';
import { ORDER_STATUS, REPAIR_STATUS, SETTLEMENT } from '@/lib/labels';
import { useResource } from '@/lib/use-resource';

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  createdAt: string;
  orders?: { id: string; number: string; status: string; total: number; paymentStatus: string; createdAt: string; channel: string }[];
  repairJobs: { id: string; number: string; status: string; brandName: string; modelName: string; billedAmount: number; paymentStatus: string; receivedAt: string }[];
}

export default function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const can = useCan();
  const { notify } = useToast();
  const { data: c, error, reload } = useResource<Customer>(`/customers/${id}`);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '', notes: '' });
  const [formError, setFormError] = useState<string | null>(null);

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!c) return <LoadingBlock />;

  const save = async () => {
    setFormError(null);
    try {
      await api.patch(`/customers/${c.id}`, { name: form.name.trim(), phone: form.phone, email: form.email.trim() || undefined, notes: form.notes });
      notify('Client mis à jour.');
      setEditing(false);
      reload();
    } catch (err) {
      setFormError(errorMessage(err));
    }
  };
  const wa = whatsappLink(c.phone);

  return (
    <>
      <PageHeader
        back={{ href: '/clients', label: 'Clients' }}
        title={c.name}
        description={
          <span className="flex flex-wrap gap-3">
            <a href={`tel:${c.phone}`} className="num hover:underline">{formatPhone(c.phone)}</a>
            {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="text-accent underline">WhatsApp</a>}
            {c.email && <span>{c.email}</span>}
            <span>· client depuis le {formatDate(c.createdAt)}</span>
          </span>
        }
        actions={
          can('customers.write') &&
          !editing && (
            <Button variant="secondary" size="sm" onClick={() => { setForm({ name: c.name, phone: c.phone, email: c.email ?? '', notes: c.notes ?? '' }); setEditing(true); }}>
              Modifier
            </Button>
          )
        }
      />
      {editing && (
        <Panel title="Coordonnées" className="mb-6 max-w-2xl">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nom">{(p) => <Input {...p} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}</Field>
            <Field label="Téléphone">{(p) => <Input {...p} type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />}</Field>
            <Field label="E-mail" optional>{(p) => <Input {...p} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />}</Field>
            <Field label="Notes internes" optional className="sm:col-span-2">{(p) => <Textarea {...p} rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />}</Field>
          </div>
          <div className="mt-3"><FormError message={formError} /></div>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={save}>Enregistrer</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Annuler</Button>
          </div>
        </Panel>
      )}
      {c.notes && !editing && <p className="mb-6 max-w-2xl border-l-2 border-line-2 pl-3 text-[14px] text-ink-2">{c.notes}</p>}
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={`Réparations (${c.repairJobs.length})`} bodyClassName="">
          {c.repairJobs.length === 0 ? <p className="px-5 py-5 text-[13.5px] text-muted">Aucune réparation.</p> : (
            <ul className="divide-y divide-line">
              {c.repairJobs.map((r) => (
                <li key={r.id}>
                  <Link href={`/reparations/${r.id}`} className="flex items-start justify-between gap-3 px-5 py-3 hover:bg-paper/70">
                    <span>
                      <span className="block text-[14px] font-medium">{r.brandName} {r.modelName}</span>
                      <span className="text-[12.5px] text-muted"><span className="font-mono">{r.number}</span> · {formatDate(r.receivedAt)}</span>
                    </span>
                    <span className="flex flex-col items-end gap-1">
                      <Status tone={REPAIR_STATUS[r.status].tone}>{REPAIR_STATUS[r.status].label}</Status>
                      {r.billedAmount > 0 && <span className="num text-[12.5px] text-muted">{formatPrice(r.billedAmount)} · {SETTLEMENT[r.paymentStatus].label.toLowerCase()}</span>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        {c.orders && (
          <Panel title={`Commandes (${c.orders.length})`} bodyClassName="">
            {c.orders.length === 0 ? <p className="px-5 py-5 text-[13.5px] text-muted">Aucune commande.</p> : (
              <ul className="divide-y divide-line">
                {c.orders.map((o) => (
                  <li key={o.id}>
                    <Link href={`/commandes/${o.id}`} className="flex items-start justify-between gap-3 px-5 py-3 hover:bg-paper/70">
                      <span>
                        <span className="block font-mono text-[13.5px]">{o.number}</span>
                        <span className="text-[12.5px] text-muted">{formatDate(o.createdAt)} · {o.channel === 'ONLINE' ? 'en ligne' : 'comptoir'}</span>
                      </span>
                      <span className="flex flex-col items-end gap-1">
                        <Status tone={ORDER_STATUS[o.status].tone}>{ORDER_STATUS[o.status].label}</Status>
                        <span className="num text-[12.5px] text-muted">{formatPrice(o.total)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}
      </div>
    </>
  );
}
