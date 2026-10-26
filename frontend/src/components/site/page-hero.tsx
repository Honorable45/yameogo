import Image from 'next/image';
import type { ReactNode } from 'react';
import { BackButton } from './back-button';

/** Bandeau de tête des pages intérieures : bleu nuit, photo facultative en fond, texte court. `back` = page de repli du bouton Retour. */
export function PageHero({ title, text, image, back = '/', children }: { title: string; text?: ReactNode; image?: string | null; back?: string; children?: ReactNode }) {
  return (
    <section className="relative overflow-hidden bg-navy text-white">
      {image && <Image src={image} alt="" fill priority sizes="100vw" className="object-cover" />}
      {image && <span className="absolute inset-0 bg-navy/70" aria-hidden="true" />}
      <div className="container-page relative pb-12 pt-40 sm:pb-16 lg:pt-32">
        <BackButton fallback={back} tone="dark" className="mb-6" />
        <h1 className="display text-[40px] leading-none sm:text-[56px]">{title}</h1>
        {text && <div className="mt-4 max-w-xl text-[15.5px] text-white/80">{text}</div>}
        {children && <div className="mt-7">{children}</div>}
      </div>
    </section>
  );
}
