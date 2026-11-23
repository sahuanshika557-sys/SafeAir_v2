/**
 * Supported UI and Gemini response languages.
 */
export type Language = 'en' | 'hi';

/**
 * Standard US AQI air quality category identifiers.
 */
export type AqiCategoryKey =
  'good' | 'moderate' | 'sensitive' | 'unhealthy' | 'very_unhealthy' | 'hazardous';

/**
 * Metadata and accessible styling tokens for an AQI category.
 */
export interface AqiCategoryInfo {
  key: AqiCategoryKey;
  labelEn: string;
  labelHi: string;
  minAqi: number;
  maxAqi: number;
  accentHex: string;
  surfaceClass: string;
  textClass: string;
  borderClass: string;
  summaryEn: string;
  summaryHi: string;
}

/**
 * Geographic location selected via city search, geolocation, or manual fallback.
 */
export interface LocationData {
  id: string;
  name: string;
  admin1?: string;
  country: string;
  latitude: number;
  longitude: number;
  source: 'search' | 'geolocation' | 'manual';
}

/**
 * Live or manually entered air quality measurements.
 */
export interface AirQualityReading {
  usAqi: number;
  pm25: number | null;
  pm10: number | null;
  no2: number | null;
  o3: number | null;
  timestamp: string;
  source: string;
  isManual: boolean;
  category: AqiCategoryInfo;
}

/**
 * Vulnerable household member groups.
 */
export type HouseholdGroup = 'children' | 'elderly' | 'respiratory' | 'pregnant';

/**
 * Primary daily commute modes.
 */
export type CommuteMode = 'walk' | 'bike' | 'bus' | 'metro' | 'two_wheeler' | 'car';

/**
 * Daily work arrangement.
 */
export type WorkStyle = 'wfh' | 'office' | 'outdoor';

/**
 * Residence structure type.
 */
export type HomeType = 'apartment' | 'house';

/**
 * Primary household cooking fuel.
 */
export type CookingFuel = 'lpg' | 'induction' | 'wood' | 'other';

/**
 * Household budget tier for sustainable alternatives.
 */
export type BudgetLevel = 'low' | 'medium' | 'high';

/**
 * Complete user lifestyle profile for plan personalization.
 */
export interface LifestyleProfile {
  household: HouseholdGroup[];
  commuteMode: CommuteMode;
  workStyle: WorkStyle;
  homeType: HomeType;
  hasAirPurifier: boolean;
  cookingFuel: CookingFuel;
  budget: BudgetLevel;
  notes: string;
}

/**
 * Individual actionable recommendation with direct impact explanation.
 */
export interface RecommendationItem {
  title: string;
  detail: string;
  whyItHelps: string;
  estimatedImpact: string;
  timeWindow?: string;
}

/**
 * Structured four-section personalized air quality action plan.
 */
export interface ActionPlan {
  summary: string;
  bestTimeWindow: string;
  worstTimeWindow: string;
  dailyRoutine: RecommendationItem[];
  indoorAirHacks: RecommendationItem[];
  sustainableAlternatives: RecommendationItem[];
  healthProtection: RecommendationItem[];
  generatedAt: string;
  isFallback: boolean;
  generatedForLocationId?: string;
  generatedForLocationName?: string;
  generatedForAqi?: number;
  generatedForCategoryKey?: AqiCategoryKey;
  generatedForLanguage?: Language;
  generatedForProfile?: LifestyleProfile;
  modelUsed?: string;
}

/**
 * Classified API error categories returned to clients without leaking raw errors or secrets.
 */
export type ApiErrorCategory =
  | 'missing_key'
  | 'invalid_key'
  | 'quota_exceeded'
  | 'model_unavailable'
  | 'timeout'
  | 'bad_request'
  | 'upstream_error';

/**
 * Tab identifiers for the four-section action plan UI.
 */
export type PlanSectionKey =
  'dailyRoutine' | 'indoorAirHacks' | 'sustainableAlternatives' | 'healthProtection';

/**
 * Chat message exchanged with the SafeAir Saathi assistant.
 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  isError?: boolean;
  isTruncated?: boolean;
}

/**
 * Interactive impact calculator action identifiers.
 */
export type ImpactChoiceId =
  | 'metro_over_car'
  | 'n95_mask'
  | 'induction_over_wood'
  | 'no_waste_burning'
  | 'hepa_seal_windows'
  | 'cycle_short_trips';

/**
 * Definition of an action in the weekly impact calculator.
 */
export interface ImpactChoiceDefinition {
  id: ImpactChoiceId;
  labelEn: string;
  labelHi: string;
  descriptionEn: string;
  descriptionHi: string;
  approxCo2SavedGramsPerWeek: number;
  approxPm25ReductionFraction: number;
}

/**
 * Computed weekly impact estimate across selected choices.
 */
export interface ImpactEstimate {
  approxCo2SavedGramsPerWeek: number;
  approxPm25ReductionPercent: number;
  selectedChoices: ImpactChoiceId[];
}

/**
 * Rate limiter check result.
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}
