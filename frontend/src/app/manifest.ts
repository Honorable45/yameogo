import type { MetadataRoute } from 'next';

/** Manifeste de l'application installable (PWA). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Le Marchand — Smartphones et accessoires',
    short_name: 'Le Marchand',
    description: 'Smartphones neufs et d’occasion, accessoires. Commande sur WhatsApp.',
    lang: 'fr',
    start_url: '/?source=pwa',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f5f3ee',
    theme_color: '#13285a',
    categories: ['shopping', 'business'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Smartphones', url: '/telephones', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
      { name: 'Accessoires', url: '/accessoires', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
      { name: 'Panier', url: '/panier', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
    ],
  };
}
