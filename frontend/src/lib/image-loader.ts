'use client';

/**
 * Chargeur d'images :
 * - photos téléversées (disque local ou Cloudflare R2) : déclinaisons WebP en 480, 960 et 1600 px ;
 * - photos Unsplash : redimensionnement par le CDN d'Unsplash.
 */
const WIDTHS = [480, 960, 1600];

export default function imageLoader({ src, width, quality }: { src: string; width: number; quality?: number }) {
  if (src.includes('images.unsplash.com')) {
    const base = src.split('?')[0];
    return `${base}?w=${width}&q=${quality ?? 72}&auto=format&fit=crop`;
  }
  const match = src.match(/^(.*)-(480|960|1600)\.webp$/);
  if (match) {
    const target = WIDTHS.find((w) => w >= width) ?? 1600;
    return `${match[1]}-${target}.webp`;
  }
  return src;
}
