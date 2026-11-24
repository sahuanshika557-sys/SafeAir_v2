import type { LifestyleProfile, RecommendationItem } from '../types/index.js';

interface FallbackSectionContent {
  readonly bestTimeWindow: string;
  readonly worstTimeWindow: string;
  buildSummary: (placeName: string | undefined, aqi: number, categoryLabel: string) => string;
  buildDailyRoutine: (isSevere: boolean, profile: LifestyleProfile) => RecommendationItem[];
  buildIndoorAirHacks: (hasAirPurifier: boolean) => RecommendationItem[];
  buildSustainableAlternatives: (profile: LifestyleProfile) => RecommendationItem[];
  buildHealthProtection: (isSevere: boolean, hasVulnerable: boolean) => RecommendationItem[];
}

/** Hindi localized rule-based safety action plan templates for fallback resilience. */
export const FALLBACK_TEMPLATE_HI: FallbackSectionContent = {
  bestTimeWindow: 'दोपहर 1:00 बजे से शाम 4:00 बजे तक (सबसे कम स्मॉग जमाव)',
  worstTimeWindow: 'सुबह 5:30–9:30 बजे और रात 8:00–11:30 बजे (तापमान व्युत्क्रमण चरम)',
  buildSummary: (placeName, aqi, categoryLabel) => {
    const locationPrefix = placeName ? `${placeName} में ` : '';
    return `${locationPrefix}वर्तमान AQI ${aqi} (${categoryLabel}) के आधार पर यह नियम-आधारित सुरक्षा योजना तैयार की गई है।`;
  },
  buildDailyRoutine: (isSevere, profile) => [
    {
      title: 'सुबह की बाहर की सैर को दोपहर में बदलें',
      detail: isSevere
        ? 'सुबह-सुबह बाहर व्यायाम बंद करें और इनडोर स्ट्रेचिंग करें।'
        : 'सुबह 9 बजे से पहले भारी बाहरी व्यायाम से बचें; दोपहर की धूप में हल्की सैर करें।',
      whyItHelps: 'सर्दियों की ठंडी सुबह में प्रदूषक जमीन के पास फंसे रहते हैं और गहरी सांस से फेफड़ों में जाते हैं।',
      estimatedImpact: '25%–40% कम दैनिक PM2.5 श्वसन जोखिम',
      timeWindow: 'सुबह 6:00 – 9:30 बजे टालें',
    },
    {
      title: 'कम उत्सर्जन वाला आवागमन चुनें',
      detail:
        profile.commuteMode === 'car' || profile.commuteMode === 'two_wheeler'
          ? 'संभव हो तो मेट्रो या इलेक्ट्रिक बस का उपयोग करें और कार की खिड़कियाँ बंद कर रीसर्कुलेशन मोड चलाएँ।'
          : 'व्यस्त मुख्य सड़कों के बजाय कम ट्रैफिक वाली गलियों से यात्रा करें।',
      whyItHelps: 'मुख्य सड़कों और निजी वाहनों के धुएं से दूर रहने पर तात्कालिक NO2 और PM2.5 संपर्क घटता है।',
      estimatedImpact: '15%–30% कम यात्रा प्रदूषण और ~1,500–2,300 ग्राम CO₂ बचत/दिन',
      timeWindow: 'सुबह और शाम के पीक ट्रैफिक में',
    },
  ],
  buildIndoorAirHacks: (hasAirPurifier) => [
    {
      title: 'दोपहर में सीमित क्रॉस-वेंटिलेशन करें',
      detail:
        'केवल दोपहर 1:30–3:30 बजे के बीच 15–20 मिनट खिड़कियाँ खोलें; बाकी समय दरारें गीले कपड़े या ड्राफ्ट स्टॉपर से सील रखें।',
      whyItHelps: 'दिन के गर्म घंटों में बाहरी कण स्तर आमतौर पर सबसे कम होता है जिससे कमरे में ताजी हवा आती है।',
      estimatedImpact: '20%–35% कम इनडोर धूल और स्मॉग प्रवेश',
    },
    {
      title: hasAirPurifier
        ? 'HEPA एयर प्यूरीफायर लगातार चलाएँ'
        : 'गीला पोंछा और DIY बॉक्स-फैन फ़िल्टर अपनाएँ',
      detail: hasAirPurifier
        ? 'सोने के कमरे का दरवाजा बंद कर मध्यम गति पर प्यूरीफायर चलाएँ।'
        : 'झाड़ू के बजाय गीला पोंछा लगाएँ; पत्तियां या पौधे PM2.5 नहीं हटाते, इसलिए HEPA या MERV-13 बॉक्स-फैन फ़िल्टर प्रभावी है।',
      whyItHelps:
        'गीला पोंछा जमी हुई धूल को फिर से हवा में उड़ने से रोकता है और मैकेनिकल फ़िल्टर बारीक कण पकड़ते हैं।',
      estimatedImpact: '30%–55% कम इनडोर PM2.5 स्तर',
    },
  ],
  buildSustainableAlternatives: (profile) => [
    {
      title: 'खाना पकाने और हीटिंग में स्वच्छ विकल्प',
      detail:
        profile.cookingFuel === 'wood' || profile.cookingFuel === 'other'
          ? 'लकड़ी/कोयले के बजाय इंडक्शन या LPG और प्रेशर कुकर का प्रयोग करें।'
          : 'खाना पकाते समय चिमनी या एग्जॉस्ट फैन चलाएँ और घर में अगरबत्ती/मोमबत्ती जलाने से बचें।',
      whyItHelps: 'ठोस ईंधन और घर के भीतर धुआँ घर के अंदर खतरनाक PM2.5 को कई गुना बढ़ा देता है।',
      estimatedImpact: '35%–60% कम इनडोर धुआँ और ~900 ग्राम CO₂ बचत/दिन',
    },
    {
      title: 'कचरा और सूखे पत्ते न जलाएँ',
      detail: 'मोहल्ले में सूखे पत्तों की खाद बनाएँ और गीले-सूखे कचरे को अलग कर नगर निगम संग्रह में दें।',
      whyItHelps: 'खुले में कचरा जलाने से जहरीला स्थानीय धुआँ और डाइऑक्सिन निकलते हैं जो पड़ोस को प्रभावित करते हैं।',
      estimatedImpact: '10%–20% कम स्थानीय धुआँ और ~500 ग्राम CO₂ बचत/दिन',
    },
  ],
  buildHealthProtection: (isSevere, hasVulnerable) => [
    {
      title: 'अच्छी फिटिंग वाला N95 या FFP2 मास्क पहनें',
      detail: isSevere
        ? 'कपड़े या सर्जिकल मास्क के बजाय नाक पर कसकर बैठने वाला N95/FFP2 मास्क बाहर जाते समय पहनें।'
        : 'भीड़भाड़ या धूल भरी सड़कों पर N95/FFP2 मास्क साथ रखें।',
      whyItHelps:
        'कपड़े के मास्क सूक्ष्म PM2.5 कण नहीं रोक सकते, जबकि सही फिट वाला N95 अधिकांश बारीक कण छान देता है।',
      estimatedImpact: '40%–70% कम बारीक कण श्वसन (फिटिंग पर निर्भर)',
    },
    {
      title: 'संवेदनशील सदस्यों और लक्षणों की निगरानी',
      detail: hasVulnerable
        ? 'बच्चों, बुजुर्गों, गर्भवती महिलाओं या दमा रोगियों में लगातार खांसी, घरघराहट, सीने में जकड़न या सांस फूलने पर तुरंत डॉक्टर से मिलें।'
        : 'लगातार खांसी, सांस लेने में तकलीफ, चक्कर या आंखों में तेज जलन होने पर चिकित्सक से परामर्श लें।',
      whyItHelps: 'समय पर चिकित्सा जांच गंभीर श्वसन संक्रमण या अस्थमा अटैक को रोकने में मदद करती है।',
      estimatedImpact: 'प्रारंभिक हस्तक्षेप से गंभीर जटिलताओं का जोखिम काफी कम होता है',
    },
  ],
};

/** English localized rule-based safety action plan templates for fallback resilience. */
export const FALLBACK_TEMPLATE_EN: FallbackSectionContent = {
  bestTimeWindow: '1:00 PM – 4:00 PM (peak vertical mixing reduces ground-level smog)',
  worstTimeWindow:
    '5:30 AM – 9:30 AM & 8:00 PM – 11:30 PM (winter inversion traps exhaust near ground)',
  buildSummary: (placeName, aqi, categoryLabel) => {
    const locationSuffix = placeName ? `${placeName} at ` : '';
    return `Rule-based guidance for ${locationSuffix}US AQI ${aqi} (${categoryLabel}).`;
  },
  buildDailyRoutine: (isSevere, profile) => [
    {
      title: 'Shift outdoor exercise away from morning inversion',
      detail: isSevere
        ? 'Replace morning outdoor walks or runs with indoor stretching; reserve essential errands for midday.'
        : 'Avoid strenuous outdoor exercise before 9:30 AM; use midday hours for brief outdoor activity.',
      whyItHelps:
        'Cold winter nights trap vehicle and heating emissions near ground level until afternoon warmth disperses them.',
      estimatedImpact: '25%–40% lower daily PM2.5 inhalation',
      timeWindow: 'Avoid 5:30 AM – 9:30 AM',
    },
    {
      title: 'Choose lower-exposure commuting routes & modes',
      detail:
        profile.commuteMode === 'car' || profile.commuteMode === 'two_wheeler'
          ? 'Switch to Metro or electric bus when possible; if driving, set cabin AC to recirculate.'
          : 'Prefer quieter side streets away from heavy diesel traffic and avoid idling intersections.',
      whyItHelps:
        'Busy corridors have sharp NO2 and ultrafine particle spikes that drop rapidly a block away from traffic.',
      estimatedImpact: '15%–30% lower commute exposure & ~1,500–2,300 g CO₂ saved/day',
      timeWindow: 'Peak commute hours',
    },
  ],
  buildIndoorAirHacks: (hasAirPurifier) => [
    {
      title: 'Time ventilation strictly to midday',
      detail:
        'Open windows for 15–20 minutes between 1:30 PM and 3:30 PM when outdoor haze dips; seal gaps with damp towels or draft tape at night.',
      whyItHelps:
        'Keeping windows shut during high-smog night hours slows outdoor PM2.5 infiltration indoors.',
      estimatedImpact: '20%–35% reduction in indoor smog infiltration',
    },
    {
      title: hasAirPurifier
        ? 'Run HEPA purifier continuously in the main bedroom'
        : 'Wet-mop floors & skip relying on houseplants for smog',
      detail: hasAirPurifier
        ? 'Close bedroom doors and run your HEPA unit on medium-high while occupied.'
        : 'Wet-mop instead of dry sweeping. Note: houseplants do not meaningfully filter PM2.5; a budget MERV-13 box-fan filter or HEPA unit works far better.',
      whyItHelps:
        'Dry sweeping resuspends settled particulate matter, while mechanical HEPA/MERV-13 media physically traps fine particles.',
      estimatedImpact: '30%–55% lower indoor PM2.5 concentration',
    },
  ],
  buildSustainableAlternatives: (profile) => [
    {
      title: 'Clean cooking & zero indoor combustion',
      detail:
        profile.cookingFuel === 'wood' || profile.cookingFuel === 'other'
          ? 'Transition toward induction, electric kettle/rice cooker, or LPG to eliminate solid-fuel smoke.'
          : 'Run kitchen exhaust while cooking, use lids to shorten cook time, and skip incense or candles.',
      whyItHelps:
        'Indoor combustion produces concentrated PM2.5 and CO right inside living spaces.',
      estimatedImpact: '35%–60% less indoor cooking smoke & ~900 g CO₂ saved/day',
    },
    {
      title: 'Zero open waste or leaf burning',
      detail:
        profile.budget === 'low'
          ? 'Compost dry leaves in a simple pit or bag and keep waste separated for municipal collection.'
          : 'Organize community leaf composting and choose electric room heating layers over charcoal braziers.',
      whyItHelps:
        'Open burning emits toxic fine particulates, PAHs, and carbon monoxide directly at breathing height.',
      estimatedImpact: '10%–20% lower neighborhood smoke & ~500 g CO₂ saved/day',
    },
  ],
  buildHealthProtection: (isSevere, hasVulnerable) => [
    {
      title: 'Use a snug N95 or FFP2 respirator outdoors',
      detail: isSevere
        ? 'Wear a well-sealed N95/FFP2 mask (no gaps around nose bridge) for every outdoor trip.'
        : 'Carry an N95/FFP2 mask for congested roads or sudden haze spikes; cloth masks do not block PM2.5.',
      whyItHelps:
        'Electrostatic melt-blown filter layers capture fine PM2.5 droplets that pass straight through cloth.',
      estimatedImpact: '40%–70% lower inhaled PM2.5 (depends on facial seal)',
    },
    {
      title: 'Monitor symptoms & know when to seek care',
      detail: hasVulnerable
        ? 'Keep rescue inhalers accessible for respiratory patients. Seek medical care promptly for wheezing, chest tightness, shortness of breath, or persistent cough in children, elderly, or pregnant members.'
        : 'Seek medical evaluation promptly if you experience persistent cough, wheezing, chest pain, dizziness, or unusual shortness of breath.',
      whyItHelps:
        'Early clinical care prevents acute airway inflammation from escalating during multi-day smog episodes.',
      estimatedImpact: 'Timely intervention substantially lowers severe flare-up risk',
    },
  ],
};
