'use client';

import type { BrandWithModels } from '@/lib/admin-types';
import { Field, Input } from '@/components/ui/field';

export interface DeviceValue {
  brandId: string;
  brandName: string;
  modelId: string;
  modelName: string;
  /** Marque absente du référentiel (saisie libre). */
  customBrand: boolean;
  /** Modèle absent du référentiel (saisie libre : pas de tarif automatique). */
  customModel: boolean;
}

export const emptyDevice: DeviceValue = { brandId: '', brandName: '', modelId: '', modelName: '', customBrand: false, customModel: false };

/** Comparaison tolérante : casse, accents, espaces et tirets ignorés. */
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Marque et modèle saisis librement, avec suggestions tirées du référentiel.
 * Une saisie qui correspond à un modèle connu y est rattachée (tarifs automatiques) ; sinon elle est conservée telle quelle.
 */
export function DeviceFields({ brands, value, onChange }: { brands: BrandWithModels[]; value: DeviceValue; onChange: (v: DeviceValue) => void }) {
  const activeBrands = brands.filter((b) => b.active);
  const brand = brands.find((b) => b.id === value.brandId);
  const models = brand?.models.filter((m) => m.active) ?? [];

  const setModel = (name: string, b = brand) => {
    const m = b?.models.find((x) => x.active && norm(x.name) === norm(name) && norm(name) !== '');
    return { modelId: m?.id ?? '', modelName: m?.name ?? name, customModel: !m };
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Marque" hint={value.customBrand && value.brandName.trim() ? 'Nouvelle marque : elle sera ajoutée à la liste.' : undefined}>
        {(p) => (
          <>
            <Input
              {...p}
              required
              list="marques-connues"
              autoComplete="off"
              maxLength={60}
              placeholder="Ex. Samsung"
              value={value.brandName}
              onChange={(e) => {
                const name = e.target.value;
                const b = brands.find((x) => norm(x.name) === norm(name) && norm(name) !== '');
                onChange({ ...value, brandId: b?.id ?? '', brandName: b ? b.name : name, customBrand: !b, ...setModel(value.modelName, b) });
              }}
            />
            <datalist id="marques-connues">
              {activeBrands.map((b) => (
                <option key={b.id} value={b.name} />
              ))}
            </datalist>
          </>
        )}
      </Field>
      <Field label="Modèle" hint={value.customModel && value.modelName.trim() ? 'Hors liste : tarif sur diagnostic.' : undefined}>
        {(p) => (
          <>
            <Input
              {...p}
              required
              list="modeles-connus"
              autoComplete="off"
              maxLength={80}
              placeholder={models[0] ? `Ex. ${models[0].name}` : 'Ex. Galaxy A15 5G'}
              value={value.modelName}
              onChange={(e) => onChange({ ...value, ...setModel(e.target.value) })}
            />
            <datalist id="modeles-connus">
              {models.map((m) => (
                <option key={m.id} value={m.name} />
              ))}
            </datalist>
          </>
        )}
      </Field>
    </div>
  );
}
