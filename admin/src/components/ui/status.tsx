import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type Tone = 'ok' | 'warn' | 'bad' | 'info' | 'neutral' | 'done';

const dot: Record<Tone, string> = {
  ok: 'bg-ok',
  warn: 'bg-warn',
  bad: 'bg-bad',
  info: 'bg-accent',
  neutral: 'bg-faint',
  done: 'bg-ink-2',
};

const pill: Record<Tone, string> = {
  ok: 'bg-ok-soft text-ok',
  warn: 'bg-warn-soft text-warn',
  bad: 'bg-bad-soft text-bad',
  info: 'bg-accent-soft text-accent',
  neutral: 'bg-paper-2 text-ink-2',
  done: 'bg-paper-2 text-ink',
};

/** Statut sobre : pastille de couleur + libellé. */
export function Status({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 whitespace-nowrap text-[13px] text-ink-2', className)}>
      <span className={cn('size-1.5 shrink-0 rounded-full', dot[tone])} aria-hidden="true" />
      {children}
    </span>
  );
}

/** Variante étiquette, pour les mentions à mettre en avant (vérifié, démo…). */
export function Tag({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-xs px-1.5 py-0.5 text-[11.5px] font-medium leading-none', pill[tone], className)}>{children}</span>;
}
