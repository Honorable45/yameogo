'use client';

import { ArrowLeft } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import type { RepairCatalog, RepairEstimate } from '@/lib/types';
import { cn } from '@/lib/cn';
import { formatPrice } from '@/lib/format';
import { waLink } from '@/lib/whatsapp';
import { DeviceStep, EstimateStep, IssueStep, matchModel, normalizeName, type DeviceInput, type ModelPrice, type RepairType } from './repair-steps';

type Step = 'device' | 'issue' | 'estimate';
const STEPS: Step[] = ['device', 'issue', 'estimate'];

/**
 * Devis de réparation : téléphone (saisi librement ou détecté), panne, estimation.
 * Le prix s'affiche si le modèle saisi correspond à un tarif enregistré ; sinon « sur diagnostic ».
 * La demande part ensuite directement sur le WhatsApp de la boutique, avec un message pré-rempli.
 */
export function RepairWizard({ catalog, initialBrand, whatsapp }: { catalog: RepairCatalog; initialBrand?: string; whatsapp: string | null }) {
  const [step, setStep] = useState<Step>('device');
  const [device, setDevice] = useState<DeviceInput>(() => ({
    brand: catalog.brands.find((b) => b.slug === initialBrand)?.name ?? '',
    model: null,
    reference: null,
  }));
  const [type, setType] = useState<RepairType | null>(null);
  const [prices, setPrices] = useState<ModelPrice[] | null>(null);
  const [loadingPrices, setLoadingPrices] = useState(false);
  const top = useRef<HTMLDivElement>(null);

  const brand = catalog.brands.find((b) => normalizeName(b.name) === normalizeName(device.brand));
  const model = matchModel(brand, device.model);

  useEffect(() => {
    if (!model) return setPrices(null);
    setLoadingPrices(true);
    api
      .get<ModelPrice[]>(`/repair-catalog/models/${model.id}/prices`)
      .then(setPrices)
      .catch(() => setPrices([]))
      .finally(() => setLoadingPrices(false));
  }, [model?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (next: Step) => {
    setStep(next);
    requestAnimationFrame(() => top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const deviceLabel = [brand?.name ?? device.brand, model?.name ?? device.model ?? 'modèle à identifier'].join(' ');
  const estimate: RepairEstimate | null = (type && prices?.find((p) => p.repairTypeId === type.id)) || null;
  const current = STEPS.indexOf(step);
  const message = type
    ? [
        'Bonjour YAMEOGO, je souhaite un devis de réparation :',
        `• Téléphone : ${[brand?.name ?? device.brand, model?.name ?? device.model].filter(Boolean).join(' ')}`,
        device.reference ? `• Référence détectée : ${device.reference}` : null,
        device.model ? null : '• Modèle : je ne le connais pas, je vous envoie une photo du téléphone',
        `• Panne : ${type.name}`,
        estimate ? `• Estimation affichée sur le site : ${formatPrice(estimate.totalPrice)}` : '• Estimation personnalisée demandée',
      ]
        .filter(Boolean)
        .join('\n')
    : '';

  return (
    <div ref={top} className="mx-auto max-w-3xl scroll-mt-28">
      <ol className="mb-8 grid grid-cols-3 gap-1.5" aria-label="Progression">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === current ? 'step' : undefined}>
            <span className={cn('block h-1 rounded-full transition-colors', i <= current ? 'bg-ochre' : 'bg-line')} />
          </li>
        ))}
      </ol>
      {step !== 'device' && (
        <button type="button" onClick={() => go(STEPS[current - 1])} className="mb-4 inline-flex items-center gap-1.5 text-[14px] text-muted hover:text-ink">
          <ArrowLeft className="size-4" /> Étape précédente
        </button>
      )}
      <div key={step} className="animate-slide-up">
        {step === 'device' && (
          <DeviceStep
            brands={catalog.brands}
            initial={device}
            onSubmit={(d) => {
              setDevice(d);
              go('issue');
            }}
          />
        )}
        {step === 'issue' && (
          <IssueStep
            types={catalog.types}
            prices={model ? prices : []}
            loadingPrices={Boolean(model) && loadingPrices}
            onPick={(t) => {
              setType(t);
              go('estimate');
            }}
          />
        )}
        {step === 'estimate' && type && <EstimateStep estimate={estimate} deviceLabel={deviceLabel} issueLabel={type.name} whatsappHref={waLink(whatsapp, message)} />}
      </div>
    </div>
  );
}
