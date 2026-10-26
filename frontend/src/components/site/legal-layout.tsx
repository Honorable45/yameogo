import type { ReactNode } from 'react';
import { PageHero } from './page-hero';

export function LegalLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <PageHero title={title} />
      <div className="container-page relative -mt-6">
        <article className="mx-auto max-w-3xl space-y-8 rounded-3xl border border-line bg-surface p-6 text-[15px] leading-relaxed text-ink-2 shadow-card sm:p-10 [&_h2]:mb-2 [&_h2]:text-[17px] [&_h2]:font-semibold [&_h2]:text-navy">{children}</article>
      </div>
    </>
  );
}
