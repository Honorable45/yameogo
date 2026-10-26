'use client';

import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/cn';

/**
 * Bouton « Retour » placé en tête de page.
 * Revient à la page précédente ; si la page a été ouverte directement (aucun historique), va vers `fallback`.
 * `tone="dark"` : sur un bandeau bleu nuit ou une photo ; `tone="light"` : sur fond clair.
 */
export function BackButton({ fallback = '/', tone = 'light', className }: { fallback?: string; tone?: 'light' | 'dark'; className?: string }) {
  const router = useRouter();
  const goBack = () => {
    if (window.history.length > 1) router.back();
    else router.push(fallback);
  };
  return (
    <button
      type="button"
      onClick={goBack}
      className={cn(
        'group inline-flex h-10 items-center gap-2 rounded-full pl-3 pr-4 text-[14px] font-medium transition-colors',
        tone === 'dark' ? 'glass text-white hover:bg-white/25' : 'glass-light text-ink hover:bg-white',
        className,
      )}
    >
      <ArrowLeft className="size-[18px] transition-transform group-hover:-translate-x-0.5" />
      Retour
    </button>
  );
}
