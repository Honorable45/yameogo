'use client';

import { Eye, Printer } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import type { RepairDetail, StaffMember } from '@/lib/admin-types';
import { formatDate, formatDateTime, formatPhone, formatPrice } from '@/lib/format';
import { ROLES } from '@/lib/labels';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { DetailList, Panel } from '../ui';
import { useCan } from '../session';
import { printDepositSlip } from '../receipts';

type Update = (r: RepairDetail) => void;

export function ImeiValue({ repair }: { repair: RepairDetail }) {
  const can = useCan();
  const { notify } = useToast();
  const [imei, setImei] = useState<string | null>(null);
  if (!repair.hasImei) return <span className="text-faint">Non renseigné</span>;
  if (imei) return <span className="font-mono">{imei}</span>;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="font-mono">•••• {repair.imeiLast4}</span>
      {can('repairs.imei') && (
        <button
          type="button"
          onClick={async () => {
            try {
              setImei((await api.post<{ imei: string | null }>(`/repairs/${repair.id}/imei`)).imei);
            } catch (err) {
              notify(errorMessage(err), 'bad');
            }
          }}
          className="inline-flex items-center gap-1 text-[12.5px] text-accent underline"
        >
          <Eye className="size-3.5" /> Afficher
        </button>
      )}
    </span>
  );
}

/** Diagnostic, travaux, réparateur, échéance, notes internes. */
export function WorkPanel({ repair, onUpdate, staff }: { repair: RepairDetail; onUpdate: Update; staff: StaffMember[] }) {
  const can = useCan();
  const { notify } = useToast();
  const editable = can('repairs.write') && repair.status !== 'PICKED_UP';
  const initial = {
    diagnosis: repair.diagnosis ?? '',
    workDone: repair.workDone ?? '',
    technicianId: repair.technicianId ?? '',
    dueAt: repair.dueAt ? new Date(repair.dueAt).toLocaleDateString('en-CA', { timeZone: 'Africa/Lome' }) : '',
    internalNotes: repair.internalNotes ?? '',
  };
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setForm(initial), [repair.diagnosis, repair.workDone, repair.technicianId, repair.dueAt, repair.internalNotes]);
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  const save = async () => {
    setSaving(true);
    try {
      onUpdate(
        await api.patch<RepairDetail>(`/repairs/${repair.id}`, {
          diagnosis: form.diagnosis.trim() || null,
          workDone: form.workDone.trim() || null,
          technicianId: form.technicianId || null,
          dueAt: form.dueAt ? new Date(`${form.dueAt}T18:00:00`).toISOString() : null,
          internalNotes: form.internalNotes.trim() || null,
        }),
      );
      notify('Dossier mis à jour.');
    } catch (err) {
      notify(errorMessage(err), 'bad');
    } finally {
      setSaving(false);
    }
  };

  if (!editable) {
    return (
      <Panel title="Intervention">
        <DetailList
          items={[
            ['Diagnostic', repair.diagnosis && <span className="whitespace-pre-line">{repair.diagnosis}</span>],
            ['Réparation effectuée', repair.workDone && <span className="whitespace-pre-line">{repair.workDone}</span>],
            ['Réparateur', repair.technician?.name],
            ['Date prévue', repair.dueAt && formatDate(repair.dueAt)],
            ['Notes internes', repair.internalNotes && <span className="whitespace-pre-line">{repair.internalNotes}</span>],
          ]}
        />
      </Panel>
    );
  }

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });
  return (
    <Panel title="Intervention">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Diagnostic" className="sm:col-span-2">
          {(p) => <Textarea {...p} rows={3} value={form.diagnosis} onChange={set('diagnosis')} maxLength={4000} placeholder="Constat du réparateur" />}
        </Field>
        <Field label="Réparation effectuée" className="sm:col-span-2">
          {(p) => <Textarea {...p} rows={2} value={form.workDone} onChange={set('workDone')} maxLength={4000} />}
        </Field>
        <Field label="Réparateur responsable">
          {(p) => (
            <Select {...p} value={form.technicianId} onChange={set('technicianId')}>
              <option value="">Non attribué</option>
              {staff.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} — {ROLES[u.role]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Date prévue">{(p) => <Input {...p} type="date" value={form.dueAt} onChange={set('dueAt')} />}</Field>
        <Field label="Notes internes" className="sm:col-span-2" hint="Jamais visibles par le client.">
          {(p) => <Textarea {...p} rows={2} value={form.internalNotes} onChange={set('internalNotes')} maxLength={2000} />}
        </Field>
      </div>
      {dirty && (
        <div className="mt-4 flex gap-2">
          <Button size="sm" onClick={save} loading={saving}>
            Enregistrer
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setForm(initial)}>
            Annuler
          </Button>
        </div>
      )}
    </Panel>
  );
}

/** Bon de dépôt imprimable remis au client. */
/** Bon de dépôt (une page A4) remis au client, avec son code d'avis. */
export function TrackingPanel({ repair }: { repair: RepairDetail }) {
  const { notify } = useToast();
  const [printing, setPrinting] = useState(false);
  const print = async () => {
    setPrinting(true);
    try {
      await printDepositSlip(repair);
    } catch (err) {
      notify(errorMessage(err), 'bad');
    } finally {
      setPrinting(false);
    }
  };
  return (
    <Panel title="Bon de dépôt">
      <p className="mb-3 text-[13px] text-muted">Une page à remettre au client : appareil, panne, montant et code d’avis.</p>
      <Button size="sm" variant="secondary" onClick={print} loading={printing}>
        <Printer className="size-4" /> Imprimer le bon de dépôt
      </Button>
    </Panel>
  );
}
