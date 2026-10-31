/** Sac orange du logo Le Marchand ; le M est découpé dans le sac et laisse voir le fond. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="50 60 880 935" className={className} aria-hidden="true">
      <path d="M348 232C362 120 425 76 482 78C560 84 612 150 626 250" fill="none" stroke="#de8e22" strokeWidth="30" />
      <path d="M416 236C430 130 490 90 532 92C612 96 664 170 678 254" fill="none" stroke="#f59a1e" strokeWidth="30" />
      <path d="M120 248L225 228L222 972L66 918Z" fill="#db851b" />
      <path d="M258 226L820 262L860 548L750 345L585 648L335 348L258 648Z" fill="#f59a1e" />
      <path d="M254 982L385 560L605 825L752 540L912 885Z" fill="#f59a1e" />
    </svg>
  );
}
