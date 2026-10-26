import { TZDate } from '@date-fns/tz';
import {
  addDays,
  addMonths,
  addYears,
  differenceInCalendarDays,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
  subWeeks,
  subYears,
} from 'date-fns';

export const PERIOD_PRESETS = [
  'today',
  'yesterday',
  'this_week',
  'last_week',
  'this_month',
  'last_month',
  'this_year',
  'last_year',
  'custom',
] as const;
export type PeriodPreset = (typeof PERIOD_PRESETS)[number];

export type Granularity = 'day' | 'month';

export interface ResolvedPeriod {
  preset: PeriodPreset;
  label: string;
  /** Début inclus (instant UTC). */
  start: Date;
  /** Fin exclue (instant UTC). */
  end: Date;
  /** Dates calendaires locales, pour l'affichage : début inclus, fin incluse. */
  startDate: string;
  endDate: string;
  granularity: Granularity;
  /** Période précédente de même nature, pour les comparaisons. */
  previous: { start: Date; end: Date; startDate: string; endDate: string };
  timezone: string;
}

const LABELS: Record<PeriodPreset, string> = {
  today: "Aujourd'hui",
  yesterday: 'Hier',
  this_week: 'Cette semaine',
  last_week: 'Semaine précédente',
  this_month: 'Ce mois',
  last_month: 'Mois précédent',
  this_year: 'Cette année',
  last_year: 'Année précédente',
  custom: 'Période personnalisée',
};

const WEEK = { weekStartsOn: 1 as const };
const MAX_CUSTOM_DAYS = 366 * 3;

function parseLocalDate(value: string, tz: string): TZDate {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`Date invalide : ${value}`);
  const [y, m, d] = value.split('-').map(Number);
  const date = new TZDate(y, m - 1, d, tz);
  if (date.getMonth() !== m - 1 || date.getDate() !== d) throw new Error(`Date invalide : ${value}`);
  return date;
}

/**
 * Convention temporelle :
 * - toutes les bornes sont calculées dans le fuseau de la boutique (BUSINESS_TIMEZONE) ;
 * - une période est un intervalle [début, fin[ ; la semaine commence le lundi ;
 * - une opération est rattachée à la date de l'événement qui la rend effective
 *   (vente terminée, réparation terminée, paiement confirmé, date de la dépense).
 */
export function resolvePeriod(preset: PeriodPreset, tz: string, now: Date = new Date(), custom?: { from?: string; to?: string }): ResolvedPeriod {
  const local = new TZDate(now.getTime(), tz);
  let start: TZDate;
  let end: TZDate;
  let prevStart: TZDate;
  let prevEnd: TZDate;

  switch (preset) {
    case 'today':
      start = startOfDay(local);
      end = addDays(start, 1);
      prevStart = subDays(start, 1);
      prevEnd = start;
      break;
    case 'yesterday':
      end = startOfDay(local);
      start = subDays(end, 1);
      prevStart = subDays(start, 1);
      prevEnd = start;
      break;
    case 'this_week':
      start = startOfWeek(local, WEEK);
      end = addDays(start, 7);
      prevStart = subWeeks(start, 1);
      prevEnd = start;
      break;
    case 'last_week':
      end = startOfWeek(local, WEEK);
      start = subWeeks(end, 1);
      prevStart = subWeeks(start, 1);
      prevEnd = start;
      break;
    case 'this_month':
      start = startOfMonth(local);
      end = addMonths(start, 1);
      prevStart = subMonths(start, 1);
      prevEnd = start;
      break;
    case 'last_month':
      end = startOfMonth(local);
      start = subMonths(end, 1);
      prevStart = subMonths(start, 1);
      prevEnd = start;
      break;
    case 'this_year':
      start = startOfYear(local);
      end = addYears(start, 1);
      prevStart = subYears(start, 1);
      prevEnd = start;
      break;
    case 'last_year':
      end = startOfYear(local);
      start = subYears(end, 1);
      prevStart = subYears(start, 1);
      prevEnd = start;
      break;
    case 'custom': {
      if (!custom?.from || !custom?.to) throw new Error('Indiquez une date de début et une date de fin.');
      start = parseLocalDate(custom.from, tz);
      end = addDays(parseLocalDate(custom.to, tz), 1);
      const days = differenceInCalendarDays(end, start);
      if (days <= 0) throw new Error('La date de fin doit suivre la date de début.');
      if (days > MAX_CUSTOM_DAYS) throw new Error('Période trop longue (3 ans maximum).');
      prevEnd = start;
      prevStart = subDays(start, days);
      break;
    }
  }

  const days = differenceInCalendarDays(end, start);
  const fmt = (d: Date) => format(d, 'yyyy-MM-dd');
  return {
    preset,
    label: LABELS[preset],
    start: new Date(start.getTime()),
    end: new Date(end.getTime()),
    startDate: fmt(start),
    endDate: fmt(subDays(end, 1)),
    granularity: days > 62 ? 'month' : 'day',
    previous: { start: new Date(prevStart.getTime()), end: new Date(prevEnd.getTime()), startDate: fmt(prevStart), endDate: fmt(subDays(prevEnd, 1)) },
    timezone: tz,
  };
}

/** Liste exhaustive des intervalles d'une période (jours ou mois), au format local. */
export function bucketsOf(period: ResolvedPeriod): string[] {
  const tz = period.timezone;
  const out: string[] = [];
  let cursor: TZDate = new TZDate(period.start.getTime(), tz);
  const end = new TZDate(period.end.getTime(), tz);
  if (period.granularity === 'month') {
    cursor = startOfMonth(cursor);
    while (cursor < end) {
      out.push(format(cursor, 'yyyy-MM'));
      cursor = addMonths(cursor, 1);
    }
  } else {
    while (cursor < end) {
      out.push(format(cursor, 'yyyy-MM-dd'));
      cursor = addDays(cursor, 1);
    }
  }
  return out;
}
