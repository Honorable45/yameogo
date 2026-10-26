'use client';

import { Check, CircleAlert, X } from 'lucide-react';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface Toast {
  id: number;
  tone: 'ok' | 'bad';
  message: string;
}

const ToastContext = createContext<{ notify: (message: string, tone?: 'ok' | 'bad') => void }>({ notify: () => {} });

/** Notifications courtes de confirmation ou d'erreur, annoncées aux lecteurs d'écran. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = useCallback((message: string, tone: 'ok' | 'bad' = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, tone, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'bad' ? 6000 : 3500);
  }, []);

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:bottom-4 sm:items-end sm:pr-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === 'bad' ? 'alert' : 'status'}
            className={cn(
              'pointer-events-auto flex w-full max-w-sm animate-slide-up items-start gap-3 rounded-sm bg-ink px-4 py-3 text-[14px] text-white shadow-pop',
            )}
          >
            {t.tone === 'ok' ? <Check className="mt-0.5 size-4 shrink-0 text-[#9fd3b4]" /> : <CircleAlert className="mt-0.5 size-4 shrink-0 text-[#f0a79e]" />}
            <span className="flex-1">{t.message}</span>
            <button type="button" aria-label="Fermer" onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))} className="text-white/60 hover:text-white">
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
