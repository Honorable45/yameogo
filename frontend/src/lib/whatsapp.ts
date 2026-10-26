import { formatPrice } from './format';

/**
 * Commandes par WhatsApp.
 * Le numéro de la boutique vient uniquement des Paramètres de l'administration (aucun numéro de repli) :
 * sans numéro configuré, aucun lien n'est construit et le site l'indique au client.
 */

/** Numéro international sans « + » ni espaces (ex. 22890000000), ou null s'il est absent ou invalide. */
export function whatsappNumber(number: string | null | undefined) {
  const digits = (number ?? '').replace(/\D/g, '');
  return digits.length >= 8 ? digits : null;
}

/** Lien WhatsApp (téléphone et ordinateur) ; le message est seulement prérempli, jamais envoyé automatiquement. */
export function waLink(number: string | null | undefined, text: string) {
  const phone = whatsappNumber(number);
  return phone ? `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}` : null;
}

export const NO_WHATSAPP_MESSAGE = 'La commande par WhatsApp sera disponible dès que la boutique aura renseigné son numéro.';

const CONDITIONS = { NEW: 'Neuf', USED: 'Occasion' } as const;

/** Une ligne de commande : seules les caractéristiques renseignées pour ce produit sont reprises. */
export interface OrderLine {
  kind: 'PHONE' | 'ACCESSORY';
  name: string;
  sku: string;
  color: string | null;
  ramGb: number | null;
  storageGb: number | null;
  condition: 'NEW' | 'USED' | null;
  optionName: string | null;
  optionValue: string | null;
  quantity: number;
  unitPrice: number;
}

function details(l: OrderLine) {
  return [
    l.color ? `- Couleur : ${l.color}` : null,
    l.ramGb ? `- Mémoire RAM : ${l.ramGb} Go` : null,
    l.storageGb ? `- Stockage : ${l.storageGb} Go` : null,
    l.condition ? `- État : ${CONDITIONS[l.condition]}` : null,
    l.optionName && l.optionValue ? `- ${l.optionName} : ${l.optionValue}` : null,
    `- Quantité : ${l.quantity}`,
    `- Prix unitaire : ${formatPrice(l.unitPrice)}`,
  ].filter((x): x is string => Boolean(x));
}

/** Message professionnel de commande, construit à partir des données réelles (prix vérifiés par le serveur). */
export function orderMessage(shopName: string, lines: OrderLine[]) {
  const total = lines.reduce((acc, l) => acc + l.unitPrice * l.quantity, 0);
  if (lines.length === 1) {
    const [l] = lines;
    return [
      `Bonjour ${shopName},`,
      '',
      'Je souhaite commander le produit suivant :',
      '',
      'PRODUIT',
      `- ${l.kind === 'PHONE' ? 'Téléphone' : 'Article'} : ${l.name}`,
      ...details(l),
      `- Total estimé : ${formatPrice(total)}`,
      `- Référence : ${l.sku}`,
      '',
      'Merci de me confirmer la disponibilité de cette configuration ainsi que les modalités de livraison et de paiement.',
      '',
      'Cordialement.',
    ].join('\n');
  }
  return [
    `Bonjour ${shopName},`,
    '',
    'Je souhaite commander les produits suivants :',
    '',
    ...lines.flatMap((l, i) => [`${i + 1}. ${l.name}`, ...details(l), `- Sous-total : ${formatPrice(l.unitPrice * l.quantity)}`, `- Référence : ${l.sku}`, '']),
    `TOTAL ESTIMÉ : ${formatPrice(total)}`,
    '',
    'Merci de me confirmer la disponibilité de ces articles ainsi que les modalités de livraison et de paiement.',
    '',
    'Cordialement.',
  ].join('\n');
}
