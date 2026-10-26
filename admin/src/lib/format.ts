export const TIMEZONE = 'Africa/Lome';

const grouping = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
// Espace insécable « normale » plutôt que l'espace fine du français : plus lisible en petite taille.
const money = { format: (v: number) => grouping.format(v).replace(/\u202f/g, '\u00a0') };

/** 15000 → « 15 000 FCFA » (franc CFA, XOF). */
export function formatPrice(value: number | null | undefined) {
  if (value === null || value === undefined) return '—';
  return `${money.format(value)}\u00a0FCFA`;
}

/** Montant sans unité, pour les tableaux où l'unité figure dans l'en-tête. */
export function formatAmount(value: number | null | undefined) {
  if (value === null || value === undefined) return '—';
  return money.format(value);
}

export function formatSigned(value: number) {
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${money.format(Math.abs(value))}`;
}

const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: TIMEZONE });
const dateLongFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: TIMEZONE });
const dateTimeFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: TIMEZONE });
const timeFmt = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: TIMEZONE });

export const formatDate = (d: string | Date | null | undefined) => (d ? dateFmt.format(new Date(d)) : '—');
export const formatDateLong = (d: string | Date | null | undefined) => (d ? dateLongFmt.format(new Date(d)) : '—');
export const formatDateTime = (d: string | Date | null | undefined) => (d ? dateTimeFmt.format(new Date(d)) : '—');
export const formatTime = (d: string | Date | null | undefined) => (d ? timeFmt.format(new Date(d)) : '—');

/** Date du jour dans le fuseau de la boutique, au format AAAA-MM-JJ. */
export function todayLocal() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(new Date());
}

export function formatDuration(minutes: number | null | undefined) {
  if (!minutes) return null;
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 60 * 24) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m ? `${h} h ${m}` : `${h} h`;
  }
  const days = Math.round(minutes / (60 * 24));
  return `${days} jour${days > 1 ? 's' : ''}`;
}

/** Affiche un numéro de façon aérée : +22890000000 → +228 90 00 00 00 */
export function formatPhone(value: string | null | undefined) {
  if (!value) return '';
  const plus = value.startsWith('+');
  const digits = value.replace(/\D/g, '');
  if (plus && digits.length > 8) {
    const cc = digits.slice(0, digits.length - 8);
    return `+${cc} ${digits.slice(-8).replace(/(\d{2})(?=\d)/g, '$1 ')}`;
  }
  return digits.replace(/(\d{2})(?=\d)/g, '$1 ');
}

export function whatsappLink(number: string | null | undefined, text?: string) {
  if (!number) return null;
  const digits = number.replace(/\D/g, '');
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count > 1 ? plural : singular}`;
}
