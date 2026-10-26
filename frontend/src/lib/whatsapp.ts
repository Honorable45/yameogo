import { formatPrice } from './format';

/** Numéro WhatsApp de la boutique (repli si les paramètres ne sont pas disponibles). */
export const SHOP_WHATSAPP = '+22870858801';

export function waLink(number: string | null | undefined, text: string) {
  const digits = (number || SHOP_WHATSAPP).replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export interface WaLine {
  name: string;
  quantity: number;
  price: number;
  ref?: string;
}

/** Message de commande pré-rempli : articles, quantités, prix et total. */
export function orderMessage(lines: WaLine[], pageUrl?: string) {
  const total = lines.reduce((acc, l) => acc + l.price * l.quantity, 0);
  return [
    'Bonjour YAMEOGO, je souhaite commander :',
    '',
    ...lines.map((l) => `• ${l.quantity} × ${l.name}${l.ref ? ` (réf. ${l.ref})` : ''} — ${formatPrice(l.price * l.quantity)}`),
    '',
    `Total : ${formatPrice(total)}`,
    ...(pageUrl ? ['', pageUrl] : []),
  ].join('\n');
}

/** Message « je veux acheter » pour un article ou un téléphone précis. */
export function buyMessage(item: { name: string; price: number; ref: string; url: string }) {
  return `Bonjour YAMEOGO, je souhaite acheter : ${item.name} (réf. ${item.ref}) à ${formatPrice(item.price)}.\n\n${item.url}`;
}
