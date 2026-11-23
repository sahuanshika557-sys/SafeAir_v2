import type { ReactElement } from 'react';
import type { AqiCategoryKey } from '../../types/index.js';

interface BreathingLungsIllustrationProps {
  categoryKey: AqiCategoryKey;
  accentHex?: string;
  animationsPaused: boolean;
  className?: string;
}

/**
 * Returns a high-contrast accent hex matching the AQI severity tier for the lungs icon.
 *
 * @param categoryKey - Active US AQI severity key.
 * @returns Hex color token matching the AQI tier.
 */
export function getLungsColorForCategory(categoryKey: AqiCategoryKey): string {
  switch (categoryKey) {
    case 'good':
      return '#15803d';
    case 'moderate':
      return '#a16207';
    case 'sensitive':
      return '#c2410c';
    case 'unhealthy':
      return '#b91c1c';
    case 'very_unhealthy':
      return '#7e22ce';
    case 'hazardous':
      return '#881337';
  }
}

/**
 * Gentle "breathing" lungs spot graphic rendered alongside Health Protection guidance.
 * Its stroke/tint reflects the active AQI category and animation uses transform/opacity only.
 */
export function BreathingLungsIllustration({
  categoryKey,
  accentHex,
  animationsPaused,
  className = 'w-8 h-8',
}: Readonly<BreathingLungsIllustrationProps>): ReactElement {
  const color = accentHex ?? getLungsColorForCategory(categoryKey);

  return (
    <svg
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
      data-lungs-category={categoryKey}
      data-lungs-color={color}
      className={`${className} ${animationsPaused ? '' : 'safeair-lungs-breathe'}`}
    >
      <path
        d="M24 8v12M24 20l-6 5M24 20l6 5"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M20 18c-5 0-12 4-12 15 0 4.5 2.8 7 6.5 7 3.5 0 5.5-2.5 5.5-7V18Z"
        fill={color}
        fillOpacity="0.18"
        stroke={color}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M28 18c5 0 12 4 12 15 0 4.5-2.8 7-6.5 7-3.5 0-5.5-2.5-5.5-7V18Z"
        fill={color}
        fillOpacity="0.18"
        stroke={color}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
