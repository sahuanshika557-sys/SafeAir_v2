import type { Language } from '../types/index.js';
import { EN_TRANSLATIONS } from './en.js';
import { HI_TRANSLATIONS } from './hi.js';
import type { TranslationDictionary } from './types.js';

export type { TranslationDictionary } from './types.js';

/** Bilingual dictionary map keyed by supported UI language (`'en'` | `'hi'`). */
export const TRANSLATIONS: Record<Language, TranslationDictionary> = {
  en: EN_TRANSLATIONS,
  hi: HI_TRANSLATIONS,
};
