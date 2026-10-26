import { ChevronDown } from 'lucide-react';
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

const control =
  'w-full rounded-xl border border-line-2 bg-surface px-4 text-[15px] text-ink placeholder:text-faint transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:bg-paper disabled:text-muted aria-[invalid=true]:border-bad sm:text-[14px]';

interface FieldProps {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  optional?: boolean;
  className?: string;
  children: (props: { id: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }) => ReactNode;
}

/** Libellé + contrôle + aide + erreur, reliés pour les lecteurs d'écran. */
export function Field({ label, hint, error, optional, className, children }: FieldProps) {
  const id = useId();
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-[13px] font-medium text-ink-2">
        {label}
        {optional && <span className="ml-1.5 font-normal text-faint">facultatif</span>}
      </label>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy })}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-[12.5px] leading-snug text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-[12.5px] leading-snug text-bad">
          {error}
        </p>
      )}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(control, 'h-11 sm:h-10', className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, rows = 3, ...props }, ref) {
  return <textarea ref={ref} rows={rows} className={cn(control, 'py-2.5 leading-relaxed', className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...props }, ref) {
  return (
    <div className="relative">
      <select ref={ref} className={cn(control, 'h-11 appearance-none pr-9 sm:h-10', className)} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
    </div>
  );
});

/** Champ de montant en FCFA : entier positif, unité affichée. */
export const MoneyInput = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>>(function MoneyInput({ className, ...props }, ref) {
  return (
    <div className="relative">
      <input ref={ref} type="number" inputMode="numeric" min={0} step={1} className={cn(control, 'num h-11 pr-16 sm:h-10', className)} {...props} />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] font-medium text-muted">FCFA</span>
    </div>
  );
});

export function Checkbox({ label, description, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; description?: ReactNode }) {
  const id = useId();
  return (
    <div className={cn('flex items-start gap-3', className)}>
      <input id={id} type="checkbox" className="mt-0.5 size-[18px] shrink-0 rounded-xs border-line-2 accent-accent" {...props} />
      <label htmlFor={id} className="text-[14px] leading-snug text-ink">
        {label}
        {description && <span className="mt-0.5 block text-[13px] text-muted">{description}</span>}
      </label>
    </div>
  );
}

export function FormError({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <div role="alert" className="rounded-sm border border-bad/30 bg-bad-soft px-3 py-2.5 text-[14px] text-bad">
      {message}
    </div>
  );
}
