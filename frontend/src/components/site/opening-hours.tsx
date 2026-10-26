import type { OpeningHour } from '@/lib/types';
import { cn } from '@/lib/cn';

const DAYS = ['', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

const hhmm = (v: string | null) => (v ? v.replace(':', ' h ').replace(' h 00', ' h') : '');

/** Regroupe les jours consécutifs aux horaires identiques : « Lundi – Vendredi ». */
export function groupHours(hours: OpeningHour[]) {
  const sorted = [...hours].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  const groups: { from: number; to: number; text: string }[] = [];
  for (const h of sorted) {
    const text = h.closed ? 'Fermé' : `${hhmm(h.opensAt)} – ${hhmm(h.closesAt)}`;
    const last = groups[groups.length - 1];
    if (last && last.text === text && last.to === h.dayOfWeek - 1) last.to = h.dayOfWeek;
    else groups.push({ from: h.dayOfWeek, to: h.dayOfWeek, text });
  }
  return groups.map((g) => ({ days: g.from === g.to ? DAYS[g.from] : `${DAYS[g.from]} – ${DAYS[g.to]}`, text: g.text }));
}

export function OpeningHours({ hours, inverted, className }: { hours: OpeningHour[]; inverted?: boolean; className?: string }) {
  if (!hours.length) return null;
  return (
    <dl className={cn('grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-[14px]', className)}>
      {groupHours(hours).map((g) => (
        <div key={g.days} className="contents">
          <dt className={inverted ? 'text-paper/60' : 'text-muted'}>{g.days}</dt>
          <dd className={cn('num', g.text === 'Fermé' && (inverted ? 'text-paper/50' : 'text-faint'))}>{g.text}</dd>
        </div>
      ))}
    </dl>
  );
}
