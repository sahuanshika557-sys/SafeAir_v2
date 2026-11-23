import type { AqiCategoryInfo } from '../types/index.js';

/**
 * US EPA AQI breakpoints, labels (EN/HI), and high-contrast color tokens.
 */
export const AQI_CATEGORIES: readonly AqiCategoryInfo[] = [
  {
    key: 'good',
    labelEn: 'Good',
    labelHi: 'अच्छा',
    minAqi: 0,
    maxAqi: 50,
    accentHex: '#15803d',
    surfaceClass: 'bg-emerald-50 dark:bg-emerald-950/60',
    textClass: 'text-emerald-800 dark:text-emerald-200',
    borderClass: 'border-emerald-300 dark:border-emerald-700',
    summaryEn: 'Air quality poses little or no risk for most people.',
    summaryHi: 'हवा की गुणवत्ता अधिकांश लोगों के लिए सुरक्षित है।',
  },
  {
    key: 'moderate',
    labelEn: 'Moderate',
    labelHi: 'मध्यम',
    minAqi: 51,
    maxAqi: 100,
    accentHex: '#a16207',
    surfaceClass: 'bg-amber-50 dark:bg-amber-950/60',
    textClass: 'text-amber-900 dark:text-amber-200',
    borderClass: 'border-amber-300 dark:border-amber-700',
    summaryEn:
      'Acceptable air quality; unusually sensitive individuals should limit prolonged exertion.',
    summaryHi: 'हवा की गुणवत्ता ठीक है; अत्यधिक संवेदनशील लोग बाहर भारी मेहनत कम करें।',
  },
  {
    key: 'sensitive',
    labelEn: 'Unhealthy for Sensitive Groups',
    labelHi: 'संवेदनशील समूहों के लिए अस्वस्थ',
    minAqi: 101,
    maxAqi: 150,
    accentHex: '#c2410c',
    surfaceClass: 'bg-orange-50 dark:bg-orange-950/60',
    textClass: 'text-orange-900 dark:text-orange-200',
    borderClass: 'border-orange-300 dark:border-orange-700',
    summaryEn:
      'Children, elderly, pregnant people, and respiratory patients may experience effects.',
    summaryHi: 'बच्चों, बुजुर्गों, गर्भवती महिलाओं और सांस के रोगियों को परेशानी हो सकती है।',
  },
  {
    key: 'unhealthy',
    labelEn: 'Unhealthy',
    labelHi: 'अस्वस्थ',
    minAqi: 151,
    maxAqi: 200,
    accentHex: '#b91c1c',
    surfaceClass: 'bg-red-50 dark:bg-red-950/60',
    textClass: 'text-red-900 dark:text-red-200',
    borderClass: 'border-red-300 dark:border-red-700',
    summaryEn: 'Everyone may begin to experience health effects; wear N95/FFP2 outdoors.',
    summaryHi: 'हर किसी के स्वास्थ्य पर असर पड़ सकता है; बाहर निकलते समय N95/FFP2 मास्क पहनें।',
  },
  {
    key: 'very_unhealthy',
    labelEn: 'Very Unhealthy',
    labelHi: 'बहुत अस्वस्थ',
    minAqi: 201,
    maxAqi: 300,
    accentHex: '#7e22ce',
    surfaceClass: 'bg-purple-50 dark:bg-purple-950/60',
    textClass: 'text-purple-900 dark:text-purple-200',
    borderClass: 'border-purple-300 dark:border-purple-700',
    summaryEn:
      'Health alert: avoid outdoor exertion, seal windows during peak smog, and filter indoor air.',
    summaryHi: 'स्वास्थ्य चेतावनी: बाहर व्यायाम से बचें, स्मॉग के समय खिड़कियाँ बंद रखें।',
  },
  {
    key: 'hazardous',
    labelEn: 'Hazardous',
    labelHi: 'खतरनाक',
    minAqi: 301,
    maxAqi: 500,
    accentHex: '#881337',
    surfaceClass: 'bg-rose-100 dark:bg-rose-950/80',
    textClass: 'text-rose-950 dark:text-rose-100',
    borderClass: 'border-rose-400 dark:border-rose-700',
    summaryEn:
      'Emergency conditions: stay indoors with clean air filtration and monitor symptoms closely.',
    summaryHi: 'आपातकालीन स्थिति: स्वच्छ हवा वाले कमरे में अंदर रहें और लक्षणों पर ध्यान दें।',
  },
] as const;

/**
 * Official US EPA PM2.5 (µg/m³) to US AQI piecewise linear breakpoints:
 * `[cLow, cHigh, iLow, iHigh]`.
 */
export const PM25_EPA_BREAKPOINTS: ReadonlyArray<readonly [number, number, number, number]> = [
  [0, 12.0, 0, 50],
  [12.1, 35.4, 51, 100],
  [35.5, 55.4, 101, 150],
  [55.5, 150.4, 151, 200],
  [150.5, 250.4, 201, 300],
  [250.5, 500.4, 301, 500],
];
