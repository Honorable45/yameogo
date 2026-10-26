'use client';

import { ChevronDown } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/** Tri des listes (accessoires, téléphones), conservé dans l'adresse. */
export function SortSelect({ value }: { value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  return (
    <div className="relative shrink-0">
      <select
        aria-label="Trier"
        value={value}
        onChange={(e) => {
          const next = new URLSearchParams(search.toString());
          if (e.target.value === 'nouveautes') next.delete('tri');
          else next.set('tri', e.target.value);
          next.delete('page');
          router.push(`${pathname}${next.size ? `?${next}` : ''}`, { scroll: false });
        }}
        className="glass-light h-10 appearance-none rounded-full pl-4 pr-10 text-[13.5px] text-ink outline-none focus:ring-2 focus:ring-accent"
      >
        <option value="nouveautes">Nouveautés</option>
        <option value="prix-croissant">Prix croissant</option>
        <option value="prix-decroissant">Prix décroissant</option>
      </select>
      <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
    </div>
  );
}
