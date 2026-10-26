import { cn } from '@/lib/cn';
import { WhatsAppIcon } from './whatsapp';

/**
 * Bouton « Acheter » en verre : ouvre WhatsApp avec le produit déjà indiqué dans le message.
 * `overlay` : posé sur une photo (verre clair) ; sinon verre sombre sur fond clair.
 */
export function BuyButton({ href, label = 'Acheter', size = 'md', overlay, disabled, className }: { href: string; label?: string; size?: 'sm' | 'md' | 'lg'; overlay?: boolean; disabled?: boolean; className?: string }) {
  const sizes = { sm: 'h-9 px-4 text-[13px] gap-1.5', md: 'h-11 px-5 text-[14.5px] gap-2', lg: 'h-14 px-8 text-[16px] gap-2.5' };
  if (disabled) {
    return <span className={cn('inline-flex items-center justify-center rounded-full bg-ink/40 font-medium text-white backdrop-blur-sm', sizes[size], className)}>Épuisé</span>;
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'inline-flex items-center justify-center rounded-full font-medium text-white transition-[transform,background-color] duration-200 hover:-translate-y-0.5 active:scale-[0.98]',
        overlay ? 'glass hover:bg-white/25' : 'glass-dark hover:bg-navy/80',
        sizes[size],
        className,
      )}
    >
      <WhatsAppIcon className={size === 'lg' ? 'size-5' : 'size-4'} />
      {label}
    </a>
  );
}
