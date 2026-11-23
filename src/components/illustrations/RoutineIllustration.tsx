import type { ReactElement } from 'react';

interface SpotIllustrationProps {
  className?: string;
}

/**
 * Decorative spot illustration for the Low-Emission Daily Routine plan section.
 */
export function RoutineIllustration({
  className = 'w-12 h-12',
}: Readonly<SpotIllustrationProps>): ReactElement {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" className={className}>
      <circle cx="32" cy="32" r="28" className="fill-teal-50 dark:fill-teal-950/60" />
      <circle cx="32" cy="34" r="16" fill="none" stroke="#0f766e" strokeWidth="3" />
      <path
        d="M32 24v10l6 4M18 18l4 3M46 18l-4 3M32 10v5"
        stroke="#0f766e"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
