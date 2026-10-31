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
  ['L', 91],
  ['e', 190],
  ['M', 369],
  ['a', 500],
  ['r', 595],
  ['c', 678],
  ['h', 779],
  ['a', 891],
  ['n', 1002],
  ['d', 1113],
];

const FRONT_TOP = 'M258 226L820 262L860 548L750 345L585 648L335 348L258 648Z';
const FRONT_BOTTOM = 'M254 982L385 560L605 825L752 540L912 885Z';

/**
 * Logo animé « Le Marchand » (SVG + CSS pur).
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
  const uid = `lm-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
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

  const ink = 'var(--lm-ink)';
  const font: CSSProperties = { fontFamily: lexend.style.fontFamily };

  return (
    <div
      ref={root}
      className={[s['lm-root'], playing ? '' : s['lm-idle'], className].filter(Boolean).join(' ')}
      onPointerEnter={(e) => e.pointerType === 'mouse' && replay()}
      onClick={replay}
    >
      {/* Sans JavaScript, l'animation se joue directement. */}
      <noscript>
        <style>{`.${s['lm-idle']} *{animation-play-state:running!important}`}</style>
      </noscript>
      <svg key={run} className={s['lm-svg']} viewBox="0 0 1210 864" role="img" aria-label="Logo Le Marchand, votre repère du numérique">
        <defs>
          <linearGradient id={id('sh')} x1="0" x2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset=".5" stopColor="#fff" stopOpacity=".7" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <clipPath id={id('bag-clip')}>
            <path d={FRONT_TOP} />
            <path d={FRONT_BOTTOM} />
          </clipPath>
        </defs>

        <g className={s['lm-all']}>
          <g transform="translate(360 30) scale(0.5)">
            {/* Le sac se dessine : contour, flanc, anses */}
            <path className={`${s['lm-draw']} ${s['lm-ghost']}`} d="M258 226L820 262L912 885L254 982Z" pathLength={1} strokeWidth="8" />
            <path className={s['lm-draw']} d="M120 248L225 228L222 972L66 918Z" pathLength={1} strokeWidth="8" />
            <path className={`${s['lm-pop']} ${s['lm-side']}`} d="M120 248L225 228L222 972L66 918Z" fill="#db851b" />
            <path className={`${s['lm-draw']} ${s['lm-handle-back']}`} d="M348 232C362 120 425 76 482 78C560 84 612 150 626 250" pathLength={1} strokeWidth="30" />
            <path className={`${s['lm-draw']} ${s['lm-handle']}`} d="M416 236C430 130 490 90 532 92C612 96 664 170 678 254" pathLength={1} strokeWidth="30" />

            {/* Les deux pièces du sac arrivent et font apparaître le M */}
            <path className={s['lm-piece-top']} d={FRONT_TOP} fill="#f59a1e" />
            <path className={s['lm-piece-bot']} d={FRONT_BOTTOM} fill="#f59a1e" />
            <g clipPath={`url(#${id('bag-clip')})`}>
              <rect className={s['lm-shine']} x="-100" y="100" width="240" height="1000" fill={`url(#${id('sh')})`} transform="skewX(-20)" />
            </g>
          </g>

          {/* Le Marchand */}
          <g style={font} fontWeight="800" fontSize="176" fill={ink} textAnchor="middle" stroke="#fff" strokeWidth="10" paintOrder="stroke" strokeLinejoin="round">
            {LETTERS.map(([letter, x], i) => (
              <text key={i} className={s['lm-letter']} style={{ '--lm-i': i } as CSSProperties} x={x} y="690">
                {letter}
              </text>
            ))}
          </g>

          {/* Votre repère du numérique. */}
          <text className={s['lm-baseline']} x="605" y="775" textAnchor="middle" fontFamily="var(--font-sans)" fontWeight="500" fontSize="50" fill={ink}>
            VOTRE REPÈRE DU NUMÉRIQUE.
          </text>
        </g>
      </svg>
    </div>
  );
}
