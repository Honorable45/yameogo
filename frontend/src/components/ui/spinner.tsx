import { cn } from '@/lib/cn';

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn('size-5 animate-spin', className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-sm bg-paper-2', className)} aria-hidden="true" />;
}

export function LoadingBlock({ label = 'Chargement…', className }: { label?: string; className?: string }) {
  return (
    <div className={cn('flex items-center justify-center gap-3 py-16 text-[14px] text-muted', className)} role="status">
      <Spinner className="size-4" />
      {label}
    </div>
  );
}
