import type { ReactElement } from 'react';

interface StateIllustrationProps {
  className?: string;
}

/**
 * Friendly error-state illustration replacing bare red boxes while maintaining clear alert contrast.
 */
export function ErrorStateIllustration({
  className = 'w-12 h-12 shrink-0',
}: Readonly<StateIllustrationProps>): ReactElement {
  return (
    <svg viewBox="0 0 56 56" aria-hidden="true" focusable="false" className={className}>
      <circle cx="28" cy="28" r="25" className="fill-red-100 dark:fill-red-900/60" />
      <path
        d="M17 36h22a6 6 0 0 0 1-11.9 9 9 0 0 0-17.4-2.2A7 7 0 0 0 17 36Z"
        className="fill-white dark:fill-slate-900"
        stroke="#b91c1c"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path d="M28 24v6" stroke="#b91c1c" strokeWidth="2.8" strokeLinecap="round" />
      <circle cx="28" cy="34.5" r="1.5" fill="#b91c1c" />
    </svg>
  );
}
