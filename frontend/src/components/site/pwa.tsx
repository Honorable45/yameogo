'use client';

import { Download } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';

/** Enregistre le service worker (production uniquement : en développement, il gênerait le rechargement à chaud). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined);
  }, []);
  return null;
}

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

/**
 * « Installer l'application » : visible seulement quand le navigateur le propose (Chrome, Edge, Samsung Internet).
 * Sur iPhone, l'installation passe par Partager › Sur l'écran d'accueil : une indication s'affiche à la place.
 */
export function InstallButton({ className }: { className?: string }) {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone;
    if (standalone) return;
    setIos(/iPhone|iPad|iPod/.test(navigator.userAgent));
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPrompt);
    };
    const onInstalled = () => setPrompt(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (prompt) {
    return (
      <button
        type="button"
        onClick={async () => {
          await prompt.prompt();
          await prompt.userChoice;
          setPrompt(null);
        }}
        className={cn('glass inline-flex h-11 items-center gap-2 rounded-full px-5 text-[14px] font-medium text-white hover:bg-white/25', className)}
      >
        <Download className="size-4" /> Installer l’application
      </button>
    );
  }
  if (ios) return <p className={cn('text-[13px] text-paper/70', className)}>Installer l’application : Partager › Sur l’écran d’accueil.</p>;
  return null;
}
