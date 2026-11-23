import type { ReactElement } from 'react';

interface StateIllustrationProps {
  className?: string;
}

/**
 * Warm empty-state illustration displayed before an action plan is generated.
 */
export function EmptyPlanIllustration({
  className = 'w-16 h-16 mx-auto',
}: Readonly<StateIllustrationProps>): ReactElement {
  return (
    <svg viewBox="0 0 72 72" aria-hidden="true" focusable="false" className={className}>
      <circle cx="36" cy="36" r="32" className="fill-teal-50 dark:fill-teal-950/60" />
      <rect
        x="21"
        y="17"
        width="30"
        height="38"
        rx="4"
        className="fill-white dark:fill-slate-900"
        stroke="#0f766e"
        strokeWidth="2.5"
      />
      <rect x="29" y="13" width="14" height="7" rx="2" fill="#0f766e" />
      <path
        d="M27 30h18M27 38h14M27 46h10"
        stroke="#0f766e"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
