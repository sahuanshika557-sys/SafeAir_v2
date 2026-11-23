import type { ReactElement } from 'react';

interface SwapIllustrationProps {
  className?: string;
}

/**
 * Decorative spot illustration for composting leaves instead of open waste burning.
 */
export function SwapCompostIllustration({
  className = 'w-9 h-9 shrink-0',
}: Readonly<SwapIllustrationProps>): ReactElement {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" focusable="false" className={className}>
      <rect width="40" height="40" rx="8" className="fill-emerald-50 dark:fill-emerald-950/60" />
      <path
        d="M12 18h16l-2 13H14l-2-13Z"
        fill="#dcfce7"
        stroke="#15803d"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M20 18c0-5 4-9 9-9 0 5-4 9-9 9Z"
        fill="#bbf7d0"
        stroke="#15803d"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M16 24h8" stroke="#15803d" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
