import Link from 'next/link';
import { forwardRef, type ButtonHTMLAttributes, type ComponentProps } from 'react';
import { cn } from '@/lib/cn';
import { Spinner } from './spinner';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'quiet';
type Size = 'sm' | 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition-colors duration-150 disabled:opacity-50 disabled:pointer-events-none select-none';

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-ink active:bg-accent-ink',
  secondary: 'bg-surface text-ink border border-line-2 hover:border-ink-2 hover:bg-paper',
  ghost: 'text-ink-2 hover:bg-paper-2 hover:text-ink',
  danger: 'bg-surface text-bad border border-bad/40 hover:bg-bad-soft',
  quiet: 'bg-paper-2 text-ink hover:bg-paper-3',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-11 px-4 text-[14px] sm:h-10',
  lg: 'h-12 px-6 text-[15px]',
};

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, disabled, className, children, type = 'button', ...props },
  ref,
) {
  return (
    <button ref={ref} type={type} disabled={disabled || loading} aria-busy={loading || undefined} className={buttonClass(variant, size, className)} {...props}>
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  );
});

export function ButtonLink({ variant = 'primary', size = 'md', className, ...props }: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

/** Bouton icône carré, toujours accompagné d'un libellé accessible. */
export function IconButton({ label, className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn('inline-flex size-10 items-center justify-center rounded-sm text-ink-2 transition-colors hover:bg-paper-2 hover:text-ink disabled:opacity-40', className)}
      {...props}
    >
      {children}
    </button>
  );
}
