import { useEffect, useState, type ReactElement } from 'react';
import { MAX_US_AQI, MIN_US_AQI } from '../../constants/index.js';

const GAUGE_ANIMATION_DURATION_MS = 650;
const GAUGE_EASING_POWER = 3;
const GAUGE_RADIUS = 52;

interface AqiGaugeProps {
  aqi: number;
  accentHex: string;
  ariaLabel: string;
  animationsPaused: boolean;
}

/**
 * Accessible SVG semi-circular AQI gauge animating smoothly from 0 to current value
 * on load and value changes (unless animations are paused or reduced motion is active).
 */
export function AqiGauge({
  aqi,
  accentHex,
  ariaLabel,
  animationsPaused,
}: Readonly<AqiGaugeProps>): ReactElement {
  const clampedTarget = Math.max(MIN_US_AQI, Math.min(MAX_US_AQI, Math.round(aqi)));
  const canAnimate =
    !animationsPaused &&
    typeof window !== 'undefined' &&
    typeof window.requestAnimationFrame === 'function';

  const [animatedState, setAnimatedState] = useState<{ target: number; value: number }>(() => ({
    target: clampedTarget,
    value: canAnimate ? 0 : clampedTarget,
  }));

  useEffect(() => {
    if (!canAnimate) {
      return;
    }

    const startTime = performance.now();
    let frameId = 0;

    const tick = (now: number): void => {
      const elapsed = Math.max(0, now - startTime);
      const progress = Math.min(1, elapsed / GAUGE_ANIMATION_DURATION_MS);
      const eased = 1 - Math.pow(1 - progress, GAUGE_EASING_POWER);
      setAnimatedState({
        target: clampedTarget,
        value: Math.round(clampedTarget * eased),
      });
      if (progress < 1) {
        frameId = window.requestAnimationFrame(tick);
      }
    };

    frameId = window.requestAnimationFrame(tick);
    return (): void => {
      window.cancelAnimationFrame(frameId);
    };
  }, [clampedTarget, canAnimate]);

  const displayAqi = !canAnimate
    ? clampedTarget
    : animatedState.target === clampedTarget
      ? animatedState.value
      : 0;

  const fraction = displayAqi / MAX_US_AQI;
  const circumference = Math.PI * GAUGE_RADIUS;
  const dashOffset = circumference * (1 - fraction);

  return (
    <div className="flex flex-col items-center">
      <svg
        width="140"
        height="84"
        viewBox="0 0 140 84"
        role="img"
        aria-label={ariaLabel}
        data-target-aqi={clampedTarget}
        data-displayed-aqi={displayAqi}
        className="overflow-visible"
      >
        <path
          d="M 18 72 A 52 52 0 0 1 122 72"
          fill="none"
          stroke="currentColor"
          strokeWidth="12"
          strokeLinecap="round"
          className="text-slate-200 dark:text-slate-800"
        />
        <path
          d="M 18 72 A 52 52 0 0 1 122 72"
          fill="none"
          stroke={accentHex}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
        <text
          x="70"
          y="64"
          textAnchor="middle"
          className="fill-slate-900 dark:fill-slate-100 text-3xl font-bold tabular-nums"
        >
          {displayAqi}
        </text>
      </svg>
    </div>
  );
}
