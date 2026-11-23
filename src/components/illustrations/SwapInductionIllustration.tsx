import type { ReactElement } from 'react';

interface SwapIllustrationProps {
  className?: string;
}

/**
 * Decorative spot illustration for clean induction/electric or LPG cooking.
 */
export function SwapInductionIllustration({
  className = 'w-9 h-9 shrink-0',
}: Readonly<SwapIllustrationProps>): ReactElement {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" focusable="false" className={className}>
      <rect width="40" height="40" rx="8" className="fill-amber-50 dark:fill-amber-950/60" />
      <rect
        x="8"
        y="22"
        width="24"
        height="8"
        rx="2"
        fill="#fef3c7"
        stroke="#b45309"
        strokeWidth="2"
      />
      <path
        d="M13 22h14v-6a2 2 0 0 0-2-2H15a2 2 0 0 0-2 2v6Z"
        fill="#fde68a"
        stroke="#b45309"
        strokeWidth="2"
      />
      <path
        d="M17 11c0-1.5 1-2.5 1-3M23 11c0-1.5 1-2.5 1-3"
        stroke="#0f766e"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
