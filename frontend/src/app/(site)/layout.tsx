import type { ReactNode } from 'react';
import { SiteFooter } from '@/components/site/footer';
import { SiteHeader } from '@/components/site/header';
import { serverGet } from '@/lib/server-api';
import type { PublicSettings } from '@/lib/types';

export default async function SiteLayout({ children }: { children: ReactNode }) {
  const settings = await serverGet<PublicSettings>('/settings/public', 60);
  return (
    <>
      <a href="#contenu" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-sm focus:bg-ink focus:px-3 focus:py-2 focus:text-white">
        Aller au contenu
      </a>
      <SiteHeader logoUrl={settings?.logoUrl ?? null} shopName={settings?.shopName ?? 'Yameogo Smart Tech'} whatsapp={settings?.whatsapp ?? null} />
      {/* L'en-tête flotte au-dessus du contenu : chaque page réserve sa hauteur, sauf l'accueil (image plein cadre). */}
      <main id="contenu">{children}</main>
      <SiteFooter settings={settings} />
    </>
  );
}
