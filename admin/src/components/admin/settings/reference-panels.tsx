'use client';

import { useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import type { BrandRow, CategoryRow } from '@/lib/admin-types';
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
  const [kind, setKind] = useState<'PHONE' | 'ACCESSORY'>('ACCESSORY');
  const { data, reload } = useResource<CategoryRow[]>('/categories');
  if (!data) return <LoadingBlock />;
  return (
    <Panel title="Catégories" bodyClassName="" actions={
      <Select value={kind} onChange={(e) => setKind(e.target.value as 'PHONE' | 'ACCESSORY')} className="h-9 w-48 sm:h-9" aria-label="Type">
        <option value="ACCESSORY">Accessoires</option>
        <option value="PHONE">Smartphones</option>
      </Select>
    }>
      <ul className="divide-y divide-line">
        {data.filter((c) => c.kind === kind).map((c) => (
          <EditableRow key={c.id} name={c.name} active={c.active} meta={`${c._count.groups ?? c._count.products} produit(s)`} onSave={(patch) => run(() => api.patch(`/categories/${c.id}`, patch), 'Catégorie mise à jour.', reload)} />
        ))}
      </ul>
      <AddRow placeholder="Nouvelle catégorie" onAdd={(name) => run(() => api.post('/categories', { name, kind }), 'Catégorie ajoutée.', reload)} />
    </Panel>
  );
}

export function BrandsPanel() {
  const run = useAction();
  const { data, reload } = useResource<BrandRow[]>('/brands');
  if (!data) return <LoadingBlock />;
  return (
    <Panel title="Marques" bodyClassName="">
      <p className="px-5 pt-4 text-[13.5px] text-muted">Proposées dans les filtres du site. Une marque saisie sur une fiche produit est ajoutée automatiquement.</p>
      <ul className="mt-2 divide-y divide-line">
        {data.map((b) => (
          <EditableRow key={b.id} name={b.name} active={b.active} meta={`${b._count.groups} produit(s)`} onSave={(patch) => run(() => api.patch(`/brands/${b.id}`, patch), 'Marque mise à jour.', reload)} />
        ))}
      </ul>
      <AddRow placeholder="Nouvelle marque" onAdd={(name) => run(() => api.post('/brands', { name, position: data.length }), 'Marque ajoutée.', reload)} />
    </Panel>
  );
}
