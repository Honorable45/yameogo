'use client';

import { ImagePlus } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, FormError, Input, MoneyInput, Textarea } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/toast';
import { Panel } from '../ui';

export type Settings = Record<string, string | number | boolean | null>;

const TEXT_FIELDS: { key: string; label: string; hint?: string; wide?: boolean; long?: boolean }[] = [
  { key: 'shopName', label: 'Nom commercial' },
  { key: 'tagline', label: 'Accroche', hint: 'Une phrase courte affichée en pied de page.' },
  { key: 'phone', label: 'Téléphone', hint: 'Format international conseillé : +228 90 00 00 00' },
  { key: 'whatsapp', label: 'Numéro WhatsApp', hint: 'Avec l’indicatif pays, pour les liens « Écrire sur WhatsApp ».' },
  { key: 'email', label: 'E-mail' },
  { key: 'addressLine', label: 'Adresse', hint: 'Rue, quartier, point de repère.' },
  { key: 'city', label: 'Ville' },
  { key: 'country', label: 'Pays' },
  { key: 'latitude', label: 'Latitude GPS', hint: 'Google Maps : appui long sur la boutique, puis copiez le 1er nombre (ex. 6.1319).' },
  { key: 'longitude', label: 'Longitude GPS', hint: 'Le 2e nombre (ex. 1.2228). Sert à la carte et à l’itinéraire du site.' },
  { key: 'mapUrl', label: 'Lien d’itinéraire', hint: 'Facultatif : lien Google Maps de la fiche de la boutique (https://…).', wide: true },
  { key: 'tiktokUrl', label: 'TikTok', hint: 'https://www.tiktok.com/@votre-compte' },
  { key: 'instagramUrl', label: 'Instagram', hint: 'https://www.instagram.com/votre-compte' },
  { key: 'facebookUrl', label: 'Facebook', hint: 'https://www.facebook.com/votre-page' },
];

const LEGAL_FIELDS = [
  { key: 'legalName', label: 'Raison sociale' },
  { key: 'legalForm', label: 'Forme juridique' },
  { key: 'registrationNumber', label: 'N° RCCM' },
  { key: 'taxId', label: 'Identifiant fiscal (NIF)' },
  { key: 'publicationDirector', label: 'Directeur de la publication' },
  { key: 'hostingProvider', label: 'Hébergeur du site', long: true },
];

function useSettingsForm(initial: Settings, keys: string[], onSaved: (s: Settings) => void) {
  const { notify } = useToast();
  const [values, setValues] = useState<Settings>(() => Object.fromEntries(keys.map((k) => [k, initial[k] ?? ''])));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const dirty = keys.some((k) => (values[k] ?? '') !== (initial[k] ?? ''));
  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const body = Object.fromEntries(keys.map((k) => [k, typeof values[k] === 'string' ? (values[k] as string).trim() || null : values[k]]));
      onSaved(await api.put<Settings>('/settings', body));
      notify('Paramètres enregistrés. Le site est mis à jour sous une minute.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  return { values, setValues, error, saving, dirty, save };
}

export function IdentityPanel({ settings, onSaved }: { settings: Settings; onSaved: (s: Settings) => void }) {
  const keys = [...TEXT_FIELDS.map((f) => f.key), 'repairWarrantyText'];
  const f = useSettingsForm(settings, keys, onSaved);
  return (
    <Panel title="Boutique et coordonnées">
      <p className="mb-4 text-[13.5px] text-muted">Seules les informations renseignées apparaissent sur le site ; rien n’est affiché par défaut.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {TEXT_FIELDS.map((t) => (
          <Field key={t.key} label={t.label} hint={t.hint} optional={t.key !== 'shopName'} className={t.wide ? 'sm:col-span-2' : undefined}>
            {(p) => <Input {...p} value={String(f.values[t.key] ?? '')} onChange={(e) => f.setValues({ ...f.values, [t.key]: e.target.value })} />}
          </Field>
        ))}
        <Field label="Conditions de garantie des réparations" optional className="sm:col-span-2">
          {(p) => <Textarea {...p} rows={2} value={String(f.values.repairWarrantyText ?? '')} onChange={(e) => f.setValues({ ...f.values, repairWarrantyText: e.target.value })} maxLength={600} />}
        </Field>
      </div>
      <div className="mt-4"><FormError message={f.error} /></div>
      {f.dirty && <Button className="mt-3" onClick={f.save} loading={f.saving}>Enregistrer</Button>}
    </Panel>
  );
}

export function LegalPanel({ settings, onSaved }: { settings: Settings; onSaved: (s: Settings) => void }) {
  const f = useSettingsForm(settings, LEGAL_FIELDS.map((l) => l.key), onSaved);
  return (
    <Panel title="Mentions légales">
      <div className="grid gap-4 sm:grid-cols-2">
        {LEGAL_FIELDS.map((t) => (
          <Field key={t.key} label={t.label} optional className={t.long ? 'sm:col-span-2' : undefined}>
            {(p) => (t.long ? <Textarea {...p} rows={2} value={String(f.values[t.key] ?? '')} onChange={(e) => f.setValues({ ...f.values, [t.key]: e.target.value })} /> : <Input {...p} value={String(f.values[t.key] ?? '')} onChange={(e) => f.setValues({ ...f.values, [t.key]: e.target.value })} />)}
          </Field>
        ))}
      </div>
      <div className="mt-4"><FormError message={f.error} /></div>
      {f.dirty && <Button className="mt-3" onClick={f.save} loading={f.saving}>Enregistrer</Button>}
    </Panel>
  );
}

export function CheckoutPanel({ settings, providerConfigured, onSaved }: { settings: Settings; providerConfigured: boolean; onSaved: (s: Settings) => void }) {
  const keys = ['deliveryEnabled', 'deliveryFee', 'deliveryArea', 'payInStoreEnabled', 'cashOnDeliveryEnabled', 'mobileMoneyEnabled'];
  const f = useSettingsForm(settings, keys, onSaved);
  const v = f.values;
  const set = (k: string, value: string | number | boolean) => f.setValues({ ...v, [k]: value });
  return (
    <Panel title="Vente en ligne">
      <div className="space-y-5">
        <Checkbox checked={Boolean(v.payInStoreEnabled)} onChange={(e) => set('payInStoreEnabled', e.target.checked)} label="Paiement en boutique au retrait" />
        <div className="border-t border-line pt-5">
          <Checkbox checked={Boolean(v.deliveryEnabled)} onChange={(e) => set('deliveryEnabled', e.target.checked)} label="Proposer la livraison" />
          {Boolean(v.deliveryEnabled) && (
            <div className="mt-4 grid gap-4 pl-8 sm:grid-cols-2">
              <Field label="Frais de livraison" hint={`Affiché : ${formatPrice(Number(v.deliveryFee) || 0)}`}>{(p) => <MoneyInput {...p} value={String(v.deliveryFee ?? 0)} onChange={(e) => set('deliveryFee', Number(e.target.value) || 0)} />}</Field>
              <Field label="Zone desservie" optional>{(p) => <Input {...p} value={String(v.deliveryArea ?? '')} onChange={(e) => set('deliveryArea', e.target.value)} placeholder="Lomé et environs" />}</Field>
              <Checkbox className="sm:col-span-2" checked={Boolean(v.cashOnDeliveryEnabled)} onChange={(e) => set('cashOnDeliveryEnabled', e.target.checked)} label="Paiement à la livraison" />
            </div>
          )}
        </div>
        <div className="border-t border-line pt-5">
          <Checkbox
            checked={Boolean(v.mobileMoneyEnabled)}
            disabled={!providerConfigured}
            onChange={(e) => set('mobileMoneyEnabled', e.target.checked)}
            label="Paiement TMoney / Flooz en ligne"
            description={providerConfigured ? 'Les paiements ne sont considérés comme reçus qu’après confirmation vérifiée par le prestataire.' : 'Indisponible : aucun prestataire de paiement n’est configuré sur le serveur (variable PAYGATE_API_KEY).'}
          />
        </div>
      </div>
      <div className="mt-4"><FormError message={f.error} /></div>
      {f.dirty && <Button className="mt-3" onClick={f.save} loading={f.saving}>Enregistrer</Button>}
    </Panel>
  );
}

export function SiteImagesPanel({ settings, onSaved }: { settings: Settings; onSaved: (s: Settings) => void }) {
  const { notify } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const upload = async (kind: 'logo' | 'hero' | 'repair' | 'phones' | 'shop', file: File | undefined) => {
    if (!file) return;
    setBusy(kind);
    const form = new FormData();
    form.set('file', file);
    form.set('kind', kind);
    try {
      onSaved(await api.post<Settings>('/settings/image', form));
      notify('Image remplacée.');
    } catch (err) {
      notify(errorMessage(err), 'bad');
    } finally {
      setBusy(null);
    }
  };
  const items: { kind: 'logo' | 'hero' | 'repair' | 'phones' | 'shop'; label: string; url: string | null; hint: string; altKey?: string }[] = [
    { kind: 'hero', label: 'Photo d’accueil principale', url: settings.heroImageUrl as string | null, hint: 'Grande image de la mosaïque d’accueil.', altKey: 'heroImageAlt' },
    { kind: 'phones', label: 'Photo « Téléphones »', url: settings.phonesImageUrl as string | null, hint: 'Accueil (mosaïque) et vignette Téléphones.', altKey: 'phonesImageAlt' },
    { kind: 'repair', label: 'Photo de l’atelier', url: settings.repairImageUrl as string | null, hint: 'Section « Réparation » de l’accueil.', altKey: 'repairImageAlt' },
    { kind: 'shop', label: 'Photo de la boutique', url: settings.shopImageUrl as string | null, hint: 'Page « Boutique ».', altKey: 'shopImageAlt' },
    { kind: 'logo', label: 'Logo', url: settings.logoUrl as string | null, hint: 'Facultatif : sans logo, le nom s’affiche en typographie.' },
  ];
  return (
    <Panel title="Photos du site">
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
        {items.map((it) => (
          <li key={it.kind}>
            <p className="text-[13.5px] font-medium">{it.label}</p>
            <div className="relative mt-2 aspect-[4/3] overflow-hidden rounded-xs bg-paper-2">
              {it.url ? <Image src={it.url} alt="" fill sizes="300px" className={it.kind === 'logo' ? 'object-contain p-6' : 'object-cover'} /> : <span className="flex h-full items-center justify-center text-[12.5px] text-faint">Aucune image</span>}
            </div>
            <label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 text-[13px] text-accent underline">
              {busy === it.kind ? <Spinner className="size-3.5" /> : <ImagePlus className="size-3.5" />}
              Remplacer
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => upload(it.kind, e.target.files?.[0])} />
            </label>
            <p className="mt-1 text-[12px] text-muted">{it.hint}</p>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
