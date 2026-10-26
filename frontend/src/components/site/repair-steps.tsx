'use client';

import { ArrowRight, Check, ScanSearch } from 'lucide-react';
import { useState } from 'react';
import type { RepairCatalog, RepairEstimate, ShopBrand } from '@/lib/types';
import { cn } from '@/lib/cn';
import { detectDevice } from '@/lib/detect-device';
import { formatDuration, formatPrice } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { WhatsAppButton } from './whatsapp';

export type Brand = ShopBrand;
export type Model = { id: string; name: string };
export type RepairType = RepairCatalog['types'][number];
export type ModelPrice = RepairEstimate & { repairTypeId: string };

const choice =
  'flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border bg-surface px-5 py-3 text-left text-[15px] transition-all hover:-translate-y-0.5 hover:border-navy hover:shadow-card focus-visible:border-accent';

export function StepTitle({ n, title, hint }: { n: number; title: string; hint?: string }) {
  return (
    <div className="mb-5">
      <p className="font-mono text-[12px] text-faint">Étape {n}</p>
      <h2 className="display mt-1 text-[26px] sm:text-[30px]">{title}</h2>
      {hint && <p className="mt-1.5 text-[14px] text-muted">{hint}</p>}
    </div>
  );
}

/** Téléphone saisi par le client ; `model` vaut null quand il ne le connaît pas. */
export interface DeviceInput {
  brand: string;
  model: string | null;
  /** Référence fournie par le navigateur (« SM-A546B »…), transmise telle quelle à la boutique. */
  reference: string | null;
}

export function DeviceStep({ brands, initial, onSubmit }: { brands: Brand[]; initial: DeviceInput; onSubmit: (d: DeviceInput) => void }) {
  const [brand, setBrand] = useState(initial.brand);
  const [model, setModel] = useState(initial.model ?? '');
  const [reference, setReference] = useState(initial.reference);
  const [help, setHelp] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [detectNote, setDetectNote] = useState<string | null>(null);
  const known = brands.find((b) => sameName(b.name, brand));

  const detect = async () => {
    setDetecting(true);
    setDetectNote(null);
    const d = await detectDevice();
    setDetecting(false);
    if (!d) return setDetectNote('Détection impossible sur cet appareil : ouvrez cette page sur le téléphone à réparer, ou saisissez le modèle.');
    if (d.brand) setBrand(d.brand);
    if (d.iphone) {
      setHelp(true);
      return setDetectNote('iPhone détecté. Le modèle exact se lit dans Réglages › Général › Informations › Nom du modèle.');
    }
    if (d.model) {
      setModel(d.model);
      setReference(d.model);
      setDetectNote(`Référence détectée : ${d.model}. Corrigez-la si vous connaissez le nom commercial.`);
    }
  };

  const submit = (withModel: boolean) => {
    if (!brand.trim()) return;
    onSubmit({ brand: brand.trim(), model: withModel ? model.trim() : null, reference: withModel && reference === model.trim() ? reference : null });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (model.trim()) submit(true);
      }}
    >
      <StepTitle n={1} title="Votre téléphone" />
      <button type="button" onClick={detect} disabled={detecting} className="glass-dark mb-5 flex min-h-16 w-full items-center justify-between gap-3 rounded-2xl px-5 py-3 text-left text-[15px] text-white transition-transform hover:-translate-y-0.5 disabled:opacity-70">
        <span className="flex items-center gap-3">
          <ScanSearch className="size-5 shrink-0" strokeWidth={1.8} />
          <span>
            <span className="block font-medium">{detecting ? 'Détection…' : 'Détecter ce téléphone'}</span>
            <span className="block text-[13px] text-white/75">Si vous êtes sur le téléphone à réparer</span>
          </span>
        </span>
        <ArrowRight className="size-4 text-white/70" />
      </button>
      {detectNote && <p className="-mt-2 mb-5 text-[13.5px] text-ink-2" role="status">{detectNote}</p>}

      <ul className="mb-3 flex flex-wrap gap-2" aria-label="Marques courantes">
        {brands.map((b) => (
          <li key={b.id}>
            <button type="button" onClick={() => setBrand(b.name)} aria-pressed={sameName(b.name, brand)} className={cn('h-9 rounded-full border px-4 text-[14px] transition-colors', sameName(b.name, brand) ? 'border-navy bg-navy text-white' : 'border-line-2 bg-surface hover:border-navy')}>
              {b.name}
            </button>
          </li>
        ))}
      </ul>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Marque">{(p) => <Input {...p} value={brand} onChange={(e) => setBrand(e.target.value)} required maxLength={60} placeholder="Ex. Samsung" autoComplete="off" />}</Field>
        <Field label="Modèle">
          {(p) => (
            <>
              <Input {...p} value={model} onChange={(e) => setModel(e.target.value)} maxLength={80} placeholder={known?.models[0] ? `Ex. ${known.models[0].name}` : 'Ex. Galaxy A54'} list="modeles-connus" autoComplete="off" />
              <datalist id="modeles-connus">
                {known?.models.map((m) => <option key={m.id} value={m.name} />)}
              </datalist>
            </>
          )}
        </Field>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
        <Button type="submit" disabled={!brand.trim() || !model.trim()}>
          Continuer
        </Button>
        <button type="button" onClick={() => setHelp((v) => !v)} aria-expanded={help} className="text-[14px] font-medium text-accent underline">
          Je ne connais pas le modèle
        </button>
      </div>

      {help && (
        <div className="glass-light mt-5 rounded-2xl p-5 text-[14px] text-ink-2">
          <p className="font-medium text-ink">Où trouver le modèle ?</p>
          <ul className="mt-2 space-y-1.5">
            <li>• iPhone : Réglages › Général › Informations › Nom du modèle</li>
            <li>• Android : Paramètres › À propos du téléphone</li>
            <li>• Sur la boîte, ou sur l’étiquette sous la batterie</li>
          </ul>
          <button type="button" onClick={() => submit(false)} disabled={!brand.trim()} className="mt-4 inline-flex items-center gap-1.5 font-medium text-accent underline disabled:opacity-50">
            Continuer sans le modèle <ArrowRight className="size-4" />
          </button>
          {!brand.trim() && <p className="mt-1 text-[13px] text-muted">Indiquez au moins la marque.</p>}
        </div>
      )}
    </form>
  );
}

/** Comparaison tolérante : casse, accents, espaces et tirets ignorés. */
export function normalizeName(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}
function sameName(a: string, b: string) {
  return normalizeName(a) === normalizeName(b) && normalizeName(a) !== '';
}

/** Modèle du catalogue correspondant à la saisie (« A54 » → « Galaxy A54 »), s'il est unique. */
export function matchModel(brand: Brand | undefined, typed: string | null): Model | null {
  if (!brand || !typed) return null;
  const t = normalizeName(typed);
  const exact = brand.models.find((m) => normalizeName(m.name) === t);
  if (exact) return exact;
  if (t.length < 3) return null;
  const ends = brand.models.filter((m) => normalizeName(m.name).endsWith(t));
  return ends.length === 1 ? ends[0] : null;
}

export function IssueStep({ types, prices, loadingPrices, onPick }: { types: RepairType[]; prices: ModelPrice[] | null; loadingPrices: boolean; onPick: (t: RepairType) => void }) {
  return (
    <div>
      <StepTitle n={2} title="La panne" />
      <ul className="divide-y divide-line border-y border-line">
        {types.map((t) => {
          const price = prices?.find((p) => p.repairTypeId === t.id);
          return (
            <li key={t.id}>
              <button type="button" onClick={() => onPick(t)} className="group flex w-full items-center justify-between gap-4 py-4 text-left">
                <span>
                  <span className="block text-[15.5px] font-medium text-ink group-hover:underline">{t.name}</span>
                </span>
                <span className="shrink-0 text-right">
                  {loadingPrices ? (
                    <span className="block h-4 w-16 animate-pulse rounded-xs bg-paper-2" />
                  ) : price ? (
                    <span className="num block text-[15px] font-semibold">{formatPrice(price.totalPrice)}</span>
                  ) : (
                    <span className="block text-[13px] text-muted">Sur diagnostic</span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function EstimateStep({ estimate, deviceLabel, issueLabel, whatsappHref }: { estimate: RepairEstimate | null; deviceLabel: string; issueLabel: string; whatsappHref: string }) {
  return (
    <div>
      <StepTitle n={3} title={`${deviceLabel} — ${issueLabel}`} />
      {estimate ? (
        <div className="glass-light rounded-3xl p-6">
          <p className="text-[13px] text-muted">Prix estimé</p>
          <p className="num mt-1 text-[40px] font-semibold leading-none text-accent">{formatPrice(estimate.totalPrice)}</p>
          <p className="mt-3 text-[13.5px] text-muted">
            Pièces {formatPrice(estimate.partsPrice)} · main-d’œuvre {formatPrice(estimate.laborPrice)}
            {estimate.durationMinutes ? ` · ${formatDuration(estimate.durationMinutes)}` : ''}
          </p>
          {estimate.conditions && <p className="mt-1 text-[13.5px] text-muted">{estimate.conditions}</p>}
        </div>
      ) : (
        <div className="glass-light rounded-3xl p-6">
          <p className="text-[17px] font-medium">Cette réparation nécessite une estimation personnalisée.</p>
        </div>
      )}
      <p className="mt-4 flex items-start gap-2 text-[13.5px] text-muted">
        <Check className="mt-0.5 size-4 shrink-0 text-ok" />
        Prix confirmé après diagnostic, avant toute intervention.
      </p>
      <WhatsAppButton href={whatsappHref} className="mt-6 w-full sm:w-auto">
        Envoyer ma demande sur WhatsApp
      </WhatsAppButton>
    </div>
  );
}
