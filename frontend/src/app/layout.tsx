import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { ToastProvider } from '@/components/ui/toast';
import './globals.css';
import { SITE_URL } from '@/lib/site';
import { ServiceWorkerRegister } from '@/components/site/pwa';

// Polices auto-hébergées (licence SIL OFL) : aucun appel à un service tiers, chargement plus rapide.
const serif = localFont({
  src: [
    { path: './fonts/newsreader-latin-opsz-normal.woff2', weight: '200 800', style: 'normal' },
    { path: './fonts/newsreader-latin-opsz-italic.woff2', weight: '200 800', style: 'italic' },
  ],
  variable: '--font-newsreader',
  display: 'swap',
  fallback: ['Georgia', 'Times New Roman', 'serif'],
});
const sans = localFont({
  src: [
    { path: './fonts/ibm-plex-sans-latin-400-normal.woff2', weight: '400' },
    { path: './fonts/ibm-plex-sans-latin-500-normal.woff2', weight: '500' },
    { path: './fonts/ibm-plex-sans-latin-600-normal.woff2', weight: '600' },
  ],
  variable: '--font-plex-sans',
  display: 'swap',
  fallback: ['system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
});
const mono = localFont({
  src: [
    { path: './fonts/ibm-plex-mono-latin-400-normal.woff2', weight: '400' },
    { path: './fonts/ibm-plex-mono-latin-500-normal.woff2', weight: '500' },
  ],
  variable: '--font-plex-mono',
  display: 'swap',
  preload: false,
});

const siteUrl = SITE_URL;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: 'YAMEOGO — Téléphones neufs, venus et d’occasion, accessoires et réparation', template: '%s · YAMEOGO' },
  description: 'Téléphones neufs, venus d’Europe ou des États-Unis et d’occasion, accessoires pour toutes les marques et réparation avec devis en ligne. Prix en FCFA.',
  openGraph: { type: 'website', locale: 'fr_FR', siteName: 'YAMEOGO' },
  icons: { icon: [{ url: '/icon.svg', type: 'image/svg+xml' }, { url: '/icon-192.png', sizes: '192x192', type: 'image/png' }], apple: '/apple-touch-icon.png' },
  // Application installée sur iPhone : ouverte sans barre d'adresse.
  appleWebApp: { capable: true, title: 'YAMEOGO', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: '#0f2147',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${serif.variable} ${sans.variable} ${mono.variable}`}>
      <body>
        <ToastProvider>{children}</ToastProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
