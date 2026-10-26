'use client';

import { Copy, Plus, Trash2, Wand2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState, type FormEvent } from 'react';
import { api, errorMessage } from '@/lib/api';
import type { BrandRow, CategoryRow, Condition, GroupDetail, ProductKind } from '@/lib/admin-types';
import { cn } from '@/lib/cn';
import { formatAmount, formatPrice } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, FormError, Input, MoneyInput, Select, Textarea } from '@/components/ui/field';
import { Tag } from '@/components/ui/status';
import { useToast } from '@/components/ui/toast';
import { useCan } from './session';
import { Panel } from './ui';

interface VariantDraft {
  key: string;
  id?: string;
  sku?: string;
  color: string;
  colorHex: string;
  ramGb: string;
  storageGb: string;
  condition: '' | Condition;
  optionValue: string;
  salePrice: string;
  compareAtPrice: string;
  active: boolean;
  stock: string;
  unitCost: string;
  /** Valeurs actuelles (configurations existantes) : servent à détecter un changement de stock. */
  currentStock?: number;
  reserved?: number;
  averageCost?: number | null;
}

/** Pastilles proposées automatiquement pour les noms de couleur courants (modifiables). */
const COLOR_HEX: Record<string, string> = {
  noir: '#1d1d1f', minuit: '#1f2229', graphite: '#3b3d42', blanc: '#f5f5f2', 'lumiere stellaire': '#f1ece4', gris: '#8a8d91', argent: '#c7c9cc',
  bleu: '#2f4a73', 'bleu ciel': '#a7d8de', vert: '#3d6b4f', menthe: '#a8d5ba', rouge: '#b3261e', rose: '#f2b8c6', violet: '#6d5a96',
  lavande: '#b9a8d9', or: '#d4b483', jaune: '#f2d14b', orange: '#e8853d', titane: '#8e8a83', creme: '#efe6d2',
};
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

const PHONE_SPECS = ['Écran', 'Processeur', 'Appareil photo', 'Batterie', 'Réseau', 'Système'];

let seq = 0;
const newKey = () => `n${++seq}`;
const emptyVariant = (): VariantDraft => ({ key: newKey(), color: '', colorHex: '', ramGb: '', storageGb: '', condition: '', optionValue: '', salePrice: '', compareAtPrice: '', active: true, stock: '0', unitCost: '' });

const numOrNull = (v: string) => (v.trim() === '' ? null : Number(v));
const comboKey = (v: VariantDraft) => JSON.stringify([norm(v.color), v.ramGb, v.storageGb, v.condition, norm(v.optionValue)]);

export function GroupForm({ kind, group, brands, categories, onSaved }: { kind: ProductKind; group?: GroupDetail; brands: BrandRow[]; categories: CategoryRow[]; onSaved?: (g: GroupDetail) => void }) {
  const router = useRouter();
  const { notify } = useToast();
  const can = useCan();
  const costs = can('costs.read');
  const phone = kind === 'PHONE';

  const [info, setInfo] = useState({
    name: group?.name ?? '',
    brandName: group?.brand?.name ?? '',
    categoryId: group?.category.id ?? (categories.length === 1 ? categories[0].id : ''),
    description: group?.description ?? '',
    compatibleWith: group?.compatibleWith ?? '',
    optionName: group?.optionName ?? '',
    published: group?.published ?? true,
    featured: group?.featured ?? false,
  });
  const [specs, setSpecs] = useState(() =>
    group?.specs.length ? group.specs.map((s) => ({ key: newKey(), ...s })) : phone ? PHONE_SPECS.map((label) => ({ key: newKey(), label, value: '' })) : [],
  );
  const [variants, setVariants] = useState<VariantDraft[]>(() =>
    group?.variants.length
      ? group.variants.map((v) => ({
          key: v.id,
          id: v.id,
          sku: v.sku,
          color: v.color ?? '',
          colorHex: v.colorHex ?? '',
          ramGb: v.ramGb?.toString() ?? '',
          storageGb: v.storageGb?.toString() ?? '',
          condition: v.condition ?? '',
          optionValue: v.optionValue ?? '',
          salePrice: v.salePrice.toString(),
          compareAtPrice: v.compareAtPrice?.toString() ?? '',
          active: v.active,
          stock: v.stockQuantity.toString(),
          unitCost: '',
          currentStock: v.stockQuantity,
          reserved: v.reservedQuantity,
          averageCost: v.averageCost,
        }))
      : [{ ...emptyVariant(), condition: phone ? 'NEW' : '' }],
  );
  const [showGenerator, setShowGenerator] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (k: keyof typeof info) => (e: { target: { value: string } }) => setInfo({ ...info, [k]: e.target.value });
  const update = (key: string, patch: Partial<VariantDraft>) => setVariants((list) => list.map((v) => (v.key === key ? { ...v, ...patch } : v)));
  const duplicates = useMemo(() => {
    const seen = new Map<string, number>();
    for (const v of variants) seen.set(comboKey(v), (seen.get(comboKey(v)) ?? 0) + 1);
    return new Set([...seen].filter(([, n]) => n > 1).map(([k]) => k));
  }, [variants]);
  const colors = [...new Set(variants.map((v) => v.color.trim()).filter(Boolean))];

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!info.name.trim()) return setError('Indiquez le nom du produit.');
    if (phone && !info.brandName.trim()) return setError('Indiquez la marque.');
    if (!info.categoryId) return setError('Choisissez une catégorie.');
    if (duplicates.size) return setError('Deux configurations sont identiques : modifiez ou supprimez le doublon.');
    for (const [i, v] of variants.entries()) {
      if (v.salePrice === '') return setError(`Configuration ${i + 1} : indiquez le prix de vente.`);
      if (v.compareAtPrice && Number(v.compareAtPrice) <= Number(v.salePrice)) return setError(`Configuration ${i + 1} : le prix barré doit être supérieur au prix de vente.`);
      const added = Number(v.stock || 0) - (v.currentStock ?? 0);
      if (added > 0 && !v.unitCost && !v.averageCost) return setError(`Configuration ${i + 1} : indiquez le coût d’achat unitaire des unités ajoutées.`);
    }
    setSaving(true);
    const body = {
      kind,
      name: info.name.trim(),
      brandName: phone || info.brandName.trim() ? info.brandName.trim() || null : null,
      categoryId: info.categoryId,
      description: info.description.trim(),
      specs: specs.filter((s) => s.label.trim() && s.value.trim()).map(({ label, value }) => ({ label: label.trim(), value: value.trim() })),
      optionName: info.optionName.trim() || null,
      compatibleWith: info.compatibleWith.trim() || null,
      published: info.published,
      featured: info.featured,
      variants: variants.map((v) => {
        const stock = Number(v.stock || 0);
        return {
          id: v.id,
          color: v.color.trim() || null,
          colorHex: v.color.trim() ? v.colorHex || null : null,
          ramGb: phone ? numOrNull(v.ramGb) : null,
          storageGb: phone ? numOrNull(v.storageGb) : null,
          condition: phone ? v.condition || null : null,
          optionValue: info.optionName.trim() ? v.optionValue.trim() || null : null,
          salePrice: Number(v.salePrice),
          compareAtPrice: numOrNull(v.compareAtPrice),
          active: v.active,
          // Le stock n'est transmis que s'il change : l'API enregistre alors une entrée ou une correction tracée.
          ...(stock !== (v.currentStock ?? 0) ? { stock, unitCost: v.unitCost ? Number(v.unitCost) : undefined } : {}),
        };
      }),
    };
    try {
      const saved = group ? await api.put<GroupDetail>(`/catalog-groups/${group.id}`, body) : await api.post<GroupDetail>('/catalog-groups', body);
      notify(group ? 'Produit enregistré.' : 'Produit créé. Ajoutez maintenant ses photos.');
      if (group) onSaved?.(saved);
      else router.push(`/catalogue/${saved.id}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <Panel title="Informations">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={phone ? 'Modèle' : 'Nom'} className="sm:col-span-2">
            {(p) => <Input {...p} value={info.name} onChange={set('name')} required minLength={2} maxLength={140} placeholder={phone ? 'Ex. Samsung Galaxy A56' : 'Ex. Coque silicone iPhone 13'} />}
          </Field>
          <Field label="Marque" optional={!phone} hint={phone ? 'Choisissez dans la liste ou saisissez une nouvelle marque.' : undefined}>
            {(p) => (
              <>
                <Input {...p} value={info.brandName} onChange={set('brandName')} list="marques" autoComplete="off" required={phone} maxLength={60} />
                <datalist id="marques">
                  {brands.filter((b) => b.active).map((b) => (
                    <option key={b.id} value={b.name} />
                  ))}
                </datalist>
              </>
            )}
          </Field>
          <Field label="Catégorie">
            {(p) => (
              <Select {...p} value={info.categoryId} onChange={set('categoryId')} required>
                <option value="">Choisir…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Description" optional className="sm:col-span-2">
            {(p) => <Textarea {...p} rows={3} value={info.description} onChange={set('description')} maxLength={4000} placeholder={phone ? 'Points forts du téléphone, en deux ou trois phrases.' : 'Matière, puissance, longueur…'} />}
          </Field>
          {!phone && (
            <Field label="Compatibilité" optional className="sm:col-span-2" hint="Affichée sur la fiche. Ex. « iPhone 13, iPhone 14 » ou « Tous les smartphones USB-C ».">
              {(p) => <Input {...p} value={info.compatibleWith} onChange={set('compatibleWith')} maxLength={300} />}
            </Field>
          )}
          <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:gap-8">
            <Checkbox checked={info.published} onChange={(e) => setInfo({ ...info, published: e.target.checked })} label="Visible sur le site" description="Décochez pour un produit vendu uniquement en boutique." />
            <Checkbox checked={info.featured} onChange={(e) => setInfo({ ...info, featured: e.target.checked })} label="Mettre en avant" description="Affiché en premier sur l’accueil et dans le catalogue." />
          </div>
        </div>
      </Panel>

      <Panel
        title="Caractéristiques techniques"
        actions={
          <Button size="sm" variant="ghost" onClick={() => setSpecs([...specs, { key: newKey(), label: '', value: '' }])}>
            <Plus className="size-4" /> Ajouter
          </Button>
        }
      >
        {specs.length === 0 ? (
          <p className="text-[13.5px] text-muted">Facultatif. Ajoutez les caractéristiques utiles au client (puissance, longueur, matière…).</p>
        ) : (
          <ul className="space-y-2">
            {specs.map((s, i) => (
              <li key={s.key} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto] gap-2">
                <Input value={s.label} onChange={(e) => setSpecs(specs.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} placeholder="Rubrique" aria-label="Rubrique" maxLength={60} />
                <Input value={s.value} onChange={(e) => setSpecs(specs.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} placeholder="Valeur réelle du produit" aria-label="Valeur" maxLength={200} />
                <button type="button" onClick={() => setSpecs(specs.filter((_, j) => j !== i))} aria-label="Retirer" className="inline-flex size-10 items-center justify-center text-muted hover:text-bad">
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-[12.5px] text-muted">Les lignes sans valeur ne sont pas affichées sur le site.</p>
      </Panel>

      <Panel
        title={`Configurations (${variants.length})`}
        actions={
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={() => setShowGenerator((v) => !v)}>
              <Wand2 className="size-4" /> Générer
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setVariants([...variants, { ...emptyVariant(), condition: phone ? 'NEW' : '' }])}>
              <Plus className="size-4" /> Ajouter
            </Button>
          </div>
        }
      >
        <p className="mb-4 text-[13px] text-muted">
          {phone
            ? 'Une ligne par combinaison réellement en vente (couleur, RAM, stockage, état), avec son prix et son stock. Laissez vide ce qui ne s’applique pas.'
            : 'Une ligne par variante vendue (couleur, longueur…), avec son prix et son stock. Un article sans variante n’a qu’une ligne.'}
        </p>
        {!phone && (
          <Field label="Option des variantes" optional className="mb-4 max-w-sm" hint="Ex. « Longueur », « Capacité », « Modèle compatible ». Laissez vide si seule la couleur varie.">
            {(p) => <Input {...p} value={info.optionName} onChange={set('optionName')} maxLength={40} />}
          </Field>
        )}
        {showGenerator && (
          <Generator
            phone={phone}
            optionName={info.optionName.trim()}
            onGenerate={(rows) => {
              const existing = new Set(variants.map(comboKey));
              const fresh = rows.filter((r) => !existing.has(comboKey(r)));
              // Une ligne vide d'origine est remplacée par les combinaisons générées.
              const keep = variants.filter((v) => v.id || v.salePrice || v.color || v.ramGb || v.storageGb || v.optionValue);
              setVariants([...keep, ...fresh]);
              setShowGenerator(false);
              notify(`${fresh.length} configuration(s) ajoutée(s) : vérifiez les prix et les stocks.`);
            }}
          />
        )}
        <ul className="space-y-3">
          {variants.map((v, i) => {
            const stock = Number(v.stock || 0);
            const added = stock - (v.currentStock ?? 0);
            const dup = duplicates.has(comboKey(v));
            return (
              <li key={v.key} className={cn('rounded-md border p-4', dup ? 'border-bad' : 'border-line', !v.active && 'bg-paper')}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="flex flex-wrap items-center gap-2 text-[13px] font-medium">
                    Configuration {i + 1}
                    {v.sku && <span className="font-mono text-[12px] font-normal text-muted">{v.sku}</span>}
                    {v.id && (v.currentStock ?? 0) - (v.reserved ?? 0) <= 0 && v.active && <Tag tone="bad">Épuisée</Tag>}
                    {!v.active && <Tag>Retirée de la vente</Tag>}
                    {dup && <Tag tone="bad">Doublon</Tag>}
                  </p>
                  <div className="flex items-center gap-1">
                    <label className="mr-2 inline-flex items-center gap-2 text-[13px] text-ink-2">
                      <input type="checkbox" className="accent-accent" checked={v.active} onChange={(e) => update(v.key, { active: e.target.checked })} />
                      En vente
                    </label>
                    <button type="button" title="Dupliquer" aria-label="Dupliquer la configuration" onClick={() => setVariants([...variants.slice(0, i + 1), { ...v, key: newKey(), id: undefined, sku: undefined, currentStock: undefined, reserved: undefined, averageCost: undefined, stock: '0', unitCost: '' }, ...variants.slice(i + 1)])} className="inline-flex size-9 items-center justify-center text-muted hover:text-ink">
                      <Copy className="size-4" />
                    </button>
                    {variants.length > 1 && (
                      <button type="button" title="Retirer" aria-label="Retirer la configuration" onClick={() => setVariants(variants.filter((x) => x.key !== v.key))} className="inline-flex size-9 items-center justify-center text-muted hover:text-bad">
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Field label="Couleur" optional>
                    {(p) => (
                      <span className="flex gap-2">
                        <input
                          type="color"
                          aria-label="Pastille de couleur"
                          value={v.colorHex || '#cccccc'}
                          onChange={(e) => update(v.key, { colorHex: e.target.value })}
                          disabled={!v.color.trim()}
                          className="h-10 w-10 shrink-0 cursor-pointer rounded-sm border border-line-2 bg-surface p-1 disabled:opacity-40"
                        />
                        <Input
                          {...p}
                          value={v.color}
                          onChange={(e) => {
                            const color = e.target.value;
                            update(v.key, { color, colorHex: v.colorHex || COLOR_HEX[norm(color)] || '' });
                          }}
                          list="couleurs"
                          maxLength={40}
                          placeholder="Ex. Noir"
                        />
                      </span>
                    )}
                  </Field>
                  {phone && (
                    <>
                      <Field label="RAM (Go)" optional>
                        {(p) => <Input {...p} type="number" min={1} max={64} value={v.ramGb} onChange={(e) => update(v.key, { ramGb: e.target.value })} className="num" />}
                      </Field>
                      <Field label="Stockage (Go)" optional>
                        {(p) => <Input {...p} type="number" min={1} max={4096} value={v.storageGb} onChange={(e) => update(v.key, { storageGb: e.target.value })} className="num" />}
                      </Field>
                      <Field label="État" optional>
                        {(p) => (
                          <Select {...p} value={v.condition} onChange={(e) => update(v.key, { condition: e.target.value as VariantDraft['condition'] })}>
                            <option value="">—</option>
                            <option value="NEW">Neuf</option>
                            <option value="USED">Occasion</option>
                          </Select>
                        )}
                      </Field>
                    </>
                  )}
                  {info.optionName.trim() && (
                    <Field label={info.optionName.trim()}>
                      {(p) => <Input {...p} value={v.optionValue} onChange={(e) => update(v.key, { optionValue: e.target.value })} maxLength={60} />}
                    </Field>
                  )}
                  <Field label="Prix de vente">
                    {(p) => <MoneyInput {...p} value={v.salePrice} onChange={(e) => update(v.key, { salePrice: e.target.value })} required />}
                  </Field>
                  <Field label="Prix barré" optional hint={v.compareAtPrice && v.salePrice && Number(v.compareAtPrice) > Number(v.salePrice) ? `Promotion −${Math.round((1 - Number(v.salePrice) / Number(v.compareAtPrice)) * 100)} %` : 'Pour une promotion'}>
                    {(p) => <MoneyInput {...p} value={v.compareAtPrice} onChange={(e) => update(v.key, { compareAtPrice: e.target.value })} />}
                  </Field>
                  <Field label={v.id ? 'Stock' : 'Stock initial'} hint={v.id && v.reserved ? `${v.reserved} réservé(s)` : v.id && added !== 0 ? `${added > 0 ? '+' : ''}${added} par rapport à l’actuel` : undefined}>
                    {(p) => <Input {...p} type="number" min={v.reserved ?? 0} max={100000} value={v.stock} onChange={(e) => update(v.key, { stock: e.target.value })} className="num" />}
                  </Field>
                  {added > 0 && (
                    <Field label="Coût d’achat unitaire" hint={v.averageCost ? `Coût moyen actuel : ${formatPrice(v.averageCost)}` : 'Prix payé pour une unité : sert aux marges.'}>
                      {(p) => <MoneyInput {...p} value={v.unitCost} onChange={(e) => update(v.key, { unitCost: e.target.value })} placeholder={v.averageCost ? formatAmount(v.averageCost) : undefined} />}
                    </Field>
                  )}
                  {costs && v.id && v.averageCost !== null && v.averageCost !== undefined && added <= 0 && (
                    <div className="text-[12.5px] text-muted">
                      <p>Coût moyen</p>
                      <p className="num mt-2 text-[14px] text-ink">{formatPrice(v.averageCost)}</p>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        <datalist id="couleurs">
          {[...new Set([...colors, 'Noir', 'Blanc', 'Bleu', 'Gris', 'Vert', 'Rose', 'Violet', 'Or', 'Argent', 'Rouge'])].map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <p className="mt-3 text-[12.5px] text-muted">Une baisse de stock est enregistrée comme correction ; pour un achat fournisseur, utilisez plutôt « Approvisionnements ».</p>
      </Panel>

      <FormError message={error} />
      <div className="flex gap-2">
        <Button type="submit" loading={saving}>
          {group ? 'Enregistrer' : 'Créer le produit'}
        </Button>
        <Button variant="ghost" onClick={() => router.back()}>
          Annuler
        </Button>
      </div>
    </form>
  );
}

/** Générateur : toutes les combinaisons des valeurs saisies, au même prix de départ (à ajuster ensuite). */
function Generator({ phone, optionName, onGenerate }: { phone: boolean; optionName: string; onGenerate: (rows: VariantDraft[]) => void }) {
  const [g, setG] = useState({ colors: '', rams: '', storages: '', options: '', conditions: phone ? ['NEW'] : [], price: '' });
  const list = (s: string) => [...new Set(s.split(',').map((x) => x.trim()).filter(Boolean))];
  const nums = (s: string) => list(s).map(Number).filter((n) => Number.isInteger(n) && n > 0);
  const axes = {
    color: list(g.colors),
    ramGb: phone ? nums(g.rams) : [],
    storageGb: phone ? nums(g.storages) : [],
    condition: phone ? (g.conditions as Condition[]) : [],
    optionValue: optionName ? list(g.options) : [],
  };
  const count = Object.values(axes).reduce((acc, values) => acc * Math.max(1, values.length), 1);
  const generate = () => {
    let rows: Partial<VariantDraft>[] = [{}];
    for (const [attr, values] of Object.entries(axes) as [keyof typeof axes, (string | number)[]][]) {
      if (!values.length) continue;
      rows = rows.flatMap((r) => values.map((value) => ({ ...r, [attr]: String(value) })));
    }
    onGenerate(rows.map((r) => ({ ...emptyVariant(), ...r, colorHex: r.color ? COLOR_HEX[norm(r.color)] ?? '' : '', salePrice: g.price })));
  };
  return (
    <div className="mb-5 rounded-md border border-dashed border-line-2 bg-paper p-4">
      <p className="mb-3 text-[13.5px] font-medium">Créer plusieurs configurations</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Couleurs" optional hint="Séparées par des virgules : Noir, Bleu, Gris">
          {(p) => <Input {...p} value={g.colors} onChange={(e) => setG({ ...g, colors: e.target.value })} />}
        </Field>
        {phone && (
          <>
            <Field label="RAM (Go)" optional hint="Ex. 8, 12">
              {(p) => <Input {...p} value={g.rams} onChange={(e) => setG({ ...g, rams: e.target.value })} inputMode="numeric" />}
            </Field>
            <Field label="Stockage (Go)" optional hint="Ex. 128, 256">
              {(p) => <Input {...p} value={g.storages} onChange={(e) => setG({ ...g, storages: e.target.value })} inputMode="numeric" />}
            </Field>
            <fieldset>
              <legend className="mb-2 text-[13px] font-medium text-ink-2">État</legend>
              <div className="flex gap-4">
                {(['NEW', 'USED'] as const).map((c) => (
                  <label key={c} className="inline-flex items-center gap-2 text-[14px]">
                    <input
                      type="checkbox"
                      className="accent-accent"
                      checked={g.conditions.includes(c)}
                      onChange={(e) => setG({ ...g, conditions: e.target.checked ? [...g.conditions, c] : g.conditions.filter((x) => x !== c) })}
                    />
                    {c === 'NEW' ? 'Neuf' : 'Occasion'}
                  </label>
                ))}
              </div>
            </fieldset>
          </>
        )}
        {optionName && (
          <Field label={optionName} optional hint="Valeurs séparées par des virgules">
            {(p) => <Input {...p} value={g.options} onChange={(e) => setG({ ...g, options: e.target.value })} />}
          </Field>
        )}
        <Field label="Prix de départ" hint="Appliqué à toutes les lignes : ajustez ensuite chaque prix.">
          {(p) => <MoneyInput {...p} value={g.price} onChange={(e) => setG({ ...g, price: e.target.value })} />}
        </Field>
      </div>
      <Button size="sm" className="mt-4" onClick={generate} disabled={count > 60}>
        <Wand2 className="size-4" /> Créer {count} configuration{count > 1 ? 's' : ''}
      </Button>
      {count > 60 && <p className="mt-2 text-[12.5px] text-bad">60 combinaisons au plus à la fois.</p>}
    </div>
  );
}
