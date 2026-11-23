/**
 * Identifier for scientific accuracy claim categories guarded on AI outputs.
 */
export type ScientificClaimFlag =
  | 'houseplant_air_purification'
  | 'unrealistic_filtration_claim'
  | 'cloth_mask_pm25_claim';

/** Rule definition matching a scientific misconception and providing localized safe guidance. */
export interface ClaimRule {
  flag: ScientificClaimFlag;
  matches: (sentence: string) => boolean;
  replacementEn: string;
  replacementHi: string;
}

const HOUSEPLANT_TERMS_EN = [
  'houseplant', 'indoor plant', 'snake plant', 'spider plant',
  'areca palm', 'peace lily', 'peace lilies', 'money plant', 'aloe vera', 'boston fern',
] as const;
const HOUSEPLANT_TERMS_HI = [
  'घर के पौधे', 'इनडोर पौधे', 'स्नेक प्लांट', 'एरेका पाम', 'मनी प्लांट',
] as const;
const PLANT_PURIFY_VERBS_EN = ['purif', 'clean', 'filter', 'remove', 'absorb', 'reduce'] as const;
const PLANT_PURIFY_TERMS_HI = ['शुद्ध', 'साफ़', 'साफ', 'अवशोषित', 'हटा', 'कम'] as const;
const NEGATION_PREFIXES_EN = ['do not', "don't", 'does not', "doesn't", 'cannot', "can't", 'never'] as const;
const NEGATION_PHRASES_HI = ['नहीं करते', 'नहीं हटाते', 'साफ नहीं', 'साफ़ नहीं', 'रोकते नहीं', 'मदद नहीं'] as const;

const HIGH_PERCENT_RE = /\b(?:100|99\.9+)\s*%/;
const FILTRATION_TOPICS_EN = ['filtration', 'air pollution', 'smog', 'pm2.5', 'pm 2.5', 'pm25', 'toxin', 'particle', 'smoke', 'indoor air'] as const;
const FILTRATION_TOPICS_HI = ['प्रदूषण', 'स्मॉग', 'pm2.5', 'कण', 'धुआँ'] as const;

const CLOTH_MASK_TERMS = ['cloth mask', 'bandana', 'handkerchief', 'scarf', 'scarves', 'dupatta', 'कपड़े का मास्क', 'रुमाल', 'दुपट्टा'] as const;
const MASK_FILTER_VERBS = ['block', 'filter', 'stop', 'protect', 'रोक', 'छान', 'बचा'] as const;
const MASK_TARGET_TERMS = ['pm2.5', 'pm 2.5', 'fine particle', 'smog', 'सूक्ष्म कण', 'स्मॉग', '90%', '95%', '99%'] as const;
const STREAM_SUSPECT_KEYWORDS = [
  ...HOUSEPLANT_TERMS_EN,
  'पौध',
  '100%',
  '99.9',
  ...CLOTH_MASK_TERMS,
] as const;

function includesAny(lower: string, terms: readonly string[]): boolean {
  return terms.some((term) => lower.includes(term));
}

function isPlantNegationEn(lower: string): boolean {
  return NEGATION_PREFIXES_EN.some((neg) => {
    const negIdx = lower.indexOf(neg);
    return negIdx !== -1 && includesAny(lower.slice(negIdx), PLANT_PURIFY_VERBS_EN);
  });
}

function hasHouseplantPurificationClaim(sentence: string): boolean {
  const lower = sentence.toLowerCase();
  if (includesAny(lower, NEGATION_PHRASES_HI) || isPlantNegationEn(lower)) {
    return false;
  }
  const hasEn = includesAny(lower, HOUSEPLANT_TERMS_EN) && includesAny(lower, PLANT_PURIFY_VERBS_EN);
  const hasHi =
    includesAny(lower, HOUSEPLANT_TERMS_HI) &&
    (lower.includes('हवा') || lower.includes('प्रदूषण') || lower.includes('pm2.5') || lower.includes('स्मॉग')) &&
    includesAny(lower, PLANT_PURIFY_TERMS_HI);
  return hasEn || hasHi;
}

function hasUnrealisticFiltrationClaim(sentence: string): boolean {
  const lower = sentence.toLowerCase();
  return HIGH_PERCENT_RE.test(lower) && (includesAny(lower, FILTRATION_TOPICS_EN) || includesAny(lower, FILTRATION_TOPICS_HI));
}

function hasClothMaskPm25Claim(sentence: string): boolean {
  const lower = sentence.toLowerCase();
  return includesAny(lower, CLOTH_MASK_TERMS) && includesAny(lower, MASK_FILTER_VERBS) && includesAny(lower, MASK_TARGET_TERMS);
}

/**
 * Checks whether a partial chat stream buffer contains keywords related to guarded misconceptions
 * so SSE streaming only buffers incomplete sentences when a scientific claim may be mid-flight.
 */
export function isSuspectClaimBuffer(text: string): boolean {
  const lower = text.toLowerCase();
  return includesAny(lower, STREAM_SUSPECT_KEYWORDS) || /100\s*%/.test(lower);
}

/** Ordered list of scientific claim accuracy rules applied across AI chat and plan outputs. */
export const SCIENTIFIC_CLAIM_RULES: readonly ClaimRule[] = [
  {
    flag: 'houseplant_air_purification',
    matches: hasHouseplantPurificationClaim,
    replacementEn:
      'Houseplants do not meaningfully remove PM2.5 or winter smog indoors; use a HEPA purifier or MERV-13 DIY box-fan filter, seal window gaps, avoid indoor smoke sources, and time ventilation to lower-AQI afternoon hours.',
    replacementHi:
      'घरेलू पौधे घर के भीतर PM2.5 या स्मॉग को प्रभावी ढंग से नहीं हटाते; इसके बजाय HEPA प्यूरीफायर या MERV-13 DIY बॉक्स-फैन फ़िल्टर चलाएँ, खिड़की की दरारें सील करें, धुएँ के स्रोतों से बचें और कम-AQI समय में वेंटिलेशन करें।',
  },
  {
    flag: 'unrealistic_filtration_claim',
    matches: hasUnrealisticFiltrationClaim,
    replacementEn:
      'No indoor measure eliminates 100% of winter smog; combining sealed window gaps, source control, and HEPA filtration substantially lowers exposure.',
    replacementHi:
      'कोई भी घरेलू उपाय 100% स्मॉग को पूरी तरह खत्म नहीं करता; खिड़कियाँ सील करने, धुएँ के स्रोत रोकने और HEPA फ़िल्ट्रेशन से जोखिम काफी कम होता है।',
  },
  {
    flag: 'cloth_mask_pm25_claim',
    matches: hasClothMaskPm25Claim,
    replacementEn:
      'Cloth masks and scarves do not reliably filter fine PM2.5 particles; choose a snug, well-fitted N95/FFP2 respirator outdoors.',
    replacementHi:
      'कपड़े के मास्क या रुमाल सूक्ष्म PM2.5 कणों को प्रभावी ढंग से नहीं रोकते; बाहर अच्छी फिटिंग वाला N95/FFP2 मास्क पहनें।',
  },
];
