import { HarmBlockThreshold, HarmCategory, Type, type Schema } from '@google/genai';
import { z } from 'zod';
import {
  CATEGORY_CONTEXT_MAX_CHARS,
  CATEGORY_LABEL_MAX_CHARS,
  CHAT_HISTORY_ROLE_MULTIPLIER,
  CHAT_MESSAGE_CONTENT_MAX_CHARS,
  HEX_COLOR_MAX_CHARS,
  LATITUDE_BOUND,
  LOCATION_CONTEXT_MAX_CHARS,
  LOCATION_FIELD_MAX_CHARS,
  LONGITUDE_BOUND,
  MAX_CHAT_HISTORY_MESSAGES,
  MAX_FREE_TEXT_LENGTH,
  MAX_US_AQI,
  PLAN_SUMMARY_CONTEXT_MAX_CHARS,
  POLLUTANT_MAX_UG_M3,
  REPAIR_MALFORMED_MAX_CHARS,
  SOURCE_NAME_MAX_CHARS,
  SUMMARY_TEXT_MAX_CHARS,
  TIMESTAMP_MAX_CHARS,
} from '../constants/index.js';
import { lifestyleProfileSchema } from '../utils/validation.js';

const recommendationItemGeminiSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: 'Short actionable headline.' },
    detail: {
      type: Type.STRING,
      description: 'Specific practical step tailored to the household.',
    },
    whyItHelps: {
      type: Type.STRING,
      description: 'Plain-language reason explaining the mechanism.',
    },
    estimatedImpact: {
      type: Type.STRING,
      description:
        'Approximate PM2.5 reduction or CO2 saved without repeating the word Approximate.',
    },
    timeWindow: { type: Type.STRING, description: 'Optional recommended or avoided time window.' },
  },
  required: ['title', 'detail', 'whyItHelps', 'estimatedImpact'],
};

/** Structured Gemini JSON schema for the 4-section action plan response. */
export const actionPlanResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    bestTimeWindow: { type: Type.STRING },
    worstTimeWindow: { type: Type.STRING },
    dailyRoutine: { type: Type.ARRAY, items: recommendationItemGeminiSchema },
    indoorAirHacks: { type: Type.ARRAY, items: recommendationItemGeminiSchema },
    sustainableAlternatives: { type: Type.ARRAY, items: recommendationItemGeminiSchema },
    healthProtection: { type: Type.ARRAY, items: recommendationItemGeminiSchema },
  },
  required: [
    'summary',
    'bestTimeWindow',
    'worstTimeWindow',
    'dailyRoutine',
    'indoorAirHacks',
    'sustainableAlternatives',
    'healthProtection',
  ],
};

/** Safety filter configuration enforcing medium+ blocking across Gemini calls. */
export const geminiSafetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
];

/** Runtime Zod validation schema for `POST /api/plan` payloads. */
export const planRequestSchema = z.object({
  language: z.enum(['en', 'hi']),
  stream: z.boolean().optional(),
  repairPreviousMalformed: z.string().max(REPAIR_MALFORMED_MAX_CHARS).optional(),
  location: z.object({
    id: z.string().max(LOCATION_FIELD_MAX_CHARS),
    name: z.string().min(1).max(LOCATION_FIELD_MAX_CHARS),
    admin1: z.string().max(LOCATION_FIELD_MAX_CHARS).optional(),
    country: z.string().max(LOCATION_FIELD_MAX_CHARS),
    latitude: z.number().min(-LATITUDE_BOUND).max(LATITUDE_BOUND),
    longitude: z.number().min(-LONGITUDE_BOUND).max(LONGITUDE_BOUND),
    source: z.enum(['search', 'geolocation', 'manual']),
  }),
  airQuality: z.object({
    usAqi: z.number().min(0).max(MAX_US_AQI),
    pm25: z.number().min(0).max(POLLUTANT_MAX_UG_M3).nullable(),
    pm10: z.number().min(0).max(POLLUTANT_MAX_UG_M3).nullable(),
    no2: z.number().min(0).max(POLLUTANT_MAX_UG_M3).nullable(),
    o3: z.number().min(0).max(POLLUTANT_MAX_UG_M3).nullable(),
    timestamp: z.string().max(TIMESTAMP_MAX_CHARS),
    source: z.string().max(SOURCE_NAME_MAX_CHARS),
    isManual: z.boolean(),
    category: z.object({
      key: z.enum(['good', 'moderate', 'sensitive', 'unhealthy', 'very_unhealthy', 'hazardous']),
      labelEn: z.string().max(CATEGORY_LABEL_MAX_CHARS),
      labelHi: z.string().max(CATEGORY_LABEL_MAX_CHARS),
      minAqi: z.number(),
      maxAqi: z.number(),
      accentHex: z.string().max(HEX_COLOR_MAX_CHARS),
      surfaceClass: z.string().max(LOCATION_FIELD_MAX_CHARS),
      textClass: z.string().max(LOCATION_FIELD_MAX_CHARS),
      borderClass: z.string().max(LOCATION_FIELD_MAX_CHARS),
      summaryEn: z.string().max(SUMMARY_TEXT_MAX_CHARS),
      summaryHi: z.string().max(SUMMARY_TEXT_MAX_CHARS),
    }),
  }),
  profile: lifestyleProfileSchema,
});

/** Runtime Zod validation schema for `POST /api/chat` payloads. */
export const chatRequestSchema = z.object({
  language: z.enum(['en', 'hi']),
  stream: z.boolean().optional(),
  message: z.string().min(1).max(MAX_FREE_TEXT_LENGTH),
  history: z
    .array(
      z.object({
        id: z.string().max(TIMESTAMP_MAX_CHARS),
        role: z.enum(['user', 'assistant']),
        content: z.string().max(CHAT_MESSAGE_CONTENT_MAX_CHARS),
        timestamp: z.string().max(TIMESTAMP_MAX_CHARS),
      }),
    )
    .max(MAX_CHAT_HISTORY_MESSAGES * CHAT_HISTORY_ROLE_MULTIPLIER),
  context: z.object({
    locationName: z.string().max(LOCATION_CONTEXT_MAX_CHARS),
    usAqi: z.number().min(0).max(MAX_US_AQI),
    categoryLabel: z.string().max(CATEGORY_CONTEXT_MAX_CHARS),
    planSummary: z.string().max(PLAN_SUMMARY_CONTEXT_MAX_CHARS).optional(),
  }),
});

/** Runtime Zod schema for BigDataCloud reverse geocoding responses. */
export const bigDataCloudResponseSchema = z.object({
  city: z.string().optional().default(''),
  locality: z.string().optional().default(''),
  principalSubdivision: z.string().optional().default(''),
  countryName: z.string().optional().default(''),
});
