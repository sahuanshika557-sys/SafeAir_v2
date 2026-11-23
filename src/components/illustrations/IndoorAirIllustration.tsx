import type { ReactElement } from 'react';

interface SpotIllustrationProps {
  className?: string;
}

/**
 * Decorative spot illustration for the Indoor Air Quality Hacks plan section.
 */
export function IndoorAirIllustration({
  className = 'w-12 h-12',
}: Readonly<SpotIllustrationProps>): ReactElement {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" className={className}>
      <circle cx="32" cy="32" r="28" className="fill-sky-50 dark:fill-sky-950/60" />
      <path
        d="M14 28 32 14l18 14v20H14V28Z"
        fill="none"
        stroke="#0369a1"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <rect
        x="24"
        y="30"
        width="16"
        height="14"
        rx="2"
        fill="#bae6fd"
        stroke="#0369a1"
        strokeWidth="2.5"
      />
      <path
        d="M27 37h10M29 34l3-2 3 2"
        stroke="#0f766e"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
