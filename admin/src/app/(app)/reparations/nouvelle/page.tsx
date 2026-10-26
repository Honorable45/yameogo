'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { CustomerPicker, type CustomerChoice } from '@/components/admin/customer-picker';
import { DeviceFields, emptyDevice, type DeviceValue } from '@/components/admin/device-fields';
import { PageHeader, Panel } from '@/components/admin/ui';
import { Button } from '@/components/ui/button';
import { Field, FormError, Input, MoneyInput, Select, Textarea } from '@/components/ui/field';
import { LoadingBlock } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api';
import type { BrandWithModels, RepairTypeRow, StaffMember } from '@/lib/admin-types';
import { formatPrice } from '@/lib/format';
import { ROLES } from '@/lib/labels';
import { useResource } from '@/lib/use-resource';
import { useSession } from '@/components/admin/session';

interface Price {
  repairTypeId: string;
  totalPrice: number;
  durationMinutes: number | null;
}

export default function NewRepairPage() {
  const router = useRouter();
  const me = useSession();
  const { notify } = useToast();
  const brands = useResource<BrandWithModels[]>('/brands');
  const types = useResource<RepairTypeRow[]>('/repair-pricing/types');
  const staff = useResource<StaffMember[]>('/users/staff');

  const [customer, setCustomer] = useState<CustomerChoice>({ name: '', phone: '' });
  const [device, setDevice] = useState<DeviceValue>(emptyDevice);
  const [imei, setImei] = useState('');
  const [typeId, setTypeId] = useState('');
  const [issue, setIssue] = useState('');
  const [technicianId, setTechnicianId] = useState(me.role === 'TECHNICIAN' ? me.id : '');
  const [dueAt, setDueAt] = useState('');
  const [billed, setBilled] = useState('');
  const [notes, setNotes] = useState('');
  const [prices, setPrices] = useState<Price[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!device.modelId) return setPrices([]);
    api.get<Price[]>(`/repair-catalog/models/${device.modelId}/prices`).then(setPrices).catch(() => setPrices([]));
  }, [device.modelId]);

  const tariff = prices.find((p) => p.repairTypeId === typeId);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!customer.id && customer.phone.replace(/\D/g, '').length < 8) return setError('Indiquez le téléphone du client.');
    const brandName = device.brandName.trim();
    const modelName = device.modelName.trim();
    if (!brandName || !modelName) return setError('Indiquez la marque et le modèle.');
    if (issue.trim().length < 3) return setError('Décrivez la panne signalée par le client.');
    setSaving(true);
    try {
      const job = await api.post<{ id: string; number: string }>('/repairs', {
        customerId: customer.id,
        customerName: customer.id ? undefined : customer.name.trim() || undefined,
        customerPhone: customer.id ? undefined : customer.phone,
        brandName,
        phoneModelId: device.modelId || null,
        modelName,
        imei: imei.trim() || null,
        repairTypeId: typeId || null,
        reportedIssue: issue.trim(),
        technicianId: technicianId || null,
        dueAt: dueAt ? new Date(`${dueAt}T18:00:00`).toISOString() : null,
        billedAmount: billed ? Number(billed) : undefined,
        internalNotes: notes.trim() || null,
      });
      notify(`Dossier ${job.number} créé.`);
      router.push(`/reparations/${job.id}`);
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  };

  if (!brands.data || !types.data) return <LoadingBlock />;

  return (
    <>
      <PageHeader title="Nouvelle réparation" back={{ href: '/reparations', label: 'Réparations' }} />
      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          <Panel title="Client">
            <CustomerPicker value={customer} onChange={setCustomer} />
          </Panel>
          <Panel title="Appareil">
            <div className="space-y-4">
              <DeviceFields brands={brands.data} value={device} onChange={setDevice} />
              <Field label="IMEI ou numéro de série" optional hint="Chiffré en base. Visible uniquement par les personnes autorisées ; chaque consultation est journalisée.">
                {(p) => <Input {...p} value={imei} onChange={(e) => setImei(e.target.value)} inputMode="numeric" maxLength={30} className="font-mono" autoComplete="off" />}
              </Field>
            </div>
          </Panel>
          <Panel title="Panne">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Type de panne" optional>
                {(p) => (
                  <Select {...p} value={typeId} onChange={(e) => setTypeId(e.target.value)}>
                    <option value="">Non précisé</option>
                    {types.data!.filter((t) => t.active).map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <div className="flex items-end">
                {tariff ? (
                  <p className="w-full rounded-sm border border-line bg-paper/60 px-3 py-2.5 text-[13.5px]">
                    Tarif configuré : <span className="num font-semibold">{formatPrice(tariff.totalPrice)}</span>
                    {!billed && (
                      <button type="button" onClick={() => setBilled(String(tariff.totalPrice))} className="ml-2 text-accent underline">
                        Appliquer
                      </button>
                    )}
                  </p>
                ) : (
                  device.modelId && typeId && <p className="text-[13px] text-muted">Aucun tarif configuré : estimation personnalisée.</p>
                )}
              </div>
              <Field label="Panne signalée par le client" className="sm:col-span-2">
                {(p) => <Textarea {...p} value={issue} onChange={(e) => setIssue(e.target.value)} rows={3} maxLength={2000} required placeholder="Écran fissuré après une chute, tactile fonctionnel…" />}
              </Field>
            </div>
          </Panel>
        </div>

        <div className="space-y-6 lg:col-span-4">
          <Panel title="Prise en charge">
            <div className="space-y-4">
              <Field label="Réparateur responsable" optional>
                {(p) => (
                  <Select {...p} value={technicianId} onChange={(e) => setTechnicianId(e.target.value)}>
                    <option value="">Non attribué</option>
                    {staff.data?.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} — {ROLES[u.role]}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Date prévue" optional>
                {(p) => <Input {...p} type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />}
              </Field>
              <Field label="Montant convenu" optional hint="Peut être fixé plus tard par un devis après diagnostic.">
                {(p) => <MoneyInput {...p} value={billed} onChange={(e) => setBilled(e.target.value)} />}
              </Field>
              <Field label="Commentaire interne" optional>
                {(p) => <Textarea {...p} value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={2000} placeholder="État à la réception, accessoires laissés, code de déverrouillage communiqué…" />}
              </Field>
            </div>
          </Panel>
          <FormError message={error} />
          <Button type="submit" size="lg" loading={saving} className="w-full">
            Enregistrer le dossier
          </Button>
        </div>
      </form>
    </>
  );
}
