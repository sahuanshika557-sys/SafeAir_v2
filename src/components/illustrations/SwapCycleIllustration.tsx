import type { ReactElement } from 'react';

interface SwapIllustrationProps {
  className?: string;
}

/**
 * Decorative spot illustration for walking or cycling short trips during low-AQI hours.
 */
export function SwapCycleIllustration({
  className = 'w-9 h-9 shrink-0',
}: Readonly<SwapIllustrationProps>): ReactElement {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" focusable="false" className={className}>
      <rect width="40" height="40" rx="8" className="fill-emerald-50 dark:fill-emerald-950/60" />
      <circle cx="13" cy="26" r="5" fill="none" stroke="#0f766e" strokeWidth="2" />
      <circle cx="27" cy="26" r="5" fill="none" stroke="#0f766e" strokeWidth="2" />
      <path
        d="M13 26l5-10h5l4 10M18 16l-2-3M23 16l2-3h3"
        fill="none"
        stroke="#0f766e"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
