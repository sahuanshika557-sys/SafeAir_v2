import { useCallback, useEffect, useState } from 'react';
import { TRANSLATIONS } from '../i18n/translations.js';
import type { Language } from '../types/index.js';
import {
  loadAnimationsPausedPreference,
  loadLanguagePreference,
  saveAnimationsPausedPreference,
  saveLanguagePreference,
} from '../utils/storage.js';

interface UseThemeAndMotionReturn {
  language: Language;
  isDark: boolean;
  animationsPaused: boolean;
  effectiveAnimationsPaused: boolean;
  toggleLanguage: () => void;
  toggleTheme: () => void;
  toggleAnimations: () => void;
}

function prefersDarkTheme(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false;
}

function prefersReducedMotionSetting(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
}

function useReducedMotionPreference(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(() =>
    prefersReducedMotionSetting(),
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (event: MediaQueryListEvent): void => setPrefersReducedMotion(event.matches);
    mq.addEventListener?.('change', onChange);
    return (): void => mq.removeEventListener?.('change', onChange);
  }, []);

  return prefersReducedMotion;
}

/**
 * Coordinates bilingual document language & title, light/dark class state,
 * OS reduced-motion media listener, and user animation-pause preference.
 */
export function useThemeAndMotion(): UseThemeAndMotionReturn {
  const [language, setLanguage] = useState<Language>(() => loadLanguagePreference());
  const [isDark, setIsDark] = useState<boolean>(() => prefersDarkTheme());
  const [animationsPaused, setAnimationsPaused] = useState<boolean>(() =>
    loadAnimationsPausedPreference(),
  );
  const prefersReducedMotion = useReducedMotionPreference();
  const effectiveAnimationsPaused = animationsPaused || prefersReducedMotion;

  useEffect(() => {
    document.documentElement.lang = language;
    document.title = TRANSLATIONS[language].pageTitle;
  }, [language]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  useEffect(() => {
    document.documentElement.classList.toggle('animations-paused', effectiveAnimationsPaused);
  }, [effectiveAnimationsPaused]);

  const toggleLanguage = useCallback((): void => {
    setLanguage((prev) => {
      const next: Language = prev === 'en' ? 'hi' : 'en';
      saveLanguagePreference(next);
      return next;
    });
  }, []);

  const toggleTheme = useCallback((): void => setIsDark((prev) => !prev), []);

  const toggleAnimations = useCallback((): void => {
    setAnimationsPaused((prev) => {
      const next = !prev;
      saveAnimationsPausedPreference(next);
      return next;
    });
  }, []);

  return {
    language,
    isDark,
    animationsPaused,
    effectiveAnimationsPaused,
    toggleLanguage,
    toggleTheme,
    toggleAnimations,
  };
}
