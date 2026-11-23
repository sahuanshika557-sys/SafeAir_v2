import type { ReactElement, ReactNode } from 'react';
import type { AqiCategoryKey } from '../types/index.js';

interface IconProps {
  className?: string;
}

function SvgIcon({
  className = 'w-4 h-4',
  children,
}: Readonly<{
  className?: string;
  children: ReactNode;
}>): ReactElement {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/**
 * Search magnifier icon.
 *
 * @param props - Optional icon sizing class name.
 * @returns Decorative SVG magnifier element.
 */
export function SearchIcon({ className = 'w-4 h-4' }: Readonly<IconProps>): ReactElement {
  return (
    <SvgIcon className={className}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </SvgIcon>
  );
}

/**
 * Location crosshair icon.
 *
 * @param props - Optional icon sizing class name.
 * @returns Decorative SVG crosshair element.
 */
export function LocateIcon({ className = 'w-4 h-4' }: Readonly<IconProps>): ReactElement {
  return (
    <SvgIcon className={className}>
      <line x1="2" x2="5" y1="12" y2="12" />
      <line x1="19" x2="22" y1="12" y2="12" />
      <line x1="12" x2="12" y1="2" y2="5" />
      <line x1="12" x2="12" y1="19" y2="22" />
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="2" />
    </SvgIcon>
  );
}

/**
 * Refresh icon.
 *
 * @param props - Optional icon sizing class name.
 * @returns Decorative SVG refresh arrows element.
 */
export function RefreshIcon({ className = 'w-4 h-4' }: Readonly<IconProps>): ReactElement {
  return (
    <SvgIcon className={className}>
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </SvgIcon>
  );
}

/**
 * Sun icon for light mode toggle.
 *
 * @param props - Optional icon sizing class name.
 * @returns Decorative SVG sun element.
 */
export function SunIcon({ className = 'w-4 h-4' }: Readonly<IconProps>): ReactElement {
  return (
    <SvgIcon className={className}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </SvgIcon>
  );
}

/**
 * Moon icon for dark mode toggle.
 *
 * @param props - Optional icon sizing class name.
 * @returns Decorative SVG moon element.
 */
export function MoonIcon({ className = 'w-4 h-4' }: Readonly<IconProps>): ReactElement {
  return (
    <SvgIcon className={className}>
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </SvgIcon>
  );
}

/**
 * Speaker icon for Read Aloud action.
 *
 * @param props - Optional icon sizing class name.
 * @returns Decorative SVG speaker element.
 */
export function VolumeIcon({ className = 'w-4 h-4' }: Readonly<IconProps>): ReactElement {
  return (
    <SvgIcon className={className}>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </SvgIcon>
  );
}

/**
 * Stop square icon for halting speech playback.
 *
 * @param props - Optional icon sizing class name.
 * @returns Decorative SVG stop icon element.
 */
export function StopIcon({ className = 'w-4 h-4' }: Readonly<IconProps>): ReactElement {
  return (
    <SvgIcon className={className}>
      <rect x="6" y="6" width="12" height="12" rx="1" />
    </SvgIcon>
  );
}

/**
 * Shield check icon for health and safety notices.
 *
 * @param props - Optional icon sizing class name.
 * @returns Decorative SVG shield element.
 */
export function ShieldIcon({ className = 'w-4 h-4' }: Readonly<IconProps>): ReactElement {
  return (
    <SvgIcon className={className}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </SvgIcon>
  );
}

/**
 * Distinct category status icon paired with AQI severity so color is never the sole indicator.
 *
 * @param props - AQI category key and optional CSS sizing class name.
 * @returns Decorative SVG icon matching the AQI severity tier.
 */
export function AqiStatusIcon({
  categoryKey,
  className = 'w-5 h-5',
}: Readonly<{
  categoryKey: AqiCategoryKey;
  className?: string;
}>): ReactElement {
  if (categoryKey === 'good') {
    return (
      <SvgIcon className={className}>
        <circle cx="12" cy="12" r="10" />
        <path d="m9 12 2 2 4-4" />
      </SvgIcon>
    );
  }
  if (categoryKey === 'moderate') {
    return (
      <SvgIcon className={className}>
        <circle cx="12" cy="12" r="10" />
        <line x1="8" x2="16" y1="12" y2="12" />
      </SvgIcon>
    );
  }
  if (categoryKey === 'sensitive' || categoryKey === 'unhealthy') {
    return (
      <SvgIcon className={className}>
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </SvgIcon>
    );
  }
  return (
    <SvgIcon className={className}>
      <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2" />
      <line x1="12" x2="12" y1="8" y2="12" />
      <line x1="12" x2="12.01" y1="16" y2="16" />
    </SvgIcon>
  );
}
