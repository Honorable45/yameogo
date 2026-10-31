// Génère les icônes de l'application (PWA) : sac du logo Le Marchand.
// Usage : node scripts/generate-icons.mjs   (depuis frontend/, sharp est fourni par le backend)
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(new URL('../../backend/package.json', import.meta.url));
const sharp = require('sharp');
const out = (name) => fileURLToPath(new URL(`../public/${name}`, import.meta.url));

// Sac du logo sur fond noir. `scale` : taille du sac (réduite pour les icônes « maskable »,
// découpées en cercle par Android : tout doit tenir dans le cercle central).
const BAG = `<path d="M348 232C362 120 425 76 482 78C560 84 612 150 626 250" fill="none" stroke="#de8e22" stroke-width="30"/>
  <path d="M416 236C430 130 490 90 532 92C612 96 664 170 678 254" fill="none" stroke="#f59a1e" stroke-width="30"/>
  <path d="M120 248L225 228L222 972L66 918Z" fill="#db851b"/>
  <path d="M258 226L820 262L860 548L750 345L585 648L335 348L258 648Z" fill="#f59a1e"/>
  <path d="M254 982L385 560L605 825L752 540L912 885Z" fill="#f59a1e"/>`;
const svg = (size, { scale = 0.72 } = {}) => {
  const k = (size * scale) / 935;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#0d0d0d"/>
  <g transform="translate(${size / 2 - 489 * k} ${size / 2 - 527 * k}) scale(${k})">${BAG}</g>
</svg>`;
};

const icons = [
  ['icon-192.png', 192, {}],
  ['icon-512.png', 512, {}],
  ['icon-maskable-512.png', 512, { scale: 0.56 }],
  ['apple-touch-icon.png', 180, {}],
];
for (const [name, size, opts] of icons) {
  await sharp(Buffer.from(svg(size, opts))).png().toFile(out(name));
  console.log('✔', name);
}
