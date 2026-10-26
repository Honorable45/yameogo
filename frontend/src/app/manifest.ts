import type { MetadataRoute } from 'next';

/** Manifeste de l'application installable (PWA). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'YAMEOGO — Téléphones, accessoires et réparation',
    short_name: 'YAMEOGO',
    description: 'Téléphones neufs, venus et d’occasion, accessoires et devis de réparation. Achat sur WhatsApp.',
    lang: 'fr',
    start_url: '/?source=pwa',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f5f3ee',
    theme_color: '#0f2147',
    categories: ['shopping', 'business'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Boutique', url: '/boutique', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
      { name: 'Accessoires', url: '/boutique?rayon=accessoires', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
      { name: 'Devis de réparation', url: '/reparation', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
    ],
  };
}
