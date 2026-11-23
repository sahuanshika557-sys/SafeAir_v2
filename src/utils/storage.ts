import { ANIMATIONS_PAUSED_STORAGE_KEY, LANGUAGE_STORAGE_KEY } from '../constants/index.js';
import type { Language } from '../types/index.js';

/**
 * Reads the persisted UI language preference safely.
 * No user location or personal profile data is persisted in `localStorage`.
 *
 * @returns Persisted {@link Language} preference, defaulting to `'en'` on unavailability.
 */
export function loadLanguagePreference(): Language {
  try {
    const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved === 'hi' || saved === 'en') {
      return saved;
    }
    return 'en';
  } catch {
    return 'en';
  }
}

/**
 * Persists the user's UI language preference in `localStorage` safely.
 *
 * @param language - Selected UI language (`'en'` or `'hi'`).
 */
export function saveLanguagePreference(language: Language): void {
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Ignore storage quota or private-mode errors gracefully.
  }
}

/**
 * Reads the persisted animation pause accessibility preference safely.
 *
 * @returns `true` if animations are paused by user preference, otherwise `false`.
 */
export function loadAnimationsPausedPreference(): boolean {
  try {
    return window.localStorage.getItem(ANIMATIONS_PAUSED_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Persists the user's animation pause toggle in `localStorage` safely.
 *
 * @param paused - Whether visual animations are paused.
 */
export function saveAnimationsPausedPreference(paused: boolean): void {
  try {
    window.localStorage.setItem(ANIMATIONS_PAUSED_STORAGE_KEY, paused ? 'true' : 'false');
  } catch {
    // Ignore storage quota or private-mode errors gracefully.
  }
}
