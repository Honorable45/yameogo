'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { api, ApiError, errorMessage } from '@/lib/api';
import type { BrandWithModels, SupplierRow } from '@/lib/admin-types';
import { formatPrice, todayLocal } from '@/lib/format';
import { CONDITIONS, GRADES } from '@/lib/labels';
import { Button } from '@/components/ui/button';
import { Field, FormError, Input, MoneyInput, Select, Textarea } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { DeviceFields, emptyDevice, type DeviceValue } from './device-fields';
import { ConfirmDialog, Panel } from './ui';

export interface PhoneData {
  id: string;
  brandId: string;
  phoneModelId: string | null;
  modelName: string;
  condition: 'NEW' | 'IMPORTED' | 'USED';
  storageGb: number | null;
  ramGb: number | null;
  color: string | null;
  grade: string;
  batteryHealth: number | null;
  knownDefects: string | null;
  includedAccessories: string | null;
  description: string | null;
  purchasePrice: number | null;
  salePrice: number;
  warrantyMonths: number;
  acquiredAt: string;
  acquiredFrom: string | null;
  supplier: { id: string; name: string } | null;
  status: string;
  hasImei: boolean;
  updatedAt: string;
}

const num = (v: string) => (v === '' ? null : Number(v));

export function PhoneForm({ phone, brands, suppliers }: { phone?: PhoneData; brands: BrandWithModels[]; suppliers: SupplierRow[] }) {
  const router = useRouter();
  const { notify } = useToast();
  const brand = brands.find((b) => b.id === phone?.brandId);
  const [device, setDevice] = useState<DeviceValue>(
    phone ? { brandId: phone.brandId, brandName: brand?.name ?? '', modelId: phone.phoneModelId ?? '', modelName: phone.modelName, customBrand: false, customModel: !phone.phoneModelId } : emptyDevice,
  );
  const [f, setF] = useState({
    condition: phone?.condition ?? 'USED',
    storageGb: phone?.storageGb?.toString() ?? '',
    ramGb: phone?.ramGb?.toString() ?? '',
    color: phone?.color ?? '',
    grade: phone?.grade ?? 'VERY_GOOD',
    batteryHealth: phone?.batteryHealth?.toString() ?? '',
    knownDefects: phone?.knownDefects ?? '',
    includedAccessories: phone?.includedAccessories ?? '',
    description: phone?.description ?? '',
    purchasePrice: phone?.purchasePrice?.toString() ?? '',
    salePrice: phone?.salePrice.toString() ?? '',
    warrantyMonths: phone?.warrantyMonths.toString() ?? '0',
    acquiredAt: phone ? phone.acquiredAt.slice(0, 10) : todayLocal(),
    acquiredFrom: phone?.acquiredFrom ?? '',
    supplierId: phone?.supplier?.id ?? '',
    imei: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const sold = phone?.status === 'SOLD';
  const margin = f.salePrice && f.purchasePrice ? Number(f.salePrice) - Number(f.purchasePrice) : null;

  const save = async (confirmDuplicate = false) => {
    setError(null);
    if (!device.brandName.trim() || !device.modelName.trim()) return setError('Indiquez la marque et le modèle.');
    if (!sold && (f.purchasePrice === '' || f.salePrice === '')) return setError('Indiquez le prix d’achat et le prix de vente.');
    setSaving(true);
    let brandId = device.brandId;
    if (!brandId) {
      // Marque absente de la liste : ajoutée au référentiel (elle servira aussi aux devis).
      try {
        brandId = (await api.post<{ id: string }>('/brands', { name: device.brandName.trim() })).id;
      } catch (err) {
        setSaving(false);
        return setError(`Marque « ${device.brandName.trim()} » inconnue : ${errorMessage(err)}`);
      }
    }
    const body: Record<string, unknown> = {
      brandId,
      phoneModelId: device.modelId || null,
      modelName: device.modelName.trim(),
      condition: f.condition,
      storageGb: num(f.storageGb),
      ramGb: num(f.ramGb),
      color: f.color.trim() || null,
      grade: f.condition === 'NEW' ? 'LIKE_NEW' : f.grade,
      batteryHealth: f.condition === 'NEW' ? null : num(f.batteryHealth),
      knownDefects: f.condition === 'NEW' ? null : f.knownDefects.trim() || null,
      includedAccessories: f.includedAccessories.trim() || null,
      description: f.description.trim() || null,
      warrantyMonths: Number(f.warrantyMonths) || 0,
      acquiredAt: new Date(`${f.acquiredAt}T12:00:00`).toISOString(),
      acquiredFrom: f.acquiredFrom.trim() || null,
      supplierId: f.supplierId || null,
    };
    if (!sold) {
      body.purchasePrice = Number(f.purchasePrice);
      body.salePrice = Number(f.salePrice);
    }
    if (f.imei.trim()) body.imei = f.imei.trim();
    try {
      if (phone) {
        await api.patch(`/used-phones/${phone.id}`, body);
        notify('Fiche enregistrée.');
        router.refresh();
      } else {
        const created = await api.post<{ id: string; reference: string }>('/used-phones', { ...body, confirmDuplicate });
        notify(`Téléphone ${created.reference} enregistré. Ajoutez ses photos réelles, puis mettez-le en vente.`);
        router.push(`/occasions/${created.id}`);
        return;
      }
    } catch (err) {
      if (err instanceof ApiError && err.body.code === 'POSSIBLE_DUPLICATE') setDuplicate(err.message);
      else setError(errorMessage(err));
    }
    setSaving(false);
  };

  // Le bloc facultatif s'ouvre d'office quand il contient déjà des informations.
  const hasExtras = Boolean(phone && (phone.hasImei || phone.ramGb || phone.includedAccessories || phone.description || phone.supplier || phone.acquiredFrom));

  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        void save();
      }}
      className="space-y-6"
    >
      <Panel title="Téléphone">
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Catégorie">
            {(['NEW', 'IMPORTED', 'USED'] as const).map((c) => (
              <label key={c} className={`flex cursor-pointer items-center justify-center gap-2 rounded-sm border px-3 py-2.5 text-[14px] font-medium ${f.condition === c ? 'border-accent bg-accent/5 ring-1 ring-accent' : 'border-line-2'}`}>
                <input type="radio" name="condition" className="accent-accent" checked={f.condition === c} onChange={() => setF({ ...f, condition: c })} />
                {CONDITIONS[c]}
              </label>
            ))}
          </div>
          <DeviceFields brands={brands} value={device} onChange={setDevice} />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Field label="Stockage (Go)">{(p) => <Input {...p} type="number" min={1} value={f.storageGb} onChange={set('storageGb')} className="num" />}</Field>
            <Field label="Couleur">{(p) => <Input {...p} value={f.color} onChange={set('color')} maxLength={40} />}</Field>
            {f.condition !== 'NEW' && (
              <Field label="État">
                {(p) => (
                  <Select {...p} value={f.grade} onChange={set('grade')}>
                    {Object.entries(GRADES).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            )}
            {f.condition !== 'NEW' && <Field label="Batterie (%)" optional>{(p) => <Input {...p} type="number" min={0} max={100} value={f.batteryHealth} onChange={set('batteryHealth')} className="num" />}</Field>}
          </div>
          {f.condition !== 'NEW' && (
            <Field label="Défauts connus" optional hint="Affichés sur la fiche publique : soyez précis et honnête.">
              {(p) => <Input {...p} value={f.knownDefects} onChange={set('knownDefects')} maxLength={1000} placeholder="Rayure légère au dos, Face ID inactif…" />}
            </Field>
          )}
        </div>
      </Panel>

      <Panel title="Prix">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Prix d’achat" hint={sold ? 'Figé : téléphone vendu.' : undefined}>
            {(p) => <MoneyInput {...p} value={f.purchasePrice} onChange={set('purchasePrice')} disabled={sold} />}
          </Field>
          <Field label="Prix de vente" hint={margin !== null ? `Marge : ${formatPrice(margin)}` : undefined}>
            {(p) => <MoneyInput {...p} value={f.salePrice} onChange={set('salePrice')} disabled={sold} />}
          </Field>
          <Field label="Garantie (mois)">{(p) => <Input {...p} type="number" min={0} max={36} value={f.warrantyMonths} onChange={set('warrantyMonths')} className="num" />}</Field>
        </div>
      </Panel>

      <details open={hasExtras} className="group rounded-md border border-line bg-surface">
        <summary className="cursor-pointer select-none px-5 py-3.5 text-[14px] font-medium text-ink-2 hover:text-ink">Plus de détails <span className="font-normal text-muted">— IMEI, accessoires, fournisseur… (facultatif)</span></summary>
        <div className="grid gap-4 border-t border-line px-5 py-5 sm:grid-cols-2">
          <Field label={phone?.hasImei ? 'Remplacer l’IMEI' : 'IMEI'} optional hint="Chiffré, jamais affiché sur le site.">
            {(p) => <Input {...p} value={f.imei} onChange={set('imei')} inputMode="numeric" maxLength={30} className="font-mono" autoComplete="off" />}
          </Field>
          <Field label="RAM (Go)" optional>{(p) => <Input {...p} type="number" min={1} value={f.ramGb} onChange={set('ramGb')} className="num" />}</Field>
          <Field label="Accessoires inclus" optional className="sm:col-span-2">
            {(p) => <Input {...p} value={f.includedAccessories} onChange={set('includedAccessories')} maxLength={500} placeholder="Câble, boîte d’origine…" />}
          </Field>
          <Field label="Description" optional className="sm:col-span-2">
            {(p) => <Textarea {...p} rows={2} value={f.description} onChange={set('description')} maxLength={3000} />}
          </Field>
          <Field label="Date d’acquisition">{(p) => <Input {...p} type="date" value={f.acquiredAt} onChange={set('acquiredAt')} max={todayLocal()} />}</Field>
          <Field label="Fournisseur" optional>
            {(p) => (
              <Select {...p} value={f.supplierId} onChange={set('supplierId')}>
                <option value="">Aucun (rachat à un particulier…)</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Provenance" optional className="sm:col-span-2" hint="Interne : jamais affiché.">
            {(p) => <Input {...p} value={f.acquiredFrom} onChange={set('acquiredFrom')} maxLength={160} placeholder="Rachat particulier, reprise client…" />}
          </Field>
        </div>
      </details>

      <FormError message={error} />
      <Button type="submit" loading={saving}>
        {phone ? 'Enregistrer' : 'Enregistrer le téléphone'}
      </Button>

      <ConfirmDialog
        open={duplicate !== null}
        onClose={() => {
          setDuplicate(null);
          setSaving(false);
        }}
        onConfirm={() => {
          setDuplicate(null);
          void save(true);
        }}
        title="Doublon possible"
        confirmLabel="C’est un autre appareil"
      >
        {duplicate}
      </ConfirmDialog>
    </form>
  );
}
