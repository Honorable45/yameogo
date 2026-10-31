import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { ToastProvider } from '@/components/ui/toast';
import './globals.css';

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

export const metadata: Metadata = {
  title: { default: 'Gestion · Le Marchand', template: '%s · Gestion Le Marchand' },
  robots: { index: false, follow: false },
  icons: { icon: '/icon.svg' },
};

export const viewport: Viewport = {
  themeColor: '#f5f3ee',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${serif.variable} ${sans.variable} ${mono.variable}`}>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
