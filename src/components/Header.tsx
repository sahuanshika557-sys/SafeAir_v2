import type { ReactElement } from 'react';
import type { TranslationDictionary } from '../i18n/translations.js';
import type { Language } from '../types/index.js';

interface HeaderProps {
  t: TranslationDictionary;
  language: Language;
  onToggleLanguage: () => void;
}

/**
 * Accessible 3-zone top bar with skip-to-content link, concise navigation, and language toggle.
 */
export function Header({ t, language, onToggleLanguage }: Readonly<HeaderProps>): ReactElement {
  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-teal-800 focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg"
      >
        {t.skipToContent}
      </a>
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-4 py-3 sm:px-6">
          <a
            href="#air-quality"
            className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0"
          >
            {t.brandName}
          </a>

          <nav
            aria-label={t.navAriaLabel}
            className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300"
          >
            <a
              href="#air-quality"
              className="hover:text-teal-800 dark:hover:text-teal-300 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              {t.navAirQuality}
            </a>
            <a
              href="#lifestyle-profile"
              className="hover:text-teal-800 dark:hover:text-teal-300 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              {t.navProfile}
            </a>
            <a
              href="#action-plan"
              className="hover:text-teal-800 dark:hover:text-teal-300 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              {t.navPlan}
            </a>
            <a
              href="#impact-calculator"
              className="hover:text-teal-800 dark:hover:text-teal-300 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              {t.navImpact}
            </a>
            <a
              href="#ask-saathi"
              className="hover:text-teal-800 dark:hover:text-teal-300 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              {t.navChat}
            </a>
          </nav>

          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={onToggleLanguage}
              lang={language === 'en' ? 'hi' : 'en'}
              aria-label={t.languageSwitchLabel}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg bg-teal-800 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-900 dark:bg-teal-700 dark:hover:bg-teal-600 transition-colors whitespace-nowrap shrink-0"
            >
              {t.languageSwitchLabel}
            </button>
          </div>
        </div>
      </header>
    </>
  );
}
