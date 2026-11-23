import type { ReactElement } from 'react';

interface SwapIllustrationProps {
  className?: string;
}

/**
 * Decorative spot illustration for wearing a well-fitted N95/FFP2 respirator outdoors.
 */
export function SwapMaskIllustration({
  className = 'w-9 h-9 shrink-0',
}: Readonly<SwapIllustrationProps>): ReactElement {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" focusable="false" className={className}>
      <rect width="40" height="40" rx="8" className="fill-sky-50 dark:fill-sky-950/60" />
      <path
        d="M11 19c0-4 4-7 9-7s9 3 9 7c0 6-4 10-9 10s-9-4-9-10Z"
        fill="#e0f2fe"
        stroke="#0369a1"
        strokeWidth="2"
      />
      <path
        d="M7 17c2-1 4 0 4 2M33 17c-2-1-4 0-4 2M15 20h10"
        stroke="#0369a1"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
