import type { PublicSettings } from './types';

/** Destination la plus précise disponible : position GPS, sinon adresse saisie. */
function destination(s: PublicSettings | null) {
  if (s?.location) return `${s.location.latitude},${s.location.longitude}`;
  const address = [s?.addressLine, s?.city, s?.country].filter(Boolean).join(', ');
  return address ? `${s?.shopName ?? 'Yameogo Smart Tech'}, ${address}` : null;
}

/** Itinéraire Google Maps (ouvre l'application Maps sur téléphone). */
export function directionsUrl(s: PublicSettings | null) {
  if (s?.mapUrl) return s.mapUrl;
  const d = destination(s);
  return d ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(d)}` : null;
}

/** Carte intégrable (sans clé d'API). */
export function embedMapUrl(s: PublicSettings | null) {
  const d = destination(s);
  return d ? `https://maps.google.com/maps?q=${encodeURIComponent(d)}&z=17&output=embed` : null;
}
