'use client';

import { Minus, Plus, ShoppingBag, Trash2, Truck } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { cart, useCart } from '@/lib/cart';
import { cn } from '@/lib/cn';
import { formatPrice } from '@/lib/format';
import type { CheckedLine } from '@/lib/types';
import { NO_WHATSAPP_MESSAGE, orderMessage, waLink, whatsappNumber } from '@/lib/whatsapp';
import { WhatsAppIcon } from './whatsapp';

type Line = Extract<CheckedLine, { name: string }>;

const isLine = (l: CheckedLine): l is Line => typeof l.name === 'string';

/**
 * Panier : les prix et la disponibilité sont redemandés au serveur à chaque changement.
 * La commande n'est possible que si toutes les lignes sont disponibles dans les quantités demandées.
 */
export function CartView({ whatsapp, shopName, deliveryInfo }: { whatsapp: string | null; shopName: string; deliveryInfo: string | null }) {
  const items = useCart();
  const [lines, setLines] = useState<CheckedLine[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const key = JSON.stringify(items);

  useEffect(() => {
    if (!items.length) return setLines([]);
    let alive = true;
    api
      .post<{ lines: CheckedLine[] }>('/shop/cart/check', { items })
      .then((r) => alive && (setLines(r.lines), setLoadError(null)))
      .catch((err) => alive && setLoadError(errorMessage(err)));
    return () => {
      alive = false;
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const quantityOf = (id: string) => items.find((i) => i.variantId === id)?.quantity ?? 0;
  const rows = (lines ?? []).filter((l) => items.some((i) => i.variantId === l.variantId));
  const blocking = rows.filter((l) => !isLine(l) || !l.available || l.issue);
  const total = rows.filter(isLine).reduce((acc, l) => acc + l.unitPrice * quantityOf(l.variantId), 0);

  const order = async () => {
    setError(null);
    if (!whatsappNumber(whatsapp)) return setError(NO_WHATSAPP_MESSAGE);
    const win = window.open('', '_blank');
    if (win) win.opener = null;
    setSending(true);
    try {
      // Dernière vérification : prix et stock au moment exact de la commande.
      const fresh = (await api.post<{ lines: CheckedLine[] }>('/shop/cart/check', { items })).lines;
      setLines(fresh);
      if (fresh.some((l) => !isLine(l) || !l.available || l.issue)) throw new Error('Certains articles ont changé : vérifiez votre panier.');
      const message = orderMessage(
        shopName,
        fresh.filter(isLine).map((l) => ({ ...l, quantity: quantityOf(l.variantId) })),
      );
      const href = waLink(whatsapp, message)!;
      if (win) win.location.href = href;
      else window.location.href = href;
    } catch (err) {
      win?.close();
      setError(errorMessage(err));
    } finally {
      setSending(false);
    }
  };

  if (!items.length) {
    return (
      <div className="flex flex-col items-center py-20 text-center">
        <ShoppingBag className="size-9 text-faint" strokeWidth={1.3} />
        <p className="mt-4 text-[17px] font-medium">Votre panier est vide.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link href="/telephones" className="glass-dark inline-flex h-11 items-center rounded-full px-5 text-[14.5px] font-medium text-white">
            Voir les smartphones
          </Link>
          <Link href="/accessoires" className="inline-flex h-11 items-center rounded-full border border-line-2 bg-surface px-5 text-[14.5px] font-medium">
            Voir les accessoires
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-12 lg:gap-12">
      <div className="lg:col-span-7">
        {loadError && <p className="mb-4 text-[14px] text-bad">{loadError}</p>}
        {!lines ? (
          <ul className="space-y-3">
            {items.map((i) => (
              <li key={i.variantId} className="h-28 animate-pulse rounded-2xl bg-paper-2" />
            ))}
          </ul>
        ) : (
          <ul className="divide-y divide-line rounded-3xl border border-line bg-surface">
            {rows.map((l) => {
              const qty = quantityOf(l.variantId);
              if (!isLine(l)) {
                return (
                  <li key={l.variantId} className="flex items-center justify-between gap-4 p-4 sm:p-5">
                    <p className="text-[14px] text-bad">{l.issue}</p>
                    <RemoveButton id={l.variantId} />
                  </li>
                );
              }
              const href = `/${l.kind === 'PHONE' ? 'telephones' : 'accessoires'}/${l.slug}?configuration=${l.variantId}`;
              return (
                <li key={l.variantId} className="flex gap-4 p-4 sm:p-5">
                  <Link href={href} className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-paper-2 sm:size-24">
                    {l.image?.url && <Image src={l.image.url} alt={l.image.alt || l.name} fill sizes="96px" className="object-cover" />}
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        {l.brand && <p className="eyebrow !text-[10.5px]">{l.brand}</p>}
                        <Link href={href} className="text-[15px] font-medium leading-snug hover:text-accent">
                          {l.name}
                        </Link>
                        {l.label && <p className="mt-0.5 text-[13px] text-muted">{l.label}</p>}
                      </div>
                      <RemoveButton id={l.variantId} />
                    </div>
                    <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-3">
                      <div className="inline-flex items-center rounded-full border border-line-2">
                        <button type="button" onClick={() => cart.setQuantity(l.variantId, qty - 1)} disabled={qty <= 1} aria-label="Diminuer la quantité" className="flex size-9 items-center justify-center disabled:text-faint">
                          <Minus className="size-3.5" />
                        </button>
                        <span className="num w-7 text-center text-[14px]">{qty}</span>
                        <button type="button" onClick={() => cart.setQuantity(l.variantId, qty + 1)} disabled={qty >= l.maxQuantity} aria-label="Augmenter la quantité" className="flex size-9 items-center justify-center disabled:text-faint">
                          <Plus className="size-3.5" />
                        </button>
                      </div>
                      <div className="text-right">
                        <p className="num text-[15.5px] font-semibold">{formatPrice(l.unitPrice * qty)}</p>
                        {qty > 1 && <p className="num text-[12.5px] text-muted">{formatPrice(l.unitPrice)} l’unité</p>}
                      </div>
                    </div>
                    {(l.issue || !l.available) && (
                      <p className="mt-2 text-[13px] text-bad">
                        {l.issue ?? 'Indisponible'}
                        {l.available && l.maxQuantity > 0 && (
                          <button type="button" onClick={() => cart.setQuantity(l.variantId, l.maxQuantity)} className="ml-2 font-medium underline">
                            Ajuster à {l.maxQuantity}
                          </button>
                        )}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <button type="button" onClick={() => cart.clear()} className="mt-4 text-[13.5px] text-muted underline hover:text-ink">
          Vider le panier
        </button>
      </div>

      <aside className="lg:col-span-5">
        <div className="glass-light rounded-3xl p-6 lg:sticky lg:top-28">
          <h2 className="text-[15px] font-semibold">Récapitulatif</h2>
          <dl className="mt-4 space-y-2 text-[14.5px]">
            {rows.filter(isLine).map((l) => (
              <div key={l.variantId} className="flex justify-between gap-4">
                <dt className="min-w-0 truncate text-ink-2">
                  {quantityOf(l.variantId)} × {l.name}
                </dt>
                <dd className="num shrink-0">{formatPrice(l.unitPrice * quantityOf(l.variantId))}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-4 border-t border-line pt-3 text-[16px] font-semibold">
              <dt>Total estimé</dt>
              <dd className="num">{formatPrice(total)}</dd>
            </div>
          </dl>
          {deliveryInfo && (
            <p className="mt-4 flex items-start gap-2 text-[13px] text-ink-2">
              <Truck className="mt-0.5 size-4 shrink-0 text-muted" />
              <span className="whitespace-pre-line">{deliveryInfo}</span>
            </p>
          )}
          <button
            type="button"
            onClick={order}
            disabled={!lines || blocking.length > 0 || sending}
            className={cn(
              'mt-6 inline-flex h-13 w-full items-center justify-center gap-2.5 rounded-full px-6 text-[15.5px] font-medium transition-[transform,background-color] active:scale-[0.98]',
              'bg-[#1f9d55] text-white shadow-[0_10px_28px_-12px_rgb(31_157_85/0.7)] hover:bg-[#188247] disabled:bg-line-2 disabled:text-ink-2 disabled:shadow-none',
            )}
          >
            <WhatsAppIcon />
            {sending ? 'Préparation…' : 'Commander sur WhatsApp'}
          </button>
          {blocking.length > 0 && <p className="mt-3 text-[13px] text-bad">Retirez ou ajustez les articles indisponibles pour commander.</p>}
          {error && (
            <p className="mt-3 text-[13px] text-bad" role="alert">
              {error}
            </p>
          )}
          {!whatsappNumber(whatsapp) && <p className="mt-3 text-[12.5px] text-muted">{NO_WHATSAPP_MESSAGE}</p>}
          <p className="mt-4 text-[12.5px] text-muted">Le message est prérempli : vous le vérifiez puis l’envoyez. La commande est confirmée par la boutique sur WhatsApp.</p>
        </div>
      </aside>
    </div>
  );
}

function RemoveButton({ id }: { id: string }) {
  return (
    <button type="button" onClick={() => cart.remove(id)} aria-label="Retirer du panier" className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-paper-2 hover:text-bad">
      <Trash2 className="size-4" />
    </button>
  );
}
