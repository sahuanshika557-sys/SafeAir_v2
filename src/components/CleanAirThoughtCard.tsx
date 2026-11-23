import { useEffect, useState, type FocusEvent, type ReactElement } from 'react';
import type { TranslationDictionary } from '../i18n/translations.js';

interface CleanAirThoughtCardProps {
  t: TranslationDictionary;
  animationsPaused: boolean;
}

const ROTATION_INTERVAL_MS = 10000;

/**
 * Displays original EN/HI clean-air thoughts rotating every 10s with smooth opacity transition.
 * Intentionally omits `aria-live` so screen readers are never interrupted, pauses on hover,
 * keyboard focus, and explicit Pause/Play button, and stays static on line 1 when animations are paused.
 */
export function CleanAirThoughtCard({
  t,
  animationsPaused,
}: Readonly<CleanAirThoughtCardProps>): ReactElement {
  const thoughts = t.cleanAirThoughts;
  const [index, setIndex] = useState<number>(0);
  const [isUserPaused, setIsUserPaused] = useState<boolean>(false);
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [isFocused, setIsFocused] = useState<boolean>(false);

  const effectivePaused = animationsPaused || isUserPaused || isHovered || isFocused;
  const displayedIndex = animationsPaused || thoughts.length === 0 ? 0 : index % thoughts.length;
  const displayedThought = thoughts[displayedIndex] ?? thoughts[0] ?? '';

  useEffect(() => {
    if (effectivePaused || thoughts.length <= 1) {
      return;
    }
    const timerId = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % thoughts.length);
    }, ROTATION_INTERVAL_MS);
    return (): void => {
      window.clearInterval(timerId);
    };
  }, [effectivePaused, thoughts.length]);

  const handleBlur = (e: FocusEvent<HTMLElement>): void => {
    const related = e.relatedTarget instanceof Node ? e.relatedTarget : null;
    if (!related || !e.currentTarget.contains(related)) {
      setIsFocused(false);
    }
  };

  return (
    <aside
      aria-label={t.thoughtCardTitle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsFocused(true)}
      onBlur={handleBlur}
      className="rounded-lg border border-teal-200 dark:border-teal-800/80 bg-teal-50/70 dark:bg-teal-950/40 px-4 py-3 flex items-center justify-between gap-4"
    >
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold uppercase tracking-wide text-teal-900 dark:text-teal-200">
          {t.thoughtCardTitle}
        </p>
        <p
          key={displayedIndex}
          className="safeair-thought-fade mt-1 text-sm leading-relaxed text-slate-800 dark:text-slate-200"
        >
          “{displayedThought}”
        </p>
      </div>

      {!animationsPaused && (
        <button
          type="button"
          onClick={() => setIsUserPaused((prev) => !prev)}
          aria-pressed={isUserPaused}
          className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg border border-teal-300 dark:border-teal-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-teal-900 dark:text-teal-100 hover:bg-teal-100 dark:hover:bg-teal-900/60 transition-colors"
        >
          {isUserPaused ? t.thoughtPlayBtn : t.thoughtPauseBtn}
        </button>
      )}
    </aside>
  );
}
