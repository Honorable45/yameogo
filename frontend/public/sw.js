/*
 * Service worker de YAMEOGO (application installable).
 * - Pages : réseau d'abord (prix et stock toujours à jour) ; sans réseau, dernière version vue, sinon /hors-ligne.html (page autonome, sans script).
 * - Fichiers du site (/_next/static, versionnés) : cache d'abord.
 * - Photos (Cloudinary, Unsplash, API) : cache puis mise à jour en arrière-plan, 80 photos au plus.
 * - /api (sessions, avis, paiements) : jamais mis en cache.
 */
const VERSION = 'ymg-v1';
const PAGES = `pages-${VERSION}`;
const STATIC = `static-${VERSION}`;
const IMAGES = `images-${VERSION}`;
const OFFLINE = '/hors-ligne.html';
const PRECACHE = [OFFLINE, '/icon-192.png', '/icon-512.png'];
const IMAGE_HOSTS = ['res.cloudinary.com', 'images.unsplash.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(PAGES).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => ![PAGES, STATIC, IMAGES].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - max))) await cache.delete(key);
}

async function networkFirst(request) {
  const cache = await caches.open(PAGES);
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
      trim(PAGES, 40);
    }
    return response;
  } catch {
    return (await cache.match(request)) || (await cache.match(OFFLINE));
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) (await caches.open(STATIC)).put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(IMAGES);
  const cached = await cache.match(request);
  const update = fetch(request)
    .then((response) => {
      if (response.ok || response.type === 'opaque') {
        cache.put(request, response.clone());
        trim(IMAGES, 80);
      }
      return response;
    })
    .catch(() => cached);
  return cached || update;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  if (sameOrigin && url.pathname.startsWith('/api/')) return;
  if (request.mode === 'navigate') return event.respondWith(networkFirst(request));
  if (sameOrigin && url.pathname.startsWith('/_next/static/')) return event.respondWith(cacheFirst(request));
  if (request.destination === 'image' && (sameOrigin || IMAGE_HOSTS.includes(url.hostname))) return event.respondWith(staleWhileRevalidate(request));
});
