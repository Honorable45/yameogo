'use client';

/**
 * Chargeur d'images :
 * - photos téléversées : l'API produit des déclinaisons WebP en 480, 960 et 1600 px ;
 * - photos sur Cloudinary : largeur, format (AVIF/WebP) et qualité choisis par Cloudinary à la volée ;
 * - photos Unsplash : redimensionnement par le CDN d'Unsplash.
 */
const WIDTHS = [480, 960, 1600];

export default function imageLoader({ src, width, quality }: { src: string; width: number; quality?: number }) {
  if (src.startsWith('https://res.cloudinary.com/') && src.includes('/image/upload/')) {
    return src.replace('/image/upload/', `/image/upload/c_limit,w_${width},f_auto,q_${quality ?? 'auto'}/`);
  }
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
