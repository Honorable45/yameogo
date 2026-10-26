/**
 * Client API côté navigateur. Les appels passent par /api (proxy Next.js → NestJS),
 * ce qui garde le cookie de session sur le domaine du site.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

type Body = Record<string, unknown> | unknown[] | FormData | undefined;

async function request<T>(method: string, path: string, body?: Body): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json', 'X-Requested-With': 'yameogo' };
  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let res: Response;
  try {
    res = await fetch(`/api${path}`, { method, headers, body: payload, credentials: 'same-origin', cache: 'no-store' });
  } catch {
    throw new ApiError('Connexion impossible. Vérifiez votre accès à Internet et réessayez.', 0);
  }

  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    if (res.status === 401 && typeof window !== 'undefined' && window.location.pathname.startsWith('/admin') && !window.location.pathname.startsWith('/admin/connexion')) {
      window.location.href = `/admin/connexion?next=${encodeURIComponent(window.location.pathname)}`;
    }
    const message = typeof data.message === 'string' ? data.message : 'Une erreur est survenue.';
    throw new ApiError(message, res.status, data);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: Body) => request<T>('POST', path, body ?? {}),
  put: <T>(path: string, body?: Body) => request<T>('PUT', path, body ?? {}),
  patch: <T>(path: string, body?: Body) => request<T>('PATCH', path, body ?? {}),
  delete: <T>(path: string) => request<T>('DELETE', path),
};

export function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : 'Une erreur est survenue.';
}

/** Construit une chaîne de requête en ignorant les valeurs vides. */
export function qs(params: Record<string, string | number | boolean | null | undefined>) {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '' && v !== false) search.set(k, String(v));
  }
  const s = search.toString();
  return s ? `?${s}` : '';
}
