'use client';

import { useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import type { BrandWithModels, CategoryRow, RepairTypeRow } from '@/lib/admin-types';
import { cn } from '@/lib/cn';
import { useResource } from '@/lib/use-resource';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/field';
import { LoadingBlock } from '@/components/ui/spinner';
import { Tag } from '@/components/ui/status';
import { useToast } from '@/components/ui/toast';
import { Panel } from '../ui';

/** Ligne éditable : nom + activation (rien n'est supprimé : désactiver conserve l'historique). */
function EditableRow({ name, active, meta, onSave }: { name: string; active: boolean; meta?: string; onSave: (patch: { name?: string; active?: boolean }) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  return (
    <li className={cn('flex items-center gap-3 px-4 py-2 sm:px-5', !active && 'text-muted')}>
      {editing ? (
        <>
          <Input value={value} onChange={(e) => setValue(e.target.value)} className="h-9 flex-1 sm:h-9" autoFocus maxLength={80} />
          <Button size="sm" onClick={async () => { await onSave({ name: value.trim() }); setEditing(false); }} disabled={value.trim().length < 1}>OK</Button>
          <Button size="sm" variant="ghost" onClick={() => { setValue(name); setEditing(false); }}>Annuler</Button>
        </>
      ) : (
        <>
          <span className="flex-1 text-[14px]">
            {name}
            {meta && <span className="ml-2 text-[12px] text-faint">{meta}</span>}
            {!active && <Tag className="ml-2">Désactivé</Tag>}
          </span>
          <button type="button" className="text-[12.5px] text-muted underline" onClick={() => setEditing(true)}>Renommer</button>
          <button type="button" className="text-[12.5px] text-muted underline" onClick={() => onSave({ active: !active })}>{active ? 'Désactiver' : 'Activer'}</button>
        </>
      )}
    </li>
  );
}

function AddRow({ placeholder, onAdd }: { placeholder: string; onAdd: (name: string) => Promise<void> }) {
  const [value, setValue] = useState('');
  return (
    <form
      className="flex gap-2 border-t border-line p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!value.trim()) return;
        await onAdd(value.trim());
        setValue('');
      }}
    >
      <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} maxLength={80} />
      <Button type="submit" variant="secondary" disabled={!value.trim()}>Ajouter</Button>
    </form>
  );
}

function useAction() {
  const { notify } = useToast();
  return async (fn: () => Promise<unknown>, ok: string, reload: () => void) => {
    try {
      await fn();
      notify(ok);
      reload();
    } catch (err) {
      notify(errorMessage(err), 'bad');
    }
  };
}

export function CategoriesPanel() {
  const run = useAction();
  const [kind, setKind] = useState<'ACCESSORY' | 'PART'>('ACCESSORY');
  const { data, reload } = useResource<CategoryRow[]>('/categories');
  if (!data) return <LoadingBlock />;
  return (
    <Panel title="Catégories" bodyClassName="" actions={
      <Select value={kind} onChange={(e) => setKind(e.target.value as 'ACCESSORY' | 'PART')} className="h-9 w-48 sm:h-9" aria-label="Type">
        <option value="ACCESSORY">Accessoires (boutique)</option>
        <option value="PART">Pièces détachées</option>
      </Select>
    }>
      <ul className="divide-y divide-line">
        {data.filter((c) => c.kind === kind).map((c) => (
          <EditableRow key={c.id} name={c.name} active={c.active} meta={`${c._count.products} article(s)`} onSave={(patch) => run(() => api.patch(`/categories/${c.id}`, patch), 'Catégorie mise à jour.', reload)} />
        ))}
      </ul>
      <AddRow placeholder="Nouvelle catégorie" onAdd={(name) => run(() => api.post('/categories', { name, kind }), 'Catégorie ajoutée.', reload)} />
    </Panel>
  );
}

export function BrandsPanel() {
  const run = useAction();
  const { data, reload } = useResource<BrandWithModels[]>('/brands');
  const [brandId, setBrandId] = useState('');
  if (!data) return <LoadingBlock />;
  const brand = data.find((b) => b.id === brandId) ?? data[0];
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel title="Marques" bodyClassName="">
        <ul className="divide-y divide-line">
          {data.map((b) => (
            <li key={b.id} className={cn(brand?.id === b.id && 'bg-paper')}>
              <div className="flex items-center">
                <button type="button" onClick={() => setBrandId(b.id)} className="flex-1 px-5 py-2 text-left text-[14px]">
                  {b.name} <span className="text-[12px] text-faint">{b.models.length} modèle(s)</span>
                  {!b.active && <Tag className="ml-2">Désactivée</Tag>}
                </button>
                <button type="button" className="px-4 text-[12.5px] text-muted underline" onClick={() => run(() => api.patch(`/brands/${b.id}`, { active: !b.active }), 'Marque mise à jour.', reload)}>
                  {b.active ? 'Désactiver' : 'Activer'}
                </button>
              </div>
            </li>
          ))}
        </ul>
        <AddRow placeholder="Nouvelle marque" onAdd={(name) => run(() => api.post('/brands', { name, position: data.length }), 'Marque ajoutée.', reload)} />
      </Panel>
      {brand && (
        <Panel title={`Modèles ${brand.name}`} bodyClassName="">
          <ul className="max-h-[28rem] divide-y divide-line overflow-y-auto">
            {brand.models.map((m) => (
              <EditableRow key={m.id} name={m.name} active={m.active} onSave={(patch) => run(() => api.patch(`/brands/models/${m.id}`, patch), 'Modèle mis à jour.', reload)} />
            ))}
          </ul>
          <AddRow placeholder={`Nouveau modèle ${brand.name}`} onAdd={(name) => run(() => api.post(`/brands/${brand.id}/models`, { name, position: brand.models.length }), 'Modèle ajouté.', reload)} />
        </Panel>
      )}
    </div>
  );
}

export function RepairTypesPanel() {
  const run = useAction();
  const { data, reload } = useResource<RepairTypeRow[]>('/repair-pricing/types');
  if (!data) return <LoadingBlock />;
  return (
    <Panel title="Types de panne" bodyClassName="">
      <p className="px-5 pt-4 text-[13.5px] text-muted">Proposés dans le devis en ligne et dans les dossiers. Les tarifs se règlent dans « Tarifs de réparation ».</p>
      <ul className="mt-2 divide-y divide-line">
        {data.map((t) => (
          <EditableRow key={t.id} name={t.name} active={t.active} onSave={(patch) => run(() => api.patch(`/repair-pricing/types/${t.id}`, patch), 'Type de panne mis à jour.', reload)} />
        ))}
      </ul>
      <AddRow placeholder="Nouveau type de panne" onAdd={(name) => run(() => api.post('/repair-pricing/types', { name, position: data.length }), 'Type de panne ajouté.', reload)} />
    </Panel>
  );
}
