import type { ReactElement } from 'react';
import type { TranslationDictionary } from '../i18n/translations.js';
import { MoonIcon, SunIcon } from './Icons.js';

interface FooterProps {
  t: TranslationDictionary;
  isDark: boolean;
  animationsPaused: boolean;
  onToggleAnimations: () => void;
  onToggleTheme: () => void;
}

/**
 * Accessible site footer containing privacy notice, animation pause toggle, and dark/light switcher.
 */
export function Footer({
  t,
  isDark,
  animationsPaused,
  onToggleAnimations,
  onToggleTheme,
}: Readonly<FooterProps>): ReactElement {
  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <div className="mx-auto flex max-w-6xl flex-col sm:flex-row items-center justify-between gap-4 px-4 py-5 sm:px-6 text-xs text-slate-600 dark:text-slate-400">
        <p>{t.footerText}</p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onToggleAnimations}
            aria-pressed={animationsPaused}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 px-3.5 py-2 text-xs font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <span>{animationsPaused ? t.animationsResumeBtn : t.animationsPauseBtn}</span>
          </button>
          <button
            type="button"
            onClick={onToggleTheme}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 px-3.5 py-2 text-xs font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {isDark ? <SunIcon className="w-4 h-4" /> : <MoonIcon className="w-4 h-4" />}
            <span>{isDark ? t.themeToggleLight : t.themeToggleDark}</span>
          </button>
        </div>
      </div>
    </footer>
  );
}
