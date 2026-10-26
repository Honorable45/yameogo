import { TIMEZONE } from './format';
import type { OpeningHour } from './types';

/** État d'ouverture du jour, calculé dans le fuseau de la boutique. */
export function todayOpening(hours: OpeningHour[], now = new Date()) {
  if (!hours.length) return null;
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: TIMEZONE, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(now);
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon';
  const day = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(weekday) + 1;
  const time = `${parts.find((p) => p.type === 'hour')?.value}:${parts.find((p) => p.type === 'minute')?.value}`;
  const today = hours.find((h) => h.dayOfWeek === day);
  const fmt = (v: string) => v.replace(':', ' h ').replace(' h 00', ' h');
  if (!today || today.closed || !today.opensAt || !today.closesAt) return { open: false, text: 'Fermé aujourd’hui' };
  if (time < today.opensAt) return { open: false, text: `Ouvre aujourd’hui à ${fmt(today.opensAt)}` };
  if (time >= today.closesAt) return { open: false, text: `Fermé — ouvert aujourd’hui de ${fmt(today.opensAt)} à ${fmt(today.closesAt)}` };
  return { open: true, text: `Ouvert jusqu’à ${fmt(today.closesAt)}` };
}
