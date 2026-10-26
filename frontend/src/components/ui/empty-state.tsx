import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function EmptyState({ icon: Icon, title, children, action, className }: { icon?: LucideIcon; title: string; children?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-14 text-center', className)}>
      {Icon && <Icon className="mb-4 size-6 text-faint" strokeWidth={1.5} aria-hidden="true" />}
      <p className="display text-[20px] text-ink">{title}</p>
      {children && <div className="mt-2 max-w-sm text-[14px] text-muted">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <p className="text-[14px] text-bad">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="text-[14px] font-medium text-accent underline">
          Réessayer
        </button>
      )}
    </div>
  );
}
