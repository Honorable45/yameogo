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

// Application d'administration, séparée du site public.
const config: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  images: {
    // Les images sont déjà déclinées en plusieurs largeurs (API ou CDN Unsplash) : chargeur personnalisé.
    loader: 'custom',
    loaderFile: './src/lib/image-loader.ts',
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
    return [{ source: '/:path*', headers: [...security, { key: 'X-Robots-Tag', value: 'noindex, nofollow' }] }];
  },
};

export default config;
