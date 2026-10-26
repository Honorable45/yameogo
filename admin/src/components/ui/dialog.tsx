'use client';

import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Fenêtre de dialogue basée sur l'élément natif <dialog> :
 * focus piégé, touche Échap et arrière-plan inerte fournis par le navigateur.
 * Sur mobile, elle s'ouvre comme un panneau ancré en bas de l'écran.
 */
export function Dialog({ open, onClose, title, description, children, footer, size = 'md' }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-labelledby="dialog-title"
      className={cn(
        'm-0 mt-auto w-full max-w-none rounded-t-md bg-surface p-0 text-ink shadow-pop backdrop:animate-fade-in open:animate-slide-up',
        'sm:m-auto sm:rounded-md',
        size === 'sm' && 'sm:max-w-md',
        size === 'md' && 'sm:max-w-xl',
        size === 'lg' && 'sm:max-w-3xl',
      )}
    >
      {open && (
        <div className="flex max-h-[88dvh] flex-col">
          <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div>
              <h2 id="dialog-title" className="display text-[22px]">
                {title}
              </h2>
              {description && <p className="mt-1 text-[14px] text-muted">{description}</p>}
            </div>
            <button type="button" onClick={onClose} aria-label="Fermer" className="-mr-2 -mt-1 inline-flex size-9 items-center justify-center rounded-sm text-muted hover:bg-paper-2 hover:text-ink">
              <X className="size-5" />
            </button>
          </header>
          <div className="overflow-y-auto px-5 py-5">{children}</div>
          {footer && <footer className="flex flex-col-reverse gap-2 border-t border-line bg-paper/60 px-5 py-3 sm:flex-row sm:justify-end">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}
