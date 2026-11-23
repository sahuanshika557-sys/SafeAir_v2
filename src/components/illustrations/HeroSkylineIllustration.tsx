import type { ReactElement } from 'react';
import type { TranslationDictionary } from '../../i18n/translations.js';
import type { AqiCategoryKey } from '../../types/index.js';
import { getHeroAtmosphereTheme } from './heroSkylineTheme.js';

export {
  getHeroAtmosphereTheme,
  type HeroAtmosphereTheme,
  type HeroAtmosphereTier,
} from './heroSkylineTheme.js';

interface HeroSkylineIllustrationProps {
  categoryKey: AqiCategoryKey;
  locationName: string;
  categoryLabel: string;
  t: TranslationDictionary;
  animationsPaused: boolean;
  className?: string;
}

function SkylineCityscapeLayers(): ReactElement {
  return (
    <>
      <g className="fill-slate-400/55 dark:fill-slate-700/80">
        <rect x="26" y="70" width="38" height="72" rx="2" />
        <rect x="74" y="54" width="46" height="88" rx="2" />
        <rect x="208" y="64" width="42" height="78" rx="2" />
        <rect x="330" y="48" width="52" height="94" rx="2" />
        <rect x="466" y="62" width="48" height="80" rx="2" />
      </g>
      <g className="fill-slate-600 dark:fill-slate-800">
        <rect x="128" y="52" width="56" height="90" rx="2" />
        <rect x="262" y="44" width="60" height="98" rx="2" />
        <rect x="394" y="58" width="58" height="84" rx="2" />
        <rect x="526" y="72" width="48" height="70" rx="2" />
      </g>
      <g className="fill-slate-200 dark:fill-amber-200/75">
        <rect x="138" y="64" width="10" height="8" rx="1" />
        <rect x="162" y="64" width="10" height="8" rx="1" />
        <rect x="138" y="80" width="10" height="8" rx="1" />
        <rect x="162" y="80" width="10" height="8" rx="1" />
        <rect x="274" y="56" width="10" height="8" rx="1" />
        <rect x="298" y="56" width="10" height="8" rx="1" />
        <rect x="274" y="74" width="10" height="8" rx="1" />
        <rect x="298" y="74" width="10" height="8" rx="1" />
        <rect x="406" y="70" width="10" height="8" rx="1" />
        <rect x="428" y="70" width="10" height="8" rx="1" />
        <rect x="536" y="84" width="10" height="8" rx="1" />
        <rect x="554" y="84" width="10" height="8" rx="1" />
      </g>
      <rect x="0" y="114" width="640" height="6" className="fill-slate-700 dark:fill-slate-600" />
      <rect x="96" y="120" width="8" height="22" className="fill-slate-700 dark:fill-slate-600" />
      <rect x="242" y="120" width="8" height="22" className="fill-slate-700 dark:fill-slate-600" />
      <rect x="388" y="120" width="8" height="22" className="fill-slate-700 dark:fill-slate-600" />
      <rect x="534" y="120" width="8" height="22" className="fill-slate-700 dark:fill-slate-600" />
      <g>
        <rect x="164" y="100" width="128" height="14" rx="5" fill="#0f766e" />
        <rect x="174" y="103" width="18" height="6" rx="1" fill="#ccfbf1" />
        <rect x="198" y="103" width="18" height="6" rx="1" fill="#ccfbf1" />
        <rect x="222" y="103" width="18" height="6" rx="1" fill="#ccfbf1" />
        <rect x="246" y="103" width="18" height="6" rx="1" fill="#ccfbf1" />
        <rect x="270" y="103" width="14" height="6" rx="1" fill="#ccfbf1" />
      </g>
      <rect x="0" y="142" width="640" height="22" className="fill-teal-900/20 dark:fill-slate-900" />
      <g>
        <rect x="44" y="128" width="4" height="14" fill="#78350f" />
        <circle cx="46" cy="122" r="11" fill="#15803d" />
        <rect x="192" y="128" width="4" height="14" fill="#78350f" />
        <circle cx="194" cy="123" r="10" fill="#166534" />
        <rect x="318" y="128" width="4" height="14" fill="#78350f" />
        <circle cx="320" cy="121" r="12" fill="#15803d" />
        <rect x="454" y="128" width="4" height="14" fill="#78350f" />
        <circle cx="456" cy="123" r="10" fill="#166534" />
        <rect x="592" y="128" width="4" height="14" fill="#78350f" />
        <circle cx="594" cy="121" r="12" fill="#15803d" />
      </g>
    </>
  );
}

/**
 * Above-the-fold AQI-reactive inline SVG skyline showing apartments, an elevated metro train,
 * trees, sun/moon, and compositor-only drifting haze layers. Renders statically on first paint.
 */
export function HeroSkylineIllustration({
  categoryKey,
  locationName,
  categoryLabel,
  t,
  animationsPaused,
  className = '',
}: Readonly<HeroSkylineIllustrationProps>): ReactElement {
  const theme = getHeroAtmosphereTheme(categoryKey);
  const ariaLabel =
    theme.tier === 'clear'
      ? t.heroIllustrationClearLabel(locationName, categoryLabel)
      : theme.tier === 'hazy'
        ? t.heroIllustrationHazyLabel(locationName, categoryLabel)
        : t.heroIllustrationDenseLabel(locationName, categoryLabel);
  const driftClass = animationsPaused ? '' : 'safeair-haze-layer';
  const driftSlowClass = animationsPaused ? '' : 'safeair-haze-layer-slow';

  return (
    <div className={`overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 ${className}`} data-atmosphere-tier={theme.tier}>
      <svg viewBox="0 0 640 164" role="img" aria-label={ariaLabel} className="block w-full h-auto">
        <defs>
          <linearGradient id="safeair-sky-light" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={theme.skyTopLight} />
            <stop offset="100%" stopColor={theme.skyBottomLight} />
          </linearGradient>
          <linearGradient id="safeair-sky-dark" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={theme.skyTopDark} />
            <stop offset="100%" stopColor={theme.skyBottomDark} />
          </linearGradient>
        </defs>
        <rect width="640" height="164" fill="url(#safeair-sky-light)" className="dark:hidden" />
        <rect width="640" height="164" fill="url(#safeair-sky-dark)" className="hidden dark:block" />
        <circle cx="548" cy="40" r="18" fill={theme.tier === 'clear' ? '#f59e0b' : '#ea580c'} opacity={theme.tier === 'dense' ? 0.55 : 0.9} className="dark:hidden" />
        <path d="M555 24a16 16 0 1 0 15 22 12 12 0 0 1-15-22z" fill="#fef3c7" opacity={theme.tier === 'dense' ? 0.6 : 0.92} className="hidden dark:block" />
        <SkylineCityscapeLayers />
        <g className={driftClass} opacity={theme.hazeOpacityPrimary}>
          <rect x="10" y="34" width="210" height="18" rx="9" fill={theme.hazeFill} />
          <rect x="280" y="48" width="240" height="16" rx="8" fill={theme.hazeFill} />
        </g>
        <g className={driftSlowClass} opacity={theme.hazeOpacitySecondary}>
          <rect x="120" y="76" width="230" height="16" rx="8" fill={theme.hazeFill} />
          <rect x="410" y="84" width="190" height="18" rx="9" fill={theme.hazeFill} />
        </g>
      </svg>
    </div>
  );
}
