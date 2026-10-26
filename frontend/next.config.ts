import type { NextConfig } from 'next';

// URL interne de l'API NestJS (jamais exposée au navigateur : les appels passent par /api).
const API_URL = (process.env.API_URL ?? 'http://localhost:4100').replace(/\/$/, '');
// Le relais /api est figé au build : sans API_URL, Vercel enverrait tout vers localhost (erreur 404 DNS_HOSTNAME_RESOLVED_PRIVATE).
if (process.env.VERCEL) {
  console.log(`Relais /api → ${API_URL}`);
  const host = URL.canParse(API_URL) ? new URL(API_URL).hostname : '';
  if (!API_URL.startsWith('https://') || !host.includes('.') || host === 'localhost') {
    throw new Error(`API_URL invalide sur Vercel (« ${process.env.API_URL ?? 'absente'} ») : utilisez l'adresse publique, ex. https://votre-api.onrender.com, puis redéployez.`);
  }
}

// Adresse publique du site (SEO, plan du site, liens envoyés sur WhatsApp).
// Ordre : NEXT_PUBLIC_SITE_URL si définie (domaine personnalisé), sinon l'adresse de production
// que Vercel fournit automatiquement au build ; localhost uniquement en développement.
const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || (vercelHost ? `https://${vercelHost}` : 'http://localhost:3100')).replace(/\/$/, '');
if (process.env.VERCEL) {
  console.log(`Adresse du site → ${SITE_URL}`);
  if (SITE_URL.includes('localhost')) throw new Error('Adresse du site introuvable : définissez NEXT_PUBLIC_SITE_URL sur Vercel.');
}

const config: NextConfig = {
  env: { NEXT_PUBLIC_SITE_URL: SITE_URL },
  poweredByHeader: false,
  reactStrictMode: true,
  images: {
    // Les images sont déjà déclinées en plusieurs largeurs (API ou CDN Unsplash) : chargeur personnalisé.
    loader: 'custom',
    loaderFile: './src/lib/image-loader.ts',
  },
  async redirects() {
    // Anciennes adresses « occasions » (liens déjà partagés) vers la rubrique Téléphones.
    return [
      // Téléphones et accessoires sont des rayons de la boutique ; les filtres de l'adresse sont conservés.
      { source: '/telephones', destination: '/boutique', permanent: true },
      { source: '/accessoires', destination: '/boutique?rayon=accessoires', permanent: true },
      { source: '/occasions', destination: '/boutique?type=occasions', permanent: true },
      { source: '/occasions/:slug', destination: '/telephones/:slug', permanent: true },
      // Les accessoires ont quitté /boutique (devenue la présentation du magasin) ; le panier est remplacé par WhatsApp.
      { source: '/boutique/:slug', destination: '/accessoires/:slug', permanent: true },
      { source: '/panier', destination: '/boutique', permanent: false },
      { source: '/contact', destination: '/boutique', permanent: true },
    ];
  },
  async rewrites() {
    // Même origine pour le navigateur : cookies de session « first-party », pas de CORS côté client.
    return [{ source: '/api/:path*', destination: `${API_URL}/:path*` }];
  },
  async headers() {
    const security = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    ];
    return [
      { source: '/:path*', headers: security },
      // Le service worker doit toujours être relu, pour que les mises à jour du site arrivent aux applications installées.
      { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }, { key: 'Content-Type', value: 'application/javascript; charset=utf-8' }] },
    ];
  },
};

export default config;
