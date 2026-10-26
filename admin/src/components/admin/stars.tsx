export function Stars({ value, size = 'sm', label }: { value: number; size?: 'sm' | 'md'; label?: string }) {
  const rounded = Math.round(value * 2) / 2;
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={label ?? `${value.toLocaleString('fr-FR')} sur 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} viewBox="0 0 20 20" className={size === 'sm' ? 'size-3.5' : 'size-5'} aria-hidden="true">
          <defs>
            <linearGradient id={`half-${i}`}>
              <stop offset="50%" stopColor="currentColor" />
              <stop offset="50%" stopColor="transparent" />
            </linearGradient>
          </defs>
          <path
            d="M10 1.8l2.47 5.3 5.8.67-4.3 3.95 1.17 5.73L10 14.6l-5.14 2.85 1.17-5.73-4.3-3.95 5.8-.67z"
            className="text-ochre"
            fill={rounded >= i ? 'currentColor' : rounded === i - 0.5 ? `url(#half-${i})` : 'none'}
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        </svg>
      ))}
    </span>
  );
}
