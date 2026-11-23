import type { ReactElement } from 'react';

interface SpotIllustrationProps {
  className?: string;
}

/**
 * Decorative spot illustration for the Sustainable Alternatives plan section.
 */
export function SustainableIllustration({
  className = 'w-12 h-12',
}: Readonly<SpotIllustrationProps>): ReactElement {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" className={className}>
      <circle cx="32" cy="32" r="28" className="fill-emerald-50 dark:fill-emerald-950/60" />
      <path
        d="M46 18C32 18 20 26 20 40c0 2.5.6 4.6 1.5 6.5C35.5 46.5 46 35 46 18Z"
        fill="#bbf7d0"
        stroke="#15803d"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M18 48c5-7 13-15 24-22" stroke="#15803d" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
