import { describe, expect, it } from 'vitest';
import { DEFAULT_PROFILE, MAX_FREE_TEXT_LENGTH } from '../../src/constants/index.js';
import {
  manualAqiSchema,
  sanitizeTextInput,
  validateChatMessage,
  validateCityQuery,
  validateManualAqi,
  validateProfile,
} from '../../src/utils/validation.js';

describe('Input sanitization and Zod validation', () => {
  it('strips HTML angle brackets, control chars, and delimiter spoofing', () => {
    const raw = '  <script>alert(1)</script> <<<USER_DATA_END>>>\u0007 hello \n world  ';
    const sanitized = sanitizeTextInput(raw);
    expect(sanitized).not.toContain('<');
    expect(sanitized).not.toContain('>');
    expect(sanitized).not.toContain('<<<');
    expect(sanitized).not.toContain('>>>');
    expect(sanitized).toContain('hello world');
  });

  it('truncates sanitized text to max 500 characters', () => {
    const longInput = 'a'.repeat(650);
    expect(sanitizeTextInput(longInput)).toHaveLength(MAX_FREE_TEXT_LENGTH);
  });

  it('validates city search queries and rejects too-short strings', () => {
    expect(validateCityQuery('D').valid).toBe(false);
    expect(validateCityQuery('New Delhi, IN')).toEqual({
      valid: true,
      sanitized: 'New Delhi, IN',
    });
    expect(validateCityQuery('Delhi<script>').sanitized).toBe('Delhiscript');
  });

  it('validates lifestyle profile and rejects notes exceeding 500 characters', () => {
    const validResult = validateProfile({ ...DEFAULT_PROFILE, notes: 'Morning walk at 7am' });
    expect(validResult.success).toBe(true);

    const invalidResult = validateProfile({
      ...DEFAULT_PROFILE,
      notes: 'x'.repeat(MAX_FREE_TEXT_LENGTH + 1),
    });
    expect(invalidResult.success).toBe(false);
    if (!invalidResult.success) {
      expect(invalidResult.errors.notes).toContain('500');
    }
  });

  it('validates chat messages for emptiness and max length', () => {
    expect(validateChatMessage('   ').valid).toBe(false);
    expect(validateChatMessage('x'.repeat(501)).valid).toBe(false);
    expect(validateChatMessage('Should I wear N95 indoors?')).toEqual({
      valid: true,
      sanitized: 'Should I wear N95 indoors?',
    });
  });

  it('validates manual AQI bounds 0-500 and Hindi localized errors across forms', () => {
    expect(manualAqiSchema.safeParse(0).success).toBe(true);
    expect(manualAqiSchema.safeParse(500).success).toBe(true);
    expect(manualAqiSchema.safeParse(-1).success).toBe(false);
    expect(manualAqiSchema.safeParse(501).success).toBe(false);

    expect(validateCityQuery('x', 'hi').error).toContain('कम से कम 2 अक्षर');

    const badAqiEn = validateManualAqi(600, 'en');
    expect(badAqiEn.success).toBe(false);
    const badAqiHi = validateManualAqi(600, 'hi');
    expect(badAqiHi.success).toBe(false);
    if (!badAqiHi.success) {
      expect(badAqiHi.error).toContain('मान्य AQI मान');
    }

    const badChatEmptyHi = validateChatMessage(' ', 'hi');
    expect(badChatEmptyHi.valid).toBe(false);
    expect(badChatEmptyHi.error).toContain('प्रश्न दर्ज');

    const badChatLongHi = validateChatMessage('x'.repeat(MAX_FREE_TEXT_LENGTH + 1), 'hi');
    expect(badChatLongHi.valid).toBe(false);
    expect(badChatLongHi.error).toContain('अधिक नहीं');

    const badNotesHi = validateProfile(
      { ...DEFAULT_PROFILE, notes: 'x'.repeat(MAX_FREE_TEXT_LENGTH + 1) },
      'hi',
    );
    expect(badNotesHi.success).toBe(false);
    if (!badNotesHi.success) {
      expect(badNotesHi.errors.notes).toContain('500');
    }

    const badEnumEn = validateProfile({ ...DEFAULT_PROFILE, budget: 'invalid' as never }, 'en');
    expect(badEnumEn.success).toBe(false);
    if (!badEnumEn.success) {
      expect(badEnumEn.errors.budget).toContain('valid option');
    }

    const badEnumHi = validateProfile({ ...DEFAULT_PROFILE, budget: 'invalid' as never }, 'hi');
    expect(badEnumHi.success).toBe(false);
    if (!badEnumHi.success) {
      expect(badEnumHi.errors.budget).toContain('मान्य विकल्प');
    }
  });
});
