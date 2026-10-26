'use client';

import { Package, ReceiptText, Search, Smartphone, UserRound, Wrench } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useDebounced } from '@/lib/use-resource';
import { Spinner } from '@/components/ui/spinner';

interface Result {
  type: 'repair' | 'order' | 'customer' | 'product' | 'phone';
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

const ICONS = { repair: Wrench, order: ReceiptText, customer: UserRound, product: Package, phone: Smartphone };
const TYPES = { repair: 'Réparation', order: 'Commande', customer: 'Client', product: 'Article', phone: 'Occasion' };

/** Recherche globale : numéros de dossier, clients (nom ou téléphone), articles, commandes. */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const query = useDebounced(q, 200);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      setTimeout(() => input.current?.focus(), 10);
    }
    if (!open && el.open) el.close();
  }, [open]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api
      .get<{ results: Result[] }>(`/search?q=${encodeURIComponent(query.trim())}`)
      .then((r) => {
        if (!cancelled) {
          setResults(r.results);
          setActive(0);
        }
      })
      .catch(() => !cancelled && setResults([]))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [query]);

  const go = (r: Result) => {
    onClose();
    setQ('');
    router.push(r.href);
  };

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-label="Recherche"
      className="mx-auto mt-[12vh] w-[calc(100%-2rem)] max-w-xl rounded-md bg-surface p-0 shadow-pop open:animate-slide-up"
    >
      <div className="flex items-center gap-3 border-b border-line px-4">
        <Search className="size-4 text-muted" />
        <input
          ref={input}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, results.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === 'Enter' && results[active]) go(results[active]);
          }}
          placeholder="N° de dossier, nom, téléphone, référence…"
          className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint"
          aria-label="Rechercher"
        />
        {loading && <Spinner className="size-4 text-muted" />}
      </div>
      <ul className="max-h-[50vh] overflow-y-auto p-1.5" role="listbox">
        {results.map((r, i) => {
          const Icon = ICONS[r.type];
          return (
            <li key={`${r.type}-${r.id}`} role="option" aria-selected={i === active}>
              <button type="button" onMouseEnter={() => setActive(i)} onClick={() => go(r)} className={cn('flex w-full items-center gap-3 rounded-sm px-3 py-2.5 text-left', i === active && 'bg-paper')}>
                <Icon className="size-4 shrink-0 text-muted" strokeWidth={1.75} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium">{r.title}</span>
                  <span className="block truncate text-[12.5px] text-muted">{r.subtitle}</span>
                </span>
                <span className="text-[11.5px] text-faint">{TYPES[r.type]}</span>
              </button>
            </li>
          );
        })}
        {query.trim().length >= 2 && !loading && results.length === 0 && <li className="px-3 py-6 text-center text-[14px] text-muted">Aucun résultat pour « {query} ».</li>}
        {query.trim().length < 2 && <li className="px-3 py-6 text-center text-[13.5px] text-faint">Tapez au moins deux caractères.</li>}
      </ul>
    </dialog>
  );
}
