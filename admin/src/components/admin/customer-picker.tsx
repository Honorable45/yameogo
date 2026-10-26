'use client';

import { UserRound, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { formatPhone } from '@/lib/format';
import { useDebounced } from '@/lib/use-resource';
import { Field, Input } from '@/components/ui/field';

export interface CustomerChoice {
  id?: string;
  name: string;
  phone: string;
}

interface Found {
  id: string;
  name: string;
  phone: string;
}

/**
 * Choix d'un client : recherche par nom ou téléphone parmi les clients connus,
 * ou saisie d'un nouveau client (créé automatiquement à l'enregistrement).
 */
export function CustomerPicker({ value, onChange, optional }: { value: CustomerChoice; onChange: (v: CustomerChoice) => void; optional?: boolean }) {
  const [results, setResults] = useState<Found[]>([]);
  const [focused, setFocused] = useState(false);
  const term = useDebounced(value.id ? '' : value.phone || value.name, 250);

  useEffect(() => {
    if (term.trim().length < 3) return setResults([]);
    let cancelled = false;
    api
      .get<{ items: Found[] }>(`/customers?q=${encodeURIComponent(term.trim())}&pageSize=5`)
      .then((r) => !cancelled && setResults(r.items))
      .catch(() => !cancelled && setResults([]));
    return () => {
      cancelled = true;
    };
  }, [term]);

  if (value.id) {
    return (
      <div className="flex items-center gap-3 rounded-sm border border-line-2 bg-paper/60 px-3 py-2.5">
        <UserRound className="size-4 text-muted" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-medium">{value.name}</p>
          <p className="num text-[12.5px] text-muted">{formatPhone(value.phone)} · client connu</p>
        </div>
        <button type="button" onClick={() => onChange({ name: '', phone: '' })} className="inline-flex size-8 items-center justify-center rounded-sm text-muted hover:bg-paper-2" aria-label="Changer de client">
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Téléphone du client" optional={optional}>
          {(p) => (
            <Input
              {...p}
              type="tel"
              inputMode="tel"
              value={value.phone}
              onFocus={() => setFocused(true)}
              onBlur={() => setTimeout(() => setFocused(false), 150)}
              onChange={(e) => onChange({ ...value, phone: e.target.value })}
              placeholder="90 00 00 00"
            />
          )}
        </Field>
        <Field label="Nom du client" optional={optional}>
          {(p) => <Input {...p} value={value.name} onFocus={() => setFocused(true)} onBlur={() => setTimeout(() => setFocused(false), 150)} onChange={(e) => onChange({ ...value, name: e.target.value })} />}
        </Field>
      </div>
      {focused && results.length > 0 && (
        <ul className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-md border border-line bg-surface shadow-pop">
          <li className="border-b border-line px-3 py-1.5 text-[11.5px] text-faint">Clients existants</li>
          {results.map((c) => (
            <li key={c.id}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => onChange({ id: c.id, name: c.name, phone: c.phone })} className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-[14px] hover:bg-paper">
                <span className="font-medium">{c.name}</span>
                <span className="num text-[13px] text-muted">{formatPhone(c.phone)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
