'use client';

import { useEffect, useMemo, useState } from 'react';
import { useCan } from '@/components/admin/session';
import { PageHeader, SearchInput } from '@/components/admin/ui';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/empty-state';
import { Input, MoneyInput, Select } from '@/components/ui/field';
import { LoadingBlock } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/api';
import type { BrandWithModels, RepairTypeRow } from '@/lib/admin-types';
import { cn } from '@/lib/cn';
import { formatPrice } from '@/lib/format';
import { useResource } from '@/lib/use-resource';

interface Price {
  id: string;
  phoneModelId: string;
  repairTypeId: string;
  partsPrice: number;
  laborPrice: number;
  totalPrice: number;
  durationMinutes: number | null;
  conditions: string | null;
  active: boolean;
}

function PriceRow({ type, price, modelId, editable, onSaved }: { type: RepairTypeRow; price?: Price; modelId: string; editable: boolean; onSaved: () => void }) {
  const { notify } = useToast();
  const [parts, setParts] = useState(String(price?.partsPrice ?? ''));
  const [labor, setLabor] = useState(String(price?.laborPrice ?? ''));
  const [minutes, setMinutes] = useState(String(price?.durationMinutes ?? ''));
  const [conditions, setConditions] = useState(price?.conditions ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setParts(String(price?.partsPrice ?? ''));
    setLabor(String(price?.laborPrice ?? ''));
    setMinutes(String(price?.durationMinutes ?? ''));
    setConditions(price?.conditions ?? '');
  }, [price]);

  const dirty = parts !== String(price?.partsPrice ?? '') || labor !== String(price?.laborPrice ?? '') || minutes !== String(price?.durationMinutes ?? '') || conditions !== (price?.conditions ?? '');
  const total = (Number(parts) || 0) + (Number(labor) || 0);

  const save = async (active = true) => {
    setSaving(true);
    try {
      await api.put('/repair-pricing/prices', {
        phoneModelId: modelId,
        repairTypeId: type.id,
        partsPrice: Number(parts) || 0,
        laborPrice: Number(labor) || 0,
        durationMinutes: minutes ? Number(minutes) : null,
        conditions: conditions.trim() || null,
        active,
      });
      notify(`Tarif « ${type.name} » enregistré.`);
      onSaved();
    } catch (err) {
      notify(errorMessage(err), 'bad');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!price) return;
    try {
      await api.delete(`/repair-pricing/prices/${price.id}`);
      notify('Tarif supprimé : la panne s’affichera « sur diagnostic ».');
      onSaved();
    } catch (err) {
      notify(errorMessage(err), 'bad');
    }
  };

  if (!editable) {
    return (
      <tr className="border-b border-line last:border-0">
        <td className="py-3 pl-5 pr-3 text-[14px]">{type.name}</td>
        <td className="num px-3 text-right">{price ? formatPrice(price.partsPrice) : '—'}</td>
        <td className="num px-3 text-right">{price ? formatPrice(price.laborPrice) : '—'}</td>
        <td className="num px-3 text-right font-semibold">{price ? formatPrice(price.totalPrice) : <span className="font-normal text-muted">Sur diagnostic</span>}</td>
        <td className="px-3 pr-5 text-[13px] text-muted">{price?.durationMinutes ? `${price.durationMinutes} min` : ''}</td>
      </tr>
    );
  }

  return (
    <tr className={cn('border-b border-line align-top last:border-0', price && !price.active && 'opacity-60')}>
      <td className="min-w-[10.5rem] py-3 pl-5 pr-3">
        <p className="text-[14px] font-medium">{type.name}</p>
        {price && !price.active && <p className="text-[12px] text-warn">Désactivé (non affiché)</p>}
      </td>
      <td className="px-2 py-2"><MoneyInput value={parts} onChange={(e) => setParts(e.target.value)} aria-label={`Pièces — ${type.name}`} className="min-w-28" /></td>
      <td className="px-2 py-2"><MoneyInput value={labor} onChange={(e) => setLabor(e.target.value)} aria-label={`Main-d’œuvre — ${type.name}`} className="min-w-28" /></td>
      <td className="num whitespace-nowrap px-3 py-4 text-right text-[14px] font-semibold">{parts || labor ? formatPrice(total) : <span className="font-normal text-faint">Sur diagnostic</span>}</td>
      <td className="px-2 py-2">
        <Input type="number" min={5} value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="min" aria-label={`Durée en minutes — ${type.name}`} className="num w-20" />
      </td>
      <td className="px-2 py-2">
        <Input value={conditions} onChange={(e) => setConditions(e.target.value)} placeholder="Ex. pièce compatible" aria-label={`Conditions — ${type.name}`} maxLength={500} className="min-w-44" />
      </td>
      <td className="whitespace-nowrap px-2 py-2 pr-5 text-right">
        {dirty && (parts || labor) ? (
          <Button size="sm" onClick={() => save(true)} loading={saving}>
            Enregistrer
          </Button>
        ) : price ? (
          <span className="inline-flex gap-2 pt-2 text-[12.5px]">
            <button type="button" className="text-muted underline" onClick={() => save(!price.active)}>
              {price.active ? 'Désactiver' : 'Activer'}
            </button>
            <button type="button" className="text-muted underline hover:text-bad" onClick={remove}>
              Supprimer
            </button>
          </span>
        ) : null}
      </td>
    </tr>
  );
}

export default function PricingPage() {
  const can = useCan();
  const editable = can('repairPricing.manage');
  const brands = useResource<BrandWithModels[]>('/brands');
  const types = useResource<RepairTypeRow[]>('/repair-pricing/types');
  const [brandId, setBrandId] = useState('');
  const [modelId, setModelId] = useState('');
  const [q, setQ] = useState('');
  const prices = useResource<Price[]>(brandId ? `/repair-pricing/prices?brandId=${brandId}` : null);

  useEffect(() => {
    if (!brandId && brands.data?.length) setBrandId(brands.data[0].id);
  }, [brands.data, brandId]);
  const brand = brands.data?.find((b) => b.id === brandId);
  const models = useMemo(() => (brand?.models ?? []).filter((m) => m.name.toLowerCase().includes(q.toLowerCase())), [brand, q]);
  useEffect(() => {
    if (brand && !brand.models.find((m) => m.id === modelId)) setModelId(brand.models[0]?.id ?? '');
  }, [brand, modelId]);

  if (brands.error || types.error) return <ErrorState message={(brands.error ?? types.error)!} />;
  if (!brands.data || !types.data) return <LoadingBlock />;
  const countFor = (id: string) => prices.data?.filter((p) => p.phoneModelId === id && p.active).length ?? 0;
  const model = brand?.models.find((m) => m.id === modelId);

  return (
    <>
      <PageHeader
        title="Tarifs de réparation"
      />
      <div className="grid gap-6 lg:grid-cols-[17rem_1fr]">
        <aside className="rounded-md border border-line bg-surface">
          <div className="space-y-2 border-b border-line p-3">
            <Select value={brandId} onChange={(e) => setBrandId(e.target.value)} aria-label="Marque">
              {brands.data.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
            <SearchInput value={q} onChange={setQ} placeholder="Filtrer les modèles" />
          </div>
          <ul className="max-h-[60vh] overflow-y-auto p-1.5">
            {models.map((m) => (
              <li key={m.id}>
                <button type="button" onClick={() => setModelId(m.id)} className={cn('flex w-full items-center justify-between rounded-sm px-2.5 py-2 text-left text-[14px]', m.id === modelId ? 'bg-paper-2 font-medium' : 'hover:bg-paper')}>
                  {m.name}
                  <span className="num text-[12px] text-faint">{countFor(m.id) || ''}</span>
                </button>
              </li>
            ))}
            {!models.length && <li className="px-3 py-4 text-[13px] text-muted">Aucun modèle. Ajoutez-en dans Paramètres › Marques et modèles.</li>}
          </ul>
        </aside>
        <section className="min-w-0 rounded-md border border-line bg-surface">
          <div className="border-b border-line px-5 py-3">
            <h2 className="text-[15px] font-medium">{model ? `${brand?.name} ${model.name}` : 'Choisissez un modèle'}</h2>
            <p className="text-[12.5px] text-muted">Total = pièces + main-d’œuvre, calculé par le serveur.</p>
          </div>
          {model && prices.data ? (
            <div className="overflow-x-auto">
              <table className="w-full text-[14px]">
                <thead>
                  <tr className="border-b border-line text-left text-[11.5px] uppercase tracking-[0.08em] text-muted">
                    <th className="h-10 pl-5 pr-3 font-medium">Panne</th>
                    <th className="px-3 text-right font-medium">Pièces</th>
                    <th className="px-3 text-right font-medium">Main-d’œuvre</th>
                    <th className="px-3 text-right font-medium">Total</th>
                    <th className="px-3 font-medium">Durée</th>
                    {editable && <th className="px-3 font-medium">Conditions</th>}
                    {editable && <th className="pr-5" />}
                  </tr>
                </thead>
                <tbody>
                  {types.data
                    .filter((t) => t.active)
                    .map((t) => (
                      <PriceRow key={t.id} type={t} modelId={model.id} editable={editable} price={prices.data!.find((p) => p.phoneModelId === model.id && p.repairTypeId === t.id)} onSaved={prices.reload} />
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            model && <LoadingBlock />
          )}
        </section>
      </div>
    </>
  );
}
