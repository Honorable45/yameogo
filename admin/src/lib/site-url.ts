'use client';

import { useEffect, useState } from 'react';
import { api } from './api';

/** Valeur de repli tant que l'API n'a pas répondu : vide en production (jamais de lien localhost). */
const FALLBACK = (process.env.NEXT_PUBLIC_SITE_URL ?? (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3100')).replace(/\/$/, '');
let cached: Promise<string> | null = null;

/**
 * Adresse du site public (liens « Voir sur le site », QR codes).
 * Source unique : WEB_ORIGIN de l'API, lue une seule fois — aucune variable à configurer côté administration.
 */
export function useSiteUrl() {
  const [url, setUrl] = useState(FALLBACK);
  useEffect(() => {
    cached ??= api
      .get<{ siteUrl?: string }>('/settings/public')
      .then((s) => (s.siteUrl ?? FALLBACK).replace(/\/$/, ''))
      .catch(() => {
        cached = null;
        return FALLBACK;
      });
    let alive = true;
    void cached.then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, []);
  return url;
}
