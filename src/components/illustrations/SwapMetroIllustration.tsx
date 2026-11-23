import type { ReactElement } from 'react';

interface SwapIllustrationProps {
  className?: string;
}

/**
 * Decorative spot illustration for choosing Metro/Bus over solo driving.
 */
export function SwapMetroIllustration({
  className = 'w-9 h-9 shrink-0',
}: Readonly<SwapIllustrationProps>): ReactElement {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" focusable="false" className={className}>
      <rect width="40" height="40" rx="8" className="fill-teal-50 dark:fill-teal-950/60" />
      <rect
        x="10"
        y="9"
        width="20"
        height="18"
        rx="4"
        fill="#ccfbf1"
        stroke="#0f766e"
        strokeWidth="2"
      />
      <rect x="13" y="13" width="14" height="6" rx="1" fill="#0f766e" />
      <circle cx="14.5" cy="23.5" r="1.5" fill="#0f766e" />
      <circle cx="25.5" cy="23.5" r="1.5" fill="#0f766e" />
      <path d="M13 27 10 31M27 27l3 4" stroke="#0f766e" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
