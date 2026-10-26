'use client';

import { useSyncExternalStore } from 'react';

/**
 * Panier du client, conservé dans son navigateur (aucun compte nécessaire).
 * Il ne contient que des identifiants de configuration et des quantités : les prix et la disponibilité
 * sont toujours redemandés au serveur avant l'affichage et l'envoi sur WhatsApp.
 */
export interface CartItem {
  variantId: string;
  quantity: number;
}

const KEY = 'yameogo-cart';
const MAX_LINES = 30;
const MAX_QUANTITY = 10;
const EMPTY: CartItem[] = [];

let cache: CartItem[] | null = null;
const listeners = new Set<() => void>();

function read(): CartItem[] {
  if (cache) return cache;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    cache = Array.isArray(raw)
      ? raw
          .filter((i): i is CartItem => typeof i?.variantId === 'string' && Number.isInteger(i?.quantity))
          .map((i) => ({ variantId: i.variantId, quantity: Math.min(Math.max(1, i.quantity), MAX_QUANTITY) }))
          .slice(0, MAX_LINES)
      : [];
  } catch {
    cache = [];
  }
  return cache;
}

function write(items: CartItem[]) {
  cache = items;
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // Stockage indisponible (navigation privée stricte) : le panier reste en mémoire pour la visite.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Autres onglets : le panier reste le même partout.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    cache = null;
    listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export const cart = {
  /** Ajoute une configuration ; la même configuration ajoutée deux fois voit sa quantité augmenter. */
  add(variantId: string, quantity: number) {
    const items = read();
    const existing = items.find((i) => i.variantId === variantId);
    write(
      existing
        ? items.map((i) => (i.variantId === variantId ? { ...i, quantity: Math.min(i.quantity + quantity, MAX_QUANTITY) } : i))
        : [...items, { variantId, quantity: Math.min(quantity, MAX_QUANTITY) }].slice(-MAX_LINES),
    );
  },
  setQuantity(variantId: string, quantity: number) {
    write(read().map((i) => (i.variantId === variantId ? { ...i, quantity: Math.min(Math.max(1, quantity), MAX_QUANTITY) } : i)));
  },
  remove(variantId: string) {
    write(read().filter((i) => i.variantId !== variantId));
  },
  clear() {
    write([]);
  },
};

export function useCart() {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export function useCartCount() {
  return useCart().reduce((acc, i) => acc + i.quantity, 0);
}
