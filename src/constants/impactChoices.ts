import type { ImpactChoiceDefinition } from '../types/index.js';

/**
 * Interactive impact calculator options with approximate weekly estimates.
 * Values represent conservative, order-of-magnitude weekly approximations.
 */
export const IMPACT_CHOICES: readonly ImpactChoiceDefinition[] = [
  {
    id: 'metro_over_car',
    labelEn: 'Take Metro / Bus instead of solo Car (5 days/week)',
    labelHi: 'अकेले कार के बजाय मेट्रो / बस लें (सप्ताह में 5 दिन)',
    descriptionEn:
      'Assumes replacing ~15 km/day solo petrol car (~192 g CO₂/km) with electric/shared transit; lowers in-traffic NO₂/PM2.5 spikes.',
    descriptionHi:
      'लगभग 15 किमी/दिन अकेली पेट्रोल कार यात्रा को मेट्रो/बस से बदलने पर आधारित; ट्रैफिक के धुएं से संपर्क घटता है।',
    approxCo2SavedGramsPerWeek: 11500,
    approxPm25ReductionFraction: 0.08,
  },
  {
    id: 'n95_mask',
    labelEn: 'Wear a well-fitted N95 / FFP2 mask outdoors',
    labelHi: 'बाहर अच्छी फिटिंग वाला N95 / FFP2 मास्क पहनें',
    descriptionEn:
      'Assumes ~90%+ filtration while commuting/walking outdoors (~35% of daily breathing share after accounting for facial seal gaps).',
    descriptionHi:
      'बाहर आवागमन के समय सही फिटिंग वाले N95 मास्क से कण छनने पर आधारित (चेहरे की सील और घर के अंदर के समय को ध्यान में रखते हुए)।',
    approxCo2SavedGramsPerWeek: 0,
    approxPm25ReductionFraction: 0.3,
  },
  {
    id: 'induction_over_wood',
    labelEn: 'Use Induction / Electric or LPG instead of Wood/Biomass',
    labelHi: 'लकड़ी/कोयले के बजाय इंडक्शन या एलपीजी का उपयोग करें',
    descriptionEn:
      'Eliminates peak indoor solid-fuel smoke during cooking hours (ambient outdoor infiltration still remains).',
    descriptionHi:
      'खाना पकाने के समय घर के भीतर ठोस ईंधन के धुएं को हटाता है (बाहरी हवा का प्रभाव फिर भी बना रहता है)।',
    approxCo2SavedGramsPerWeek: 6200,
    approxPm25ReductionFraction: 0.22,
  },
  {
    id: 'no_waste_burning',
    labelEn: 'Compost or segregate leaves instead of open burning',
    labelHi: 'सूखे पत्ते या कचरा जलाने के बजाय खाद/अलग निपटान करें',
    descriptionEn:
      'Prevents intense localized neighborhood smoke plumes (~15 kg dry biomass/week avoided).',
    descriptionHi: 'पड़ोस में सूखे पत्ते/कचरा जलने से उठने वाले स्थानीय जहरीले धुएं को रोकता है।',
    approxCo2SavedGramsPerWeek: 3400,
    approxPm25ReductionFraction: 0.08,
  },
  {
    id: 'hepa_seal_windows',
    labelEn: 'Seal window gaps & run HEPA purifier / DIY box-fan filter',
    labelHi: 'खिड़की की दरारें सील करें और HEPA / DIY फ़िल्टर चलाएँ',
    descriptionEn:
      'Assumes filtering one main bedroom/living area overnight with doors closed during peak winter inversion.',
    descriptionHi: 'रात के पीक स्मॉग में दरवाजा बंद कर मुख्य कमरे में HEPA या बॉक्स-फैन फ़िल्टर चलाने पर आधारित।',
    approxCo2SavedGramsPerWeek: 0,
    approxPm25ReductionFraction: 0.25,
  },
  {
    id: 'cycle_short_trips',
    labelEn: 'Walk or cycle for errands under 2 km (on low-AQI hours)',
    labelHi: '2 किमी से कम दूरी के लिए पैदल या साइकिल चुनें (कम AQI समय में)',
    descriptionEn:
      'Replaces 5 short cold-start petrol trips/week (~2 km each) during afternoon lower-smog hours.',
    descriptionHi:
      'दोपहर के अपेक्षाकृत कम स्मॉग वाले समय में 5 छोटी दोपहिया/कार यात्राओं को पैदल या साइकिल से बदलता है।',
    approxCo2SavedGramsPerWeek: 2400,
    approxPm25ReductionFraction: 0.04,
  },
] as const;
