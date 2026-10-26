'use client';

import { useState } from 'react';
import type { PhoneCondition, PublicPhone } from '@/lib/types';
import { cn } from '@/lib/cn';
import { CONDITION_ORDER, PHONE_CONDITIONS } from '@/lib/phone-conditions';
import { PhoneCard } from './catalog';

/** Sélection de téléphones filtrable par catégorie, sans rechargement. */
export function PhonesShowcase({ phones, whatsapp }: { phones: PublicPhone[]; whatsapp: string | null }) {
  const available = CONDITION_ORDER.filter((c) => phones.some((p) => p.condition === c));
  const [filter, setFilter] = useState<PhoneCondition | 'ALL'>('ALL');
  const shown = phones.filter((p) => filter === 'ALL' || p.condition === filter).slice(0, 4);

  return (
    <>
      {available.length > 1 && (
        <div role="tablist" aria-label="Catégorie de téléphone" className="scrollbar-none -mx-4 mt-6 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {(['ALL', ...available] as const).map((c) => (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={filter === c}
              onClick={() => setFilter(c)}
              className={cn('h-9 shrink-0 rounded-full border px-4 text-[13.5px] font-medium transition-colors', filter === c ? 'border-navy bg-navy text-white' : 'border-line-2 bg-surface text-ink-2 hover:border-navy')}
            >
              {c === 'ALL' ? 'Tous' : PHONE_CONDITIONS[c].plural}
              <span className={cn('num ml-1.5 text-[12px]', filter === c ? 'text-white/70' : 'text-faint')}>{c === 'ALL' ? phones.length : phones.filter((p) => p.condition === c).length}</span>
            </button>
          ))}
        </div>
      )}
      {filter !== 'ALL' && <p className="mt-3 text-[14px] text-ink-2">{PHONE_CONDITIONS[filter].text}</p>}
      <div className="scrollbar-none -mx-4 mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-4 lg:gap-5">
        {shown.map((p) => (
          <div key={p.id} className="w-[72%] shrink-0 snap-start sm:w-auto">
            <PhoneCard phone={p} whatsapp={whatsapp} />
          </div>
        ))}
      </div>
    </>
  );
}
