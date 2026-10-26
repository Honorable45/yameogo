// Génère les icônes de l'application (PWA) à partir du logotype « TH ».
// Usage : node scripts/generate-icons.mjs   (depuis frontend/, sharp est fourni par le backend)
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(new URL('../../backend/package.json', import.meta.url));
const sharp = require('sharp');
const out = (name) => fileURLToPath(new URL(`../public/${name}`, import.meta.url));

// Logotype empilé « TH / STORE » sur bleu sombre. `scale` : taille du « TH » (réduite pour les icônes
// « maskable », découpées en cercle par Android : tout doit tenir dans le cercle central).
const svg = (size, { scale = 0.4 } = {}) => {
  const th = size * scale;
  const store = th * 0.24;
  const top = size / 2 - (th * 0.72 + store * 1.9) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#0f2147"/>
  <text x="50%" y="${top + th * 0.72}" text-anchor="middle" font-family="Newsreader, Georgia, 'DejaVu Serif', serif" font-size="${th}" font-weight="600" letter-spacing="${-th * 0.02}" fill="#f5f3ee">TH</text>
  <text x="50%" y="${top + th * 0.72 + store * 1.9}" text-anchor="middle" font-family="'IBM Plex Sans', 'DejaVu Sans', Arial, sans-serif" font-size="${store}" font-weight="600" letter-spacing="${store * 0.42}" fill="#f5f3ee" fill-opacity="0.85">STORE</text>
</svg>`;
};

const icons = [
  ['icon-192.png', 192, {}],
  ['icon-512.png', 512, {}],
  ['icon-maskable-512.png', 512, { scale: 0.3 }],
  ['apple-touch-icon.png', 180, {}],
];
for (const [name, size, opts] of icons) {
  await sharp(Buffer.from(svg(size, opts))).png().toFile(out(name));
  console.log('✔', name);
}
