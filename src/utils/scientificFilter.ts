import type { Language, RecommendationItem } from '../types/index.js';
import { SCIENTIFIC_CLAIM_RULES, type ScientificClaimFlag } from './scientificClaimRules.js';

export type { ScientificClaimFlag } from './scientificClaimRules.js';

/**
 * Result returned after checking and sanitizing AI text for scientific accuracy.
 */
export interface ScientificCheckResult {
  text: string;
  flaggedClaims: ScientificClaimFlag[];
}

/**
 * Result returned after checking and sanitizing a structured action plan payload.
 */
export interface ScientificPlanCheckResult<T> {
  plan: T;
  flaggedClaims: ScientificClaimFlag[];
}

function isDigitChar(ch: string | undefined): boolean {
  return ch !== undefined && ch >= '0' && ch <= '9';
}

function splitSentencesPreservingDecimals(text: string): string[] {
  const sentences: string[] = [];
  let start = 0;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const isSentenceEnd =
      ch === '\n' ||
      ch === '!' ||
      ch === '?' ||
      ch === '।' ||
      (ch === '.' && !(isDigitChar(text[i - 1]) && isDigitChar(text[i + 1])));

    if (isSentenceEnd) {
      sentences.push(text.slice(start, i + 1));
      start = i + 1;
    }
  }
  if (start < text.length) {
    sentences.push(text.slice(start));
  }
  return sentences;
}

function sanitizeSentence(
  sentence: string,
  language: Language,
  flagged: Set<ScientificClaimFlag>,
  emittedFlags: Set<ScientificClaimFlag>,
): string {
  const replacements: string[] = [];
  for (const rule of SCIENTIFIC_CLAIM_RULES) {
    if (rule.matches(sentence)) {
      flagged.add(rule.flag);
      if (!emittedFlags.has(rule.flag)) {
        emittedFlags.add(rule.flag);
        replacements.push(language === 'hi' ? rule.replacementHi : rule.replacementEn);
      }
    }
  }
  return replacements.length > 0 ? ` ${replacements.join(' ')}` : sentence;
}

/**
 * Checks free-form AI text (e.g., follow-up chat answers) for scientifically unsupported claims
 * such as houseplants purifying indoor PM2.5 or unrealistic filtration percentages, and replaces
 * flagged claims with accurate guidance in the active UI language.
 */
export function sanitizeChatScientificClaims(
  text: string,
  language: Language,
): ScientificCheckResult {
  if (!text) {
    return { text: '', flaggedClaims: [] };
  }
  const flagged = new Set<ScientificClaimFlag>();
  const emittedFlags = new Set<ScientificClaimFlag>();
  const rewritten = splitSentencesPreservingDecimals(text)
    .map((sentence) => sanitizeSentence(sentence, language, flagged, emittedFlags))
    .join('');

  return {
    text: rewritten
      .replaceAll(/[ \t]{2,}/g, ' ')
      .replaceAll(/\n{3,}/g, '\n\n')
      .trim(),
    flaggedClaims: Array.from(flagged),
  };
}

interface ActionPlanLike {
  summary: string;
  bestTimeWindow: string;
  worstTimeWindow: string;
  dailyRoutine: RecommendationItem[];
  indoorAirHacks: RecommendationItem[];
  sustainableAlternatives: RecommendationItem[];
  healthProtection: RecommendationItem[];
}

function cleanTextField(
  value: string,
  language: Language,
  planFlags: Set<ScientificClaimFlag>,
  itemFlags?: Set<ScientificClaimFlag>,
): string {
  const res = sanitizeChatScientificClaims(value, language);
  for (const flag of res.flaggedClaims) {
    planFlags.add(flag);
    itemFlags?.add(flag);
  }
  return res.text;
}

function rewriteFlaggedTitle(
  title: string,
  itemFlags: ReadonlySet<ScientificClaimFlag>,
  language: Language,
): string {
  if (
    itemFlags.has('houseplant_air_purification') &&
    /(?:plant|पौध)/i.test(title) &&
    !/HEPA/i.test(title)
  ) {
    return language === 'hi'
      ? 'HEPA या MERV-13 DIY फ़िल्ट्रेशन अपनाएँ'
      : 'Use HEPA or MERV-13 DIY box-fan filtration';
  }
  if (
    itemFlags.has('cloth_mask_pm25_claim') &&
    /(?:cloth|scarf|handkerchief|कपड़|रुमाल)/i.test(title) &&
    !/N95/i.test(title)
  ) {
    return language === 'hi'
      ? 'सही फिटिंग वाला N95/FFP2 मास्क पहनें'
      : 'Wear a well-fitted N95/FFP2 respirator';
  }
  return title;
}

function cleanRecommendationItem(
  item: RecommendationItem,
  language: Language,
  planFlags: Set<ScientificClaimFlag>,
): RecommendationItem {
  const itemFlags = new Set<ScientificClaimFlag>();
  const rawTitle = cleanTextField(item.title, language, planFlags, itemFlags);
  const detail = cleanTextField(item.detail, language, planFlags, itemFlags);
  const whyItHelps = cleanTextField(item.whyItHelps, language, planFlags, itemFlags);
  const estimatedImpact = cleanTextField(item.estimatedImpact, language, planFlags, itemFlags);
  const timeWindow = item.timeWindow
    ? cleanTextField(item.timeWindow, language, planFlags, itemFlags)
    : undefined;
  const title = rewriteFlaggedTitle(rawTitle, itemFlags, language);
  return {
    ...item,
    title,
    detail,
    whyItHelps,
    estimatedImpact,
    ...(timeWindow ? { timeWindow } : {}),
  };
}

/**
 * Checks and sanitizes all recommendation items and summary fields in a structured AI plan
 * so scientifically inaccurate claims never reach users.
 */
export function sanitizePlanScientificClaims<T extends ActionPlanLike>(
  plan: T,
  language: Language,
): ScientificPlanCheckResult<T> {
  const flags = new Set<ScientificClaimFlag>();
  const cleanSection = (items: readonly RecommendationItem[]): RecommendationItem[] =>
    items.map((item) => cleanRecommendationItem(item, language, flags));

  return {
    plan: {
      ...plan,
      summary: cleanTextField(plan.summary, language, flags),
      dailyRoutine: cleanSection(plan.dailyRoutine),
      indoorAirHacks: cleanSection(plan.indoorAirHacks),
      sustainableAlternatives: cleanSection(plan.sustainableAlternatives),
      healthProtection: cleanSection(plan.healthProtection),
    },
    flaggedClaims: Array.from(flags),
  };
}
