'use client';

import { Check, Minus, Plus, ShoppingBag } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { cart } from '@/lib/cart';
import { cn } from '@/lib/cn';
import type { CatalogDetail, CheckedLine, Variant } from '@/lib/types';
import { NO_WHATSAPP_MESSAGE, orderMessage, waLink, whatsappNumber } from '@/lib/whatsapp';
import { useToast } from '@/components/ui/toast';
import { availabilityText, CONDITION_LABELS, PriceTag, ProductImage } from './catalog';
import { WhatsAppIcon } from './whatsapp';

type Attr = 'color' | 'ramGb' | 'storageGb' | 'condition' | 'optionValue';
type Value = string | number;
type Selection = Record<Attr, Value | null>;

const ATTRS: Attr[] = ['color', 'ramGb', 'storageGb', 'condition', 'optionValue'];

const matches = (v: Variant, sel: Selection, except?: Attr) => ATTRS.every((a) => a === except || sel[a] === null || v[a] === sel[a]);
const selectionOf = (v: Variant): Selection => ({ color: v.color, ramGb: v.ramGb, storageGb: v.storageGb, condition: v.condition, optionValue: v.optionValue });
const inStock = (v: Variant) => v.availability !== 'OUT_OF_STOCK';

/** Configuration affichée en premier : celle de l'adresse, sinon la moins chère disponible. */
function initialVariant(variants: Variant[], requested?: string) {
  return variants.find((v) => v.id === requested) ?? [...variants].sort((a, b) => Number(inStock(b)) - Number(inStock(a)) || a.price - b.price)[0];
}

export function ProductView({ product, whatsapp, shopName, initialVariantId }: { product: CatalogDetail; whatsapp: string | null; shopName: string; initialVariantId?: string }) {
  const { notify } = useToast();
  const variants = product.variants;
  const [sel, setSel] = useState<Selection>(() => selectionOf(initialVariant(variants, initialVariantId)));
  const [quantity, setQuantity] = useState(1);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const variant = variants.find((v) => ATTRS.every((a) => v[a] === sel[a])) ?? null;
  const available = variant ? inStock(variant) : false;
  const maxQty = variant ? Math.max(1, variant.availableQuantity) : 1;

  // Groupes d'options : seuls ceux qui existent pour ce produit, dans l'ordre couleur → RAM → stockage → état → option.
  const groups = useMemo(() => {
    const labels: Record<Attr, string> = { color: 'Couleur', ramGb: 'Mémoire RAM', storageGb: 'Stockage', condition: 'État', optionValue: product.optionName ?? 'Option' };
    return ATTRS.map((attr) => {
      const values: Value[] = [];
      for (const v of variants) if (v[attr] !== null && !values.includes(v[attr] as Value)) values.push(v[attr] as Value);
      if (attr === 'ramGb' || attr === 'storageGb') (values as number[]).sort((a, b) => a - b);
      return { attr, label: labels[attr], values };
    }).filter((g) => g.values.length > 0);
  }, [variants, product.optionName]);

  const valueLabel = (attr: Attr, value: Value) =>
    attr === 'ramGb' || attr === 'storageGb' ? `${value} Go` : attr === 'condition' ? CONDITION_LABELS[value as 'NEW' | 'USED'] : String(value);

  /** État d'une valeur au regard des autres choix : proposée, épuisée, ou inexistante avec ces choix. */
  const status = (attr: Attr, value: Value) => {
    const candidates = variants.filter((v) => v[attr] === value && matches(v, sel, attr));
    if (!candidates.length) return 'unavailable' as const;
    return candidates.some(inStock) ? ('ok' as const) : ('soldout' as const);
  };

  const choose = (attr: Attr, value: Value) => {
    const wanted = { ...sel, [attr]: value };
    const exact = variants.find((v) => ATTRS.every((a) => v[a] === wanted[a]));
    // Combinaison inexistante : on garde la valeur choisie et la configuration existante la plus proche.
    const target =
      exact ??
      variants
        .filter((v) => v[attr] === value)
        .sort((a, b) => {
          const score = (v: Variant) => ATTRS.filter((x) => x !== attr && v[x] === sel[x]).length;
          return Number(inStock(b)) - Number(inStock(a)) || score(b) - score(a) || a.price - b.price;
        })[0];
    if (!target) return;
    setSel(selectionOf(target));
    setQuantity(1);
    setError(null);
    // Adresse partageable de la configuration choisie.
    window.history.replaceState(null, '', `?configuration=${target.id}`);
  };

  // Photos de la couleur choisie d'abord, puis les photos générales, puis les autres couleurs.
  const images = useMemo(() => {
    const rank = (c: string | null) => (c && c === sel.color ? 0 : c === null ? 1 : 2);
    return [...product.images].sort((a, b) => rank(a.color) - rank(b.color) || 0);
  }, [product.images, sel.color]);
  const [imageIndex, setImageIndex] = useState(0);
  const image = images[Math.min(imageIndex, images.length - 1)];

  const order = async () => {
    if (!variant || !available) return;
    setError(null);
    if (!whatsappNumber(whatsapp)) return setError(NO_WHATSAPP_MESSAGE);
    // Onglet ouvert tout de suite (sinon bloqué par le navigateur), puis dirigé vers WhatsApp après vérification.
    const win = window.open('', '_blank');
    if (win) win.opener = null;
    setSending(true);
    try {
      // Prix et disponibilité vérifiés par le serveur au moment de la commande.
      const { lines } = await api.post<{ lines: CheckedLine[] }>('/shop/cart/check', { items: [{ variantId: variant.id, quantity }] });
      const line = lines[0];
      if (!line?.name || !line.available || line.issue) throw new Error(line?.issue ?? 'Cette configuration n’est plus disponible.');
      const href = waLink(whatsapp, orderMessage(shopName, [{ ...line, name: product.name, quantity }]))!;
      if (win) win.location.href = href;
      else window.location.href = href;
    } catch (err) {
      win?.close();
      setError(errorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const addToCart = () => {
    if (!variant || !available) return;
    cart.add(variant.id, quantity);
    notify(`${product.name} ajouté au panier.`);
  };

  const stock = variant ? availabilityText(variant.availability, variant.availableQuantity) : null;

  return (
    <div className="grid gap-8 lg:grid-cols-12 lg:gap-14">
      {/* Photos */}
      <div className="lg:col-span-7">
        <div className="lg:sticky lg:top-28">
          <ProductImage src={image?.url} alt={image?.alt || product.name} sizes="(min-width: 1024px) 55vw, 100vw" priority className={cn('rounded-3xl', product.kind === 'PHONE' ? 'aspect-[4/5] sm:aspect-square' : undefined)} />
          {images.length > 1 && (
            <ul className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-6" aria-label="Autres photos">
              {images.map((img, i) => (
                <li key={img.id}>
                  <button
                    type="button"
                    onClick={() => setImageIndex(i)}
                    aria-label={`Afficher la photo ${i + 1}${img.color ? ` (${img.color})` : ''}`}
                    aria-current={img.id === image?.id}
                    className={cn('relative block aspect-square w-full overflow-hidden rounded-xl bg-paper-2', img.id === image?.id ? 'ring-2 ring-ink' : 'opacity-70 hover:opacity-100')}
                  >
                    {img.url && <Image src={img.url} alt="" fill sizes="96px" className="object-cover" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Configuration et commande */}
      <div className="lg:col-span-5">
        {product.brand && <p className="eyebrow">{product.brand.name}</p>}
        <h1 className="display mt-2 text-[34px] sm:text-[44px]">{product.name}</h1>
        {product.compatibleWith && <p className="mt-2 text-[14.5px] text-ink-2">Compatible : {product.compatibleWith}</p>}

        <div className="mt-6">
          {variant ? <PriceTag price={variant.price} compareAt={variant.compareAtPrice} size="lg" /> : <p className="text-[15px] text-muted">Configuration non proposée</p>}
          {stock && (
            <p className={cn('mt-2 flex items-center gap-2 text-[13.5px] font-medium', stock.tone)} role="status">
              <span className={cn('size-2 rounded-full', stock.dot)} aria-hidden="true" />
              {stock.text}
            </p>
          )}
        </div>

        <div className="mt-7 space-y-6">
          {groups.map(({ attr, label, values }) => (
            <fieldset key={attr}>
              <legend className="mb-2.5 text-[13.5px] font-medium text-ink-2">
                {label}
                {sel[attr] !== null && <span className="ml-1.5 font-normal text-muted">· {valueLabel(attr, sel[attr]!)}</span>}
              </legend>
              <div className="flex flex-wrap gap-2">
                {values.map((value) => {
                  const st = status(attr, value);
                  const active = sel[attr] === value;
                  const hex = attr === 'color' ? variants.find((v) => v.color === value)?.colorHex : null;
                  return (
                    <button
                      key={String(value)}
                      type="button"
                      onClick={() => choose(attr, value)}
                      aria-pressed={active}
                      title={st === 'soldout' ? 'Épuisé' : st === 'unavailable' ? 'Non proposé avec les autres choix' : undefined}
                      className={cn(
                        'relative inline-flex h-11 min-w-[3.25rem] items-center justify-center gap-2 rounded-full border px-4 text-[14px] transition-colors',
                        active ? 'border-ink bg-ink font-medium text-white' : 'border-line-2 bg-surface text-ink hover:border-ink',
                        st === 'unavailable' && !active && 'border-dashed text-faint',
                        st === 'soldout' && !active && 'text-faint line-through decoration-1',
                      )}
                    >
                      {attr === 'color' && <span className={cn('size-4 shrink-0 rounded-full ring-1', active ? 'ring-white/60' : 'ring-black/15')} style={{ background: hex ?? 'var(--color-paper-3)' }} aria-hidden="true" />}
                      {valueLabel(attr, value)}
                      {st === 'soldout' && <span className="sr-only"> (épuisé)</span>}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}

          <fieldset>
            <legend className="mb-2.5 text-[13.5px] font-medium text-ink-2">Quantité</legend>
            <div className="inline-flex items-center rounded-full border border-line-2 bg-surface">
              <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} disabled={quantity <= 1 || !available} aria-label="Diminuer la quantité" className="flex size-11 items-center justify-center text-ink disabled:text-faint">
                <Minus className="size-4" />
              </button>
              <output className="num w-8 text-center text-[15px] font-medium" aria-live="polite">
                {quantity}
              </output>
              <button type="button" onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))} disabled={quantity >= maxQty || !available} aria-label="Augmenter la quantité" className="flex size-11 items-center justify-center text-ink disabled:text-faint">
                <Plus className="size-4" />
              </button>
            </div>
            {available && quantity >= maxQty && variant && variant.availableQuantity < 10 && <p className="mt-2 text-[12.5px] text-muted">Quantité maximale disponible.</p>}
          </fieldset>
        </div>

        <div className="mt-8 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={order}
            disabled={!available || sending}
            className="inline-flex h-13 w-full items-center justify-center gap-2.5 rounded-full bg-[#1f9d55] px-6 text-[15.5px] font-medium text-white shadow-[0_10px_28px_-12px_rgb(31_157_85/0.7)] transition-[transform,background-color] hover:bg-[#188247] active:scale-[0.98] disabled:bg-line-2 disabled:text-ink-2 disabled:shadow-none"
          >
            <WhatsAppIcon />
            {sending ? 'Préparation…' : 'Commander sur WhatsApp'}
          </button>
          <button
            type="button"
            onClick={addToCart}
            disabled={!available}
            className="glass-dark inline-flex h-13 items-center justify-center gap-2 rounded-full px-6 text-[15px] font-medium text-white transition-transform hover:-translate-y-0.5 disabled:opacity-40"
          >
            <ShoppingBag className="size-[18px]" /> Ajouter au panier
          </button>
        </div>
        {!variant && <p className="mt-3 text-[13.5px] text-bad">Cette combinaison n’existe pas : choisissez une autre option.</p>}
        {variant && !available && <p className="mt-3 text-[13.5px] text-ink-2">Cette configuration est épuisée. Choisissez une autre couleur ou capacité, ou demandez-nous sur WhatsApp quand elle sera de retour.</p>}
        {error && (
          <p className="mt-3 text-[13.5px] text-bad" role="alert">
            {error}
          </p>
        )}
        {!whatsappNumber(whatsapp) && <p className="mt-3 text-[12.5px] text-muted">{NO_WHATSAPP_MESSAGE}</p>}
        <p className="mt-4 flex items-start gap-2 text-[13px] text-muted">
          <Check className="mt-0.5 size-4 shrink-0 text-ok" />
          Le message WhatsApp est prérempli : vous le vérifiez puis l’envoyez. La boutique vous confirme la disponibilité, la livraison et le paiement.
        </p>

        {product.description && <p className="mt-8 whitespace-pre-line text-[15px] leading-relaxed text-ink-2">{product.description}</p>}

        {product.specs.length > 0 && (
          <section className="mt-8" aria-labelledby="caracteristiques">
            <h2 id="caracteristiques" className="text-[15px] font-semibold">
              Caractéristiques
            </h2>
            <dl className="mt-3 divide-y divide-line border-y border-line text-[14px]">
              {product.specs.map((s) => (
                <div key={s.label} className="grid grid-cols-[38%_1fr] gap-4 py-2.5">
                  <dt className="text-muted">{s.label}</dt>
                  <dd>{s.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        <p className="mt-6 text-[13px] text-muted">
          Une question ?{' '}
          <Link href="/contact" className="font-medium text-accent underline">
            Contactez la boutique
          </Link>
          {variant && <span className="num"> · Réf. {variant.sku}</span>}
        </p>
      </div>
    </div>
  );
}
