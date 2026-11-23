import type { ReactElement } from 'react';

interface SwapIllustrationProps {
  className?: string;
}

/**
 * Decorative spot illustration for sealing window gaps and running HEPA/DIY filtration.
 */
export function SwapSealingIllustration({
  className = 'w-9 h-9 shrink-0',
}: Readonly<SwapIllustrationProps>): ReactElement {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" focusable="false" className={className}>
      <rect width="40" height="40" rx="8" className="fill-indigo-50 dark:fill-indigo-950/60" />
      <rect
        x="10"
        y="9"
        width="20"
        height="22"
        rx="2"
        fill="#e0e7ff"
        stroke="#4338ca"
        strokeWidth="2"
      />
      <path d="M20 9v22M10 20h20" stroke="#4338ca" strokeWidth="2" />
      <path d="M8 31h24" stroke="#0f766e" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
