/**
 * Adresse publique du site (SEO, plan du site, liens partagés dans les messages WhatsApp).
 * Calculée une seule fois dans next.config.ts : jamais localhost sur Vercel.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3100').replace(/\/$/, '');
