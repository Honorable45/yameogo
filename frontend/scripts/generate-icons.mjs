// Génère les icônes de l'application (PWA) : monogramme « Y » de YAMEOGO.
// Usage : node scripts/generate-icons.mjs   (depuis frontend/, sharp est fourni par le backend)
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(new URL('../../backend/package.json', import.meta.url));
const sharp = require('sharp');
const out = (name) => fileURLToPath(new URL(`../public/${name}`, import.meta.url));

// Monogramme « Y » blanc et point cobalt sur graphite. `scale` : taille du « Y » (réduite pour les icônes
// « maskable », découpées en cercle par Android : tout doit tenir dans le cercle central).
const svg = (size, { scale = 0.56 } = {}) => {
  const y = size * scale;
  const dot = size * 0.045;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#13285a"/>
  <text x="${size / 2 - dot}" y="${size / 2 + y * 0.36}" text-anchor="middle" font-family="'IBM Plex Sans', 'DejaVu Sans', Arial, sans-serif" font-size="${y}" font-weight="600" fill="#f5f3ee">Y</text>
  <circle cx="${size / 2 + y * 0.36}" cy="${size / 2 + y * 0.36 - dot}" r="${dot}" fill="#f26a1b"/>
</svg>`;
};

const icons = [
  ['icon-192.png', 192, {}],
  ['icon-512.png', 512, {}],
  ['icon-maskable-512.png', 512, { scale: 0.42 }],
  ['apple-touch-icon.png', 180, {}],
];
for (const [name, size, opts] of icons) {
  await sharp(Buffer.from(svg(size, opts))).png().toFile(out(name));
  console.log('✔', name);
}
