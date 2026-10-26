'use client';

import { useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import type { OpeningHour } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { FormError, Input } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { Panel } from '../ui';

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

export function HoursPanel({ hours }: { hours: OpeningHour[] }) {
  const { notify } = useToast();
  const [days, setDays] = useState<OpeningHour[]>(() =>
    DAYS.map((_, i) => hours.find((h) => h.dayOfWeek === i + 1) ?? { dayOfWeek: i + 1, closed: true, opensAt: null, closesAt: null }),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (i: number, patch: Partial<OpeningHour>) => setDays(days.map((d, j) => (j === i ? { ...d, ...patch } : d)));

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.put('/settings/opening-hours', { days });
      notify('Horaires enregistrés.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel title="Horaires d’ouverture">
      <p className="mb-4 text-[13.5px] text-muted">Tant qu’aucun horaire n’est enregistré, le site n’en affiche pas.</p>
      <ul className="divide-y divide-line">
        {days.map((d, i) => (
          <li key={d.dayOfWeek} className="grid grid-cols-[6.5rem_1fr] items-center gap-3 py-2.5 sm:grid-cols-[7rem_8rem_1fr]">
            <span className="text-[14px]">{DAYS[i]}</span>
            <label className="flex items-center gap-2 text-[13.5px]">
              <input type="checkbox" className="size-4 accent-accent" checked={!d.closed} onChange={(e) => set(i, { closed: !e.target.checked, opensAt: d.opensAt ?? '08:00', closesAt: d.closesAt ?? '19:00' })} />
              {d.closed ? 'Fermé' : 'Ouvert'}
            </label>
            {!d.closed && (
              <span className="col-span-2 flex items-center gap-2 sm:col-span-1">
                <Input type="time" value={d.opensAt ?? ''} onChange={(e) => set(i, { opensAt: e.target.value })} aria-label={`Ouverture ${DAYS[i]}`} className="w-32" />
                <span className="text-muted">–</span>
                <Input type="time" value={d.closesAt ?? ''} onChange={(e) => set(i, { closesAt: e.target.value })} aria-label={`Fermeture ${DAYS[i]}`} className="w-32" />
                {i > 0 && (
                  <button type="button" className="ml-1 text-[12px] text-muted underline" onClick={() => set(i, { closed: days[i - 1].closed, opensAt: days[i - 1].opensAt, closesAt: days[i - 1].closesAt })}>
                    Comme la veille
                  </button>
                )}
              </span>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-4"><FormError message={error} /></div>
      <Button className="mt-3" onClick={save} loading={saving}>Enregistrer les horaires</Button>
    </Panel>
  );
}
