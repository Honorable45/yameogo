'use client';

import { ArrowLeft, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/ui/field';

export function PageHeader({ title, description, actions, back, children }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; back?: { href: string; label: string }; children?: ReactNode }) {
  return (
    <header className="mb-6 lg:mb-8">
      {back && (
        <Link href={back.href} className="mb-3 inline-flex items-center gap-1.5 text-[13.5px] text-muted hover:text-ink">
          <ArrowLeft className="size-4" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="display text-[28px] sm:text-[32px]">{title}</h1>
          {description && <div className="mt-1.5 text-[14px] text-muted">{description}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children && <div className="mt-5">{children}</div>}
    </header>
  );
}

export function Panel({ title, actions, children, className, bodyClassName, id }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string; id?: string }) {
  return (
    <section id={id} className={cn('rounded-md border border-line bg-surface', className)}>
      {(title || actions) && (
        <div className="flex min-h-12 items-center justify-between gap-3 border-b border-line px-4 py-2.5 sm:px-5">
          {title && <h2 className="text-[14.5px] font-medium text-ink">{title}</h2>}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={bodyClassName ?? 'px-4 py-4 sm:px-5'}>{children}</div>
    </section>
  );
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { value: T; label: string; count?: number | null }[] }) {
  return (
    <div className="scrollbar-none -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div role="tablist" className="flex min-w-max gap-5 border-b border-line">
        {items.map((it) => (
          <button
            key={it.value}
            type="button"
            role="tab"
            aria-selected={value === it.value}
            onClick={() => onChange(it.value)}
            className={cn(
              '-mb-px flex h-10 items-center gap-1.5 border-b-2 text-[14px] transition-colors',
              value === it.value ? 'border-accent font-medium text-ink' : 'border-transparent text-muted hover:text-ink',
            )}
          >
            {it.label}
            {it.count ? <span className="num rounded-full bg-paper-2 px-1.5 text-[11.5px] text-ink-2">{it.count}</span> : null}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Rechercher…', className }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
      <Input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="pl-9" aria-label={placeholder} />
    </div>
  );
}

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: 'left' | 'right';
  className?: string;
  /** Masqué dans la vue mobile (déjà présent dans le titre de la ligne). */
  hideOnMobile?: boolean;
  sortable?: boolean;
}

/**
 * Tableau de données. Sur mobile, chaque ligne devient une fiche compacte
 * (titre + paires libellé/valeur) au lieu d'un tableau à défilement horizontal.
 */
export function DataTable<T extends { id: string }>({
  rows,
  columns,
  href,
  mobileTitle,
  sort,
  onSort,
  empty,
}: {
  rows: T[];
  columns: Column<T>[];
  href?: (row: T) => string;
  mobileTitle?: (row: T) => ReactNode;
  sort?: { key: string; dir: 'asc' | 'desc' };
  onSort?: (key: string) => void;
  empty?: ReactNode;
}) {
  const router = useRouter();
  if (!rows.length) return <>{empty}</>;
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-[14px]">
          <thead>
            <tr className="border-b border-line">
              {columns.map((c) => (
                <th key={c.key} scope="col" className={cn('h-10 whitespace-nowrap px-3 text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted first:pl-5 last:pr-5', c.align === 'right' ? 'text-right' : 'text-left', c.className)}>
                  {c.sortable && onSort ? (
                    <button type="button" onClick={() => onSort(c.key)} className="inline-flex items-center gap-1 uppercase hover:text-ink">
                      {c.header}
                      {sort?.key === c.key && <span aria-hidden="true">{sort.dir === 'asc' ? '↑' : '↓'}</span>}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className={cn('border-b border-line last:border-0', href && 'cursor-pointer hover:bg-paper/70')} onClick={href ? () => router.push(href(row)) : undefined}>
                {columns.map((c, i) => (
                  <td key={c.key} className={cn('h-12 px-3 py-2 align-middle first:pl-5 last:pr-5', c.align === 'right' && 'num text-right', c.className)}>
                    {i === 0 && href ? (
                      <Link href={href(row)} onClick={(e) => e.stopPropagation()} className="hover:underline">
                        {c.cell(row)}
                      </Link>
                    ) : (
                      c.cell(row)
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="divide-y divide-line md:hidden">
        {rows.map((row) => {
          const content = (
            <>
              <div className="text-[14.5px] font-medium">{mobileTitle ? mobileTitle(row) : columns[0].cell(row)}</div>
              <dl className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 text-[13px]">
                {columns
                  .slice(mobileTitle ? 0 : 1)
                  .filter((c) => !c.hideOnMobile)
                  .map((c) => (
                    <div key={c.key} className="min-w-0">
                      <dt className="text-[11.5px] text-faint">{c.header}</dt>
                      <dd className={cn('truncate', c.align === 'right' && 'num')}>{c.cell(row)}</dd>
                    </div>
                  ))}
              </dl>
            </>
          );
          return (
            <li key={row.id}>
              {href ? (
                <Link href={href(row)} className="block px-4 py-3.5 active:bg-paper">
                  {content}
                </Link>
              ) : (
                <div className="px-4 py-3.5">{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

export function Pagination({ page, pageCount, total, onPage }: { page: number; pageCount: number; total: number; onPage: (p: number) => void }) {
  if (pageCount <= 1) return <p className="num px-5 py-3 text-[13px] text-muted">{total} résultat{total > 1 ? 's' : ''}</p>;
  return (
    <div className="flex items-center justify-between border-t border-line px-4 py-2.5 sm:px-5">
      <p className="num text-[13px] text-muted">
        {total} résultats · page {page}/{pageCount}
      </p>
      <div className="flex gap-1">
        <button type="button" onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Page précédente" className="inline-flex size-9 items-center justify-center rounded-sm text-ink-2 hover:bg-paper-2 disabled:opacity-30">
          <ChevronLeft className="size-4" />
        </button>
        <button type="button" onClick={() => onPage(page + 1)} disabled={page >= pageCount} aria-label="Page suivante" className="inline-flex size-9 items-center justify-center rounded-sm text-ink-2 hover:bg-paper-2 disabled:opacity-30">
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );
}

export function DetailList({ items, className }: { items: [ReactNode, ReactNode][]; className?: string }) {
  return (
    <dl className={cn('divide-y divide-line text-[14px]', className)}>
      {items.map(([k, v], i) => (
        <div key={i} className="grid grid-cols-[9.5rem_1fr] gap-3 py-2.5 first:pt-0 last:pb-0 sm:grid-cols-[11rem_1fr]">
          <dt className="text-muted">{k}</dt>
          <dd className="min-w-0 break-words text-ink">{v ?? <span className="text-faint">—</span>}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Indicateur chiffré sobre : libellé, valeur, mention secondaire. */
export function Metric({ label, value, note, tone, className }: { label: string; value: ReactNode; note?: ReactNode; tone?: 'ok' | 'bad' | 'muted'; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <p className="text-[12.5px] text-muted">{label}</p>
      <p className={cn('num mt-1 truncate text-[24px] font-semibold leading-tight tracking-tight sm:text-[26px]', tone === 'bad' && 'text-bad', tone === 'muted' && 'text-ink-2')}>{value}</p>
      {note && <p className="mt-1 truncate text-[12.5px] text-muted">{note}</p>}
    </div>
  );
}

/**
 * Confirmation d'une action irréversible ou sensible.
 * `reason` : un motif écrit est exigé (annulations, corrections financières).
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  children,
  confirmLabel = 'Confirmer',
  danger,
  reason,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void | Promise<void>;
  title: string;
  children?: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  reason?: { label: string; placeholder?: string };
  loading?: boolean;
}) {
  const [text, setText] = useState('');
  const valid = !reason || text.trim().length >= 5;
  return (
    <Dialog
      open={open}
      onClose={() => {
        setText('');
        onClose();
      }}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Retour
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} disabled={!valid} loading={loading} onClick={async () => {
            await onConfirm(text.trim());
            setText('');
          }}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children && <div className="text-[14.5px] leading-relaxed text-ink-2">{children}</div>}
      {reason && (
        <Field label={reason.label} className={children ? 'mt-4' : undefined} hint="5 caractères minimum. Conservé dans l’historique.">
          {(p) => <Textarea {...p} value={text} onChange={(e) => setText(e.target.value)} placeholder={reason.placeholder} rows={3} maxLength={300} />}
        </Field>
      )}
    </Dialog>
  );
}

export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-col gap-2 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:px-5', className)}>{children}</div>;
}
