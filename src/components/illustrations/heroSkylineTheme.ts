import type { AqiCategoryKey } from '../../types/index.js';

/** Visual sky and haze tier derived from an AQI severity category. */
export type HeroAtmosphereTier = 'clear' | 'hazy' | 'dense';

/** Palette and haze configuration mapped to an AQI category. */
export interface HeroAtmosphereTheme {
  tier: HeroAtmosphereTier;
  skyTopLight: string;
  skyBottomLight: string;
  skyTopDark: string;
  skyBottomDark: string;
  hazeFill: string;
  hazeOpacityPrimary: number;
  hazeOpacitySecondary: number;
}

/**
 * Maps an AQI category key to a visual skyline atmosphere tier and accessible palette.
 *
 * @param categoryKey - Standard US AQI category key.
 * @returns Visual sky/haze theme without modifying underlying AQI thresholds.
 */
export function getHeroAtmosphereTheme(categoryKey: AqiCategoryKey): HeroAtmosphereTheme {
  if (categoryKey === 'good' || categoryKey === 'moderate') {
    return {
      tier: 'clear',
      skyTopLight: '#e0f2fe',
      skyBottomLight: '#f0fdfa',
      skyTopDark: '#0f172a',
      skyBottomDark: '#134e4a',
      hazeFill: '#bae6fd',
      hazeOpacityPrimary: 0.24,
      hazeOpacitySecondary: 0.16,
    };
  }
  if (categoryKey === 'sensitive' || categoryKey === 'unhealthy') {
    return {
      tier: 'hazy',
      skyTopLight: '#ffedd5',
      skyBottomLight: '#e2e8f0',
      skyTopDark: '#271a14',
      skyBottomDark: '#334155',
      hazeFill: '#fb923c',
      hazeOpacityPrimary: 0.42,
      hazeOpacitySecondary: 0.34,
    };
  }
  return {
    tier: 'dense',
    skyTopLight: '#d6d3d1',
    skyBottomLight: '#fca5a5',
    skyTopDark: '#1c1917',
    skyBottomDark: '#450a0a',
    hazeFill: '#78716c',
    hazeOpacityPrimary: 0.62,
    hazeOpacitySecondary: 0.5,
  };
}
