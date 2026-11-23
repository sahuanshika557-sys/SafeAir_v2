import type { ReactElement } from 'react';

interface SpotIllustrationProps {
  className?: string;
}

/**
 * Decorative spot illustration for the Health Protection plan section.
 */
export function HealthProtectionIllustration({
  className = 'w-12 h-12',
}: Readonly<SpotIllustrationProps>): ReactElement {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" className={className}>
      <circle cx="32" cy="32" r="28" className="fill-rose-50 dark:fill-rose-950/50" />
      <path
        d="M32 13 48 19v13c0 10-7 17-16 20-9-3-16-10-16-20V19l16-6Z"
        fill="#fecdd3"
        stroke="#be123c"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M25 32h14M32 25v14" stroke="#9f1239" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
