'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { qs } from './api';
import { useDebounced, useResource } from './use-resource';

export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

/**
 * Liste paginée avec recherche et onglet, synchronisés avec l'URL (le lien d'une vue filtrée est partageable).
 */
export function useList<T, Extra = object>(endpoint: string, buildParams: (tab: string) => Record<string, string | number | undefined>, defaultTab: string) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const tab = search.get('onglet') ?? defaultTab;
  const page = Number(search.get('page') ?? 1) || 1;
  const [q, setQ] = useState(search.get('q') ?? '');
  const debouncedQ = useDebounced(q, 300);

  const path = useMemo(() => `${endpoint}${qs({ ...buildParams(tab), q: debouncedQ.trim() || undefined, page, pageSize: 25 })}`, [endpoint, buildParams, tab, debouncedQ, page]);
  const resource = useResource<PageResult<T> & Extra>(path);

  const update = useCallback(
    (patch: Record<string, string | number | null>) => {
      const next = new URLSearchParams(search.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === '' || (k === 'onglet' && v === defaultTab) || (k === 'page' && v === 1)) next.delete(k);
        else next.set(k, String(v));
      }
      router.replace(`${pathname}${next.size ? `?${next}` : ''}`, { scroll: false });
    },
    [search, router, pathname, defaultTab],
  );

  return {
    ...resource,
    tab,
    page,
    q,
    setQ: (v: string) => {
      setQ(v);
      if (page !== 1) update({ page: 1 });
    },
    setTab: (v: string) => update({ onglet: v, page: 1 }),
    setPage: (p: number) => update({ page: p }),
  };
}
