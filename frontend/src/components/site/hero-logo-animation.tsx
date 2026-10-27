'use client';

import localFont from 'next/font/local';
import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import s from './hero-logo-animation.module.css';

// Lexend (OFL), hébergée par le site comme les autres polices du projet ; chargée seulement avec ce composant.
const lexend = localFont({
  src: [
    { path: '../../app/fonts/lexend-latin-800-normal.woff2', weight: '800' },
    { path: '../../app/fonts/lexend-latin-900-normal.woff2', weight: '900' },
  ],
  display: 'swap',
  fallback: ['Arial Black', 'sans-serif'],
});

/** Durée totale de l'animation (ms) : un nouveau rejeu n'est possible qu'une fois la précédente terminée. */
const DURATION = 4900;
const LETTERS: [string, number][] = [
  ['Y', 426],
  ['A', 522],
  ['M', 626],
  ['E', 723],
  ['O', 815],
  ['G', 915],
  ['O', 1014],
];

/**
 * Logo animé « Yameogo Smart Home » (SVG + CSS pur).
 * - Démarre quand il devient visible (une fois par chargement), puis reste figé sur le logo final.
 * - Se rejoue au survol (souris) ou au toucher, jamais en boucle automatique.
 * - `prefers-reduced-motion` : logo final affiché directement.
 * - Fond transparent ; la place est réservée dès le premier rendu (aspect-ratio 1210/864).
 */
export function HeroLogoAnimation({ className }: { className?: string }) {
  const root = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [run, setRun] = useState(0);
  const startedAt = useRef(0);
  // Identifiants uniques des <defs> : deux logos sur la même page ne se marchent pas dessus.
  const uid = `ysh-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const id = (name: string) => `${uid}-${name}`;

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const start = () => {
      startedAt.current = Date.now();
      setPlaying(true);
    };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return start();
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          start();
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const replay = () => {
    if (!playing || Date.now() - startedAt.current < DURATION) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    startedAt.current = Date.now();
    // Nouvelle clé : le SVG est recréé, ses animations repartent de zéro.
    setRun((r) => r + 1);
  };

  const navy = 'var(--ysh-navy)';
  const font: CSSProperties = { fontFamily: lexend.style.fontFamily };

  return (
    <div
      ref={root}
      className={[s['ysh-root'], playing ? '' : s['ysh-idle'], className].filter(Boolean).join(' ')}
      onPointerEnter={(e) => e.pointerType === 'mouse' && replay()}
      onClick={replay}
    >
      {/* Sans JavaScript, l'animation se joue directement. */}
      <noscript>
        <style>{`.${s['ysh-idle']} *{animation-play-state:running!important}`}</style>
      </noscript>
      <svg key={run} className={s['ysh-svg']} viewBox="0 0 1210 864" role="img" aria-label="Logo Yameogo Smart Home">
        <defs>
          <linearGradient id={id('og')} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f9a51a" />
            <stop offset=".55" stopColor="#f58a1c" />
            <stop offset="1" stopColor="#ee5d1b" />
          </linearGradient>
          <linearGradient id={id('pg')} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#ef641b" />
            <stop offset=".5" stopColor="#f9a51a" />
            <stop offset="1" stopColor="#ef641b" />
          </linearGradient>
          <linearGradient id={id('sh')} x1="0" x2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset=".5" stopColor="#fff" stopOpacity=".7" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <clipPath id={id('pill-clip')}>
            <rect x="502" y="525" width="455" height="110" rx="22" />
          </clipPath>
          <mask id={id('phone-mask')} maskUnits="userSpaceOnUse" x="0" y="0" width="1210" height="864">
            <rect width="1210" height="864" fill="#fff" />
            <rect x="372" y="388" width="300" height="400" fill="#000" />
          </mask>
        </defs>

        <g className={s['ysh-all']}>
          {/* Téléphone */}
          <g mask={`url(#${id('phone-mask')})`}>
            <rect className={s['ysh-draw']} x="250" y="108" width="325" height="560" rx="56" pathLength={1} strokeWidth="5" />
            <rect className={`${s['ysh-draw']} ${s['ysh-inner']}`} x="259" y="117" width="307" height="542" rx="48" pathLength={1} strokeWidth="3" />
            <rect className={`${s['ysh-pop']} ${s['ysh-notch']}`} x="366" y="134" width="92" height="24" rx="12" fill={navy} />
            <rect className={`${s['ysh-pop']} ${s['ysh-btn']}`} x="245" y="232" width="6" height="26" rx="3" fill={navy} />
            <rect className={`${s['ysh-pop']} ${s['ysh-btn']}`} x="245" y="282" width="6" height="40" rx="3" fill={navy} />
            <rect className={`${s['ysh-pop']} ${s['ysh-btn']}`} x="245" y="340" width="6" height="40" rx="3" fill={navy} />
            <rect className={`${s['ysh-pop']} ${s['ysh-btn']}`} x="574" y="300" width="6" height="44" rx="3" fill={navy} />
          </g>

          {/* Arcs orange */}
          <path className={s['ysh-arc-top']} fill={`url(#${id('og')})`} d="M579 202 C640 176 725 172 724 228 C722 285 660 335 610 362 C648 318 686 276 688 240 C690 214 640 205 579 220 Z" />
          <path className={s['ysh-arc-bot']} fill={`url(#${id('og')})`} d="M246 492 C188 556 160 640 196 686 C245 742 378 676 448 572 C372 638 278 688 244 660 C214 636 222 560 246 492 Z" />

          {/* YAMEOGO */}
          <g style={font} fontWeight="900" fontSize="128" fill={navy} textAnchor="middle" stroke="#fff" strokeWidth="14" paintOrder="stroke" strokeLinejoin="round">
            {LETTERS.map(([letter, x], i) => (
              <text key={i} className={s['ysh-letter']} style={{ '--ysh-i': i } as CSSProperties} x={x} y="495">
                {letter}
              </text>
            ))}
          </g>

          {/* SMART */}
          <rect className={s['ysh-pill']} x="502" y="525" width="455" height="110" rx="22" fill={`url(#${id('pg')})`} />
          <text className={s['ysh-smart']} style={font} x="730" y="613" textAnchor="middle" fontWeight="800" fontSize="92" fill="#fff">
            SMART
          </text>
          <g clipPath={`url(#${id('pill-clip')})`}>
            <rect className={s['ysh-shine']} x="400" y="500" width="120" height="160" fill={`url(#${id('sh')})`} transform="skewX(-20)" />
          </g>

          {/* HOME */}
          <text className={s['ysh-home']} style={font} x="742" y="728" textAnchor="middle" fontWeight="800" fontSize="82" letterSpacing="2" fill={navy}>
            TECH
          </text>
        </g>
      </svg>
    </div>
  );
}
