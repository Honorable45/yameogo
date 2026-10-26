import 'server-only';

const API_URL = (process.env.API_URL ?? 'http://localhost:4100').replace(/\/$/, '');

/**
 * Lecture de l'API depuis le serveur Next.js (pages publiques).
 * Renvoie `null` si l'API est indisponible : la page affiche alors un état vide plutôt qu'une erreur.
 */
export async function serverGet<T>(path: string, revalidate = 30): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}${path}`, { next: { revalidate }, headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Variante qui distingue « introuvable » (404) d'une panne. */
export async function serverGetOrNotFound<T>(path: string, revalidate = 30): Promise<T | 'not-found' | null> {
  try {
    const res = await fetch(`${API_URL}${path}`, { next: { revalidate }, headers: { Accept: 'application/json' } });
    if (res.status === 404) return 'not-found';
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
