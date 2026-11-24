import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_LOCATION, DEFAULT_PROFILE } from '../../src/constants/index.js';
import { useAirQuality } from '../../src/hooks/useAirQuality.js';
import { useDebounce } from '../../src/hooks/useDebounce.js';
import { useGeolocation } from '../../src/hooks/useGeolocation.js';
import { usePlanGenerator } from '../../src/hooks/usePlanGenerator.js';
import { useSpeechSynthesis } from '../../src/hooks/useSpeechSynthesis.js';
import { clearAqiCache } from '../../src/services/airQuality.js';
import { resetGeminiClientState } from '../../src/services/gemini.js';
import { clearReverseGeocodeCache } from '../../src/services/geocoding.js';
import type { LocationData } from '../../src/types/index.js';
import { createManualAirQualityReading } from '../../src/utils/aqi.js';
import {
  loadAnimationsPausedPreference,
  loadLanguagePreference,
  saveAnimationsPausedPreference,
  saveLanguagePreference,
} from '../../src/utils/storage.js';

describe('Language & animation storage helpers', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('defaults to English, persists Hindi, persists animation pause state, and recovers on storage errors', () => {
    expect(loadLanguagePreference()).toBe('en');
    saveLanguagePreference('hi');
    expect(loadLanguagePreference()).toBe('hi');

    expect(loadAnimationsPausedPreference()).toBe(false);
    saveAnimationsPausedPreference(true);
    expect(loadAnimationsPausedPreference()).toBe(true);
    saveAnimationsPausedPreference(false);
    expect(loadAnimationsPausedPreference()).toBe(false);

    const getSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Blocked');
    });
    expect(loadLanguagePreference()).toBe('en');
    expect(loadAnimationsPausedPreference()).toBe(false);
    getSpy.mockRestore();

    const setSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Quota exceeded');
    });
    expect(() => saveLanguagePreference('en')).not.toThrow();
    expect(() => saveAnimationsPausedPreference(true)).not.toThrow();
    setSpy.mockRestore();
  });
});

describe('Custom hooks', () => {
  beforeEach(() => {
    clearAqiCache();
    clearReverseGeocodeCache();
    resetGeminiClientState();
    vi.restoreAllMocks();
  });

  it('debounces values in useDebounce', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ val }) => useDebounce(val, 400), {
      initialProps: { val: 'Del' },
    });
    expect(result.current).toBe('Del');
    rerender({ val: 'Delhi' });
    expect(result.current).toBe('Del');
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(result.current).toBe('Delhi');
    vi.useRealTimers();
  });

  it('handles geolocation success, timeout, unavailable, and permission denial in useGeolocation', async () => {
    const getCurrentPosition = vi.fn<Geolocation['getCurrentPosition']>((success) => {
      success({
        coords: { latitude: 28.61, longitude: 77.2 },
      } as GeolocationPosition);
    });
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition },
    });

    const { result } = renderHook(() => useGeolocation());
    let coords: { latitude: number; longitude: number } | null = null;
    await act(async () => {
      coords = await result.current.requestLocation();
    });
    expect(coords).toEqual({ latitude: 28.61, longitude: 77.2 });

    getCurrentPosition.mockImplementation((_success, error) => {
      error?.({ code: 1, PERMISSION_DENIED: 1, TIMEOUT: 3 } as GeolocationPositionError);
    });
    await act(async () => {
      coords = await result.current.requestLocation();
    });
    expect(coords).toBeNull();
    expect(result.current.error).toContain('permission denied');

    getCurrentPosition.mockImplementation((_success, error) => {
      error?.({ code: 3, PERMISSION_DENIED: 1, TIMEOUT: 3 } as GeolocationPositionError);
    });
    await act(async () => {
      coords = await result.current.requestLocation();
    });
    expect(result.current.error).toContain('timed out');

    getCurrentPosition.mockImplementation((_success, error) => {
      error?.({ code: 2, PERMISSION_DENIED: 1, TIMEOUT: 3 } as GeolocationPositionError);
    });
    await act(async () => {
      coords = await result.current.requestLocation();
    });
    expect(result.current.error).toContain('Unable to determine');

    act(() => result.current.clearError());
    expect(result.current.error).toBeNull();
  });

  it('loads AQI, searches cities, resolves geolocation place names, and falls back to coords cleanly', async () => {
    let reverseShouldResolve = true;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('geocoding-api.open-meteo.com')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              results: [
                {
                  id: 101,
                  name: 'Patna',
                  latitude: 25.59,
                  longitude: 85.13,
                  country: 'India',
                  admin1: 'Bihar',
                },
              ],
            }),
            { status: 200 },
          ),
        );
      }
      if (url.includes('/api/reverse-geocode')) {
        return Promise.resolve(
          new Response(
            JSON.stringify(
              reverseShouldResolve
                ? { resolved: true, name: 'Jaipur', admin1: 'Rajasthan', country: 'India' }
                : { resolved: false, name: null, admin1: '', country: '' },
            ),
            { status: 200 },
          ),
        );
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            current: {
              time: '2026-11-18T12:00',
              us_aqi: 190,
              pm2_5: 110,
              pm10: 165,
              nitrogen_dioxide: 40,
              ozone: 25,
            },
          }),
          { status: 200 },
        ),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result, rerender } = renderHook(
      ({ lang }: { lang: 'en' | 'hi' }) => useAirQuality(lang),
      { initialProps: { lang: 'en' as 'en' | 'hi' } },
    );
    await waitFor(() => expect(result.current.isLoadingAqi).toBe(false));
    expect(result.current.reading?.usAqi).toBe(190);

    act(() => {
      result.current.setSearchQuery('Patna');
    });
    await act(async () => {
      await result.current.submitCitySearch();
    });
    await waitFor(() => expect(result.current.location.name).toBe('Patna'));

    // Switching language to Hindi must NOT overwrite Patna with default New Delhi
    const callsBeforeLangSwitch = fetchMock.mock.calls.length;
    rerender({ lang: 'hi' });
    expect(result.current.location.name).toBe('Patna');
    expect(fetchMock).toHaveBeenCalledTimes(callsBeforeLangSwitch);

    // Browser geolocation with resolved place name replaces coordinates cleanly
    await act(async () => {
      await result.current.loadByCoordinates(26.9124, 75.7873);
    });
    expect(result.current.location.name).toBe('Jaipur');
    expect(result.current.location.admin1).toBe('Rajasthan');
    expect(result.current.location.country).toBe('India');

    // Graceful coordinate fallback if reverse geocoding returns unresolved
    reverseShouldResolve = false;
    await act(async () => {
      await result.current.loadByCoordinates(22.5726, 88.3639);
    });
    expect(result.current.location.name).toContain('22.57');

    act(() => {
      result.current.refreshAqi();
    });
    await waitFor(() => expect(result.current.isLoadingAqi).toBe(false));

    const badManual = result.current.applyManualAqi(999);
    expect(badManual.success).toBe(false);

    let goodManual: { success: boolean; error?: string } = { success: false };
    act(() => {
      goodManual = result.current.applyManualAqi(310);
    });
    expect(goodManual.success).toBe(true);
    expect(result.current.reading?.usAqi).toBe(310);
    expect(result.current.reading?.category.key).toBe('hazardous');
    expect(result.current.reading?.no2).toBeNull();
    expect(result.current.reading?.o3).toBeNull();
  });

  it('produces localized Hindi geolocation error messages when language is hi', async () => {
    const getCurrentPosition = vi.fn<Geolocation['getCurrentPosition']>((_success, error) => {
      error?.({ code: 1, PERMISSION_DENIED: 1, TIMEOUT: 3 } as GeolocationPositionError);
    });
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition },
    });

    const { result } = renderHook(() => useGeolocation('hi'));
    await act(async () => {
      await result.current.requestLocation();
    });
    expect(result.current.error).toContain('लोकेशन अनुमति अस्वीकार');
  });

  it('falls back to rule-based plan with provenance and retries in usePlanGenerator', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ category: 'model_unavailable', error: 'Model unavailable' }),
          { status: 503 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ category: 'quota_exceeded', error: 'Quota exceeded' }), {
          status: 429,
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => usePlanGenerator());
    const reading = createManualAirQualityReading(220);

    await act(async () => {
      await result.current.generatePlan({
        location: DEFAULT_LOCATION,
        airQuality: reading,
        profile: DEFAULT_PROFILE,
        language: 'en',
      });
    });

    expect(result.current.error).toContain('unavailable or not accessible');
    expect(result.current.plan?.isFallback).toBe(true);
    expect(result.current.plan?.generatedForLocationId).toBe(DEFAULT_LOCATION.id);
    expect(result.current.plan?.generatedForAqi).toBe(220);

    await act(async () => {
      await result.current.retryLastPlan();
    });
    expect(result.current.error).toContain('quota or rate limit');
  });

  it('invokes speechSynthesis cleanly in useSpeechSynthesis', () => {
    const speakMock = vi.fn();
    const cancelMock = vi.fn();
    vi.stubGlobal('speechSynthesis', { speak: speakMock, cancel: cancelMock });
    vi.stubGlobal(
      'SpeechSynthesisUtterance',
      class {
        public text: string;
        public lang = 'en-IN';
        public rate = 1;
        constructor(text: string) {
          this.text = text;
        }
      },
    );

    const { result } = renderHook(() => useSpeechSynthesis());
    expect(result.current.isSupported).toBe(true);
    act(() => {
      result.current.speak('Stay indoors today', 'en');
    });
    expect(speakMock).toHaveBeenCalledTimes(1);
    act(() => {
      result.current.stop();
    });
    expect(cancelMock).toHaveBeenCalled();
  });

  it('handles debounced search, selectCity, search/AQI error paths, and live plan streaming success', async () => {
    const validPlanJson = JSON.stringify({
      summary: 'Tailored live plan.',
      bestTimeWindow: '1 PM - 4 PM',
      worstTimeWindow: '6 AM - 9 AM',
      dailyRoutine: [
        {
          title: 'Midday errands',
          detail: 'Go out at noon.',
          whyItHelps: 'Lower smog.',
          estimatedImpact: '20% lower exposure',
        },
      ],
      indoorAirHacks: [
        {
          title: 'Seal windows',
          detail: 'Use draft stoppers.',
          whyItHelps: 'Cuts infiltration.',
          estimatedImpact: '25% cleaner indoor air',
        },
      ],
      sustainableAlternatives: [
        {
          title: 'Metro commute',
          detail: 'Skip solo driving.',
          whyItHelps: 'Reduces PM2.5.',
          estimatedImpact: '11.5 kg CO2 avoided/week',
        },
      ],
      healthProtection: [
        {
          title: 'N95 mask',
          detail: 'Wear sealed N95.',
          whyItHelps: 'Filters PM2.5.',
          estimatedImpact: '30%–40% lower intake',
        },
      ],
    });

    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('geocoding-api.open-meteo.com')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              results: [
                {
                  id: 202,
                  name: 'Kanpur',
                  latitude: 26.45,
                  longitude: 80.33,
                  country: 'India',
                  admin1: 'Uttar Pradesh',
                },
              ],
            }),
            { status: 200 },
          ),
        );
      }
      if (url.includes('/api/plan')) {
        return Promise.resolve(
          new Response(JSON.stringify({ text: validPlanJson, model: 'gemini-3.8-flash' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }
      return Promise.reject(new Error('AQI offline'));
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useAirQuality('en'));
    await waitFor(() => expect(result.current.isLoadingAqi).toBe(false));
    expect(result.current.aqiError).toContain('Live air quality data could not be loaded');

    // Invalid symbol query shows validation error immediately
    act(() => {
      result.current.setSearchQuery('@@@');
    });
    expect(result.current.searchError).toBeTruthy();

    // Short query clears results
    act(() => {
      result.current.setSearchQuery('a');
    });
    expect(result.current.searchResults).toEqual([]);

    // Valid search & debounced selectCity
    act(() => {
      result.current.setSearchQuery('Kanpur');
    });
    await waitFor(() => expect(result.current.searchResults).toHaveLength(1));
    const [kanpur] = result.current.searchResults;
    expect(kanpur).toBeDefined();
    act(() => {
      if (kanpur) {
        result.current.selectCity(kanpur);
      }
    });
    expect(result.current.location.name).toBe('Kanpur');

    // Plan generator live JSON/SSE success
    const { result: planHook } = renderHook(() => usePlanGenerator());
    await act(async () => {
      await planHook.current.generatePlan({
        location: DEFAULT_LOCATION,
        airQuality: createManualAirQualityReading(185),
        profile: DEFAULT_PROFILE,
        language: 'en',
      });
    });
    expect(planHook.current.error).toBeNull();
    expect(planHook.current.plan?.isFallback).toBe(false);
    expect(planHook.current.plan?.summary).toBe('Tailored live plan.');
  });

  it('handles unsupported geolocation, Hindi timeout/unavailable messages, and unsupported/error speech synthesis', async () => {
    const originalGeolocation = Object.getOwnPropertyDescriptor(navigator, 'geolocation');
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: undefined,
    });

    const { result: geoEn } = renderHook(() => useGeolocation('en'));
    let pos: { latitude: number; longitude: number } | null = null;
    await act(async () => {
      pos = await geoEn.current.requestLocation();
    });
    expect(pos).toBeNull();
    expect(geoEn.current.error).toContain('not supported');

    const { result: geoHi } = renderHook(() => useGeolocation('hi'));
    await act(async () => {
      await geoHi.current.requestLocation();
    });
    expect(geoHi.current.error).toContain('समर्थित नहीं');

    const hiGetCurrentPosition = vi.fn<Geolocation['getCurrentPosition']>((_success, error) => {
      error?.({ code: 3, PERMISSION_DENIED: 1, TIMEOUT: 3 } as GeolocationPositionError);
    });
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition: hiGetCurrentPosition },
    });
    await act(async () => {
      await geoHi.current.requestLocation();
    });
    expect(geoHi.current.error).toContain('समय समाप्त');

    hiGetCurrentPosition.mockImplementation((_success, error) => {
      error?.({ code: 2, PERMISSION_DENIED: 1, TIMEOUT: 3 } as GeolocationPositionError);
    });
    await act(async () => {
      await geoHi.current.requestLocation();
    });
    expect(geoHi.current.error).toContain('स्थान प्राप्त नहीं');

    if (originalGeolocation) {
      Object.defineProperty(navigator, 'geolocation', originalGeolocation);
    }

    // Speech synthesis callbacks & unsupported branch
    const createdUtterances: Array<{
      text: string;
      lang: string;
      onend?: () => void;
      onerror?: () => void;
    }> = [];
    vi.stubGlobal('speechSynthesis', {
      speak: vi.fn(),
      cancel: vi.fn(),
    });
    vi.stubGlobal(
      'SpeechSynthesisUtterance',
      class {
        public text: string;
        public lang = 'en-IN';
        public rate = 1;
        public onend?: () => void;
        public onerror?: () => void;
        constructor(text: string) {
          this.text = text;
          createdUtterances.push(this);
        }
      },
    );

    const { result: speech } = renderHook(() => useSpeechSynthesis());
    act(() => {
      speech.current.speak('   ', 'hi');
    });
    expect(createdUtterances).toHaveLength(0);

    act(() => {
      speech.current.speak('सावधानी रखें', 'hi');
    });
    expect(speech.current.isSpeaking).toBe(true);
    expect(createdUtterances[0]?.lang).toBe('hi-IN');
    act(() => {
      createdUtterances[0]?.onend?.();
    });
    expect(speech.current.isSpeaking).toBe(false);

    act(() => {
      speech.current.speak('Stay safe', 'en');
    });
    expect(speech.current.isSpeaking).toBe(true);
    act(() => {
      createdUtterances[1]?.onerror?.();
    });
    expect(speech.current.isSpeaking).toBe(false);

    // Non-positive debounce delay updates on timer tick
    vi.useFakeTimers();
    const { result: immediateDebounce, rerender: rerenderDebounce } = renderHook(
      ({ val }) => useDebounce(val, 0),
      { initialProps: { val: 'a' } },
    );
    rerenderDebounce({ val: 'b' });
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(immediateDebounce.current).toBe('b');
    vi.useRealTimers();

    vi.unstubAllGlobals();
  });

  it('covers submitCitySearch errors, loadByCoordinates labeled mode, and retryLastPlan guard', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('geocoding-api.open-meteo.com') || url.includes('/api/geocode')) {
        return Promise.reject('non-error-search-failure');
      }
      if (url.includes('/api/plan')) {
        return Promise.reject('non-error-plan-failure');
      }
      if (url.includes('air-quality-api.open-meteo.com')) {
        return Promise.reject('non-error-aqi-failure');
      }
      return Promise.reject('non-error-fallback');
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result: airHi } = renderHook(() => useAirQuality('hi'));
    await waitFor(() => expect(airHi.current.isLoadingAqi).toBe(false));
    expect(airHi.current.aqiError).toContain('वायु गुणवत्ता डेटा');

    // Too-short submitCitySearch sets validation error
    await act(async () => {
      await airHi.current.submitCitySearch();
    });
    expect(airHi.current.searchError).toContain('कम से कम 2 अक्षर');

    // Non-Error rejection in submitCitySearch falls back to localized string
    act(() => {
      airHi.current.setSearchQuery('Agra');
    });
    await act(async () => {
      await airHi.current.submitCitySearch();
    });
    expect(airHi.current.searchError).toContain('शहर खोजे नहीं जा सके');

    // Explicit label skips reverse-geocode call
    const callsBefore = fetchMock.mock.calls.length;
    await act(async () => {
      await airHi.current.loadByCoordinates(27.18, 78.01, 'Tajganj, Agra');
    });
    const newUrls = fetchMock.mock.calls.slice(callsBefore).map((c) => String(c[0]));
    expect(newUrls.some((u) => u.includes('/api/reverse-geocode'))).toBe(false);
    expect(airHi.current.location.name).toBe('Tajganj, Agra');

    // usePlanGenerator: retryLastPlan before any call is a safe no-op, non-Error rejection uses fallback copy
    const { result: planHi } = renderHook(() => usePlanGenerator());
    await act(async () => {
      await planHi.current.retryLastPlan();
    });
    expect(planHi.current.plan).toBeNull();

    await act(async () => {
      await planHi.current.generatePlan({
        location: DEFAULT_LOCATION,
        airQuality: createManualAirQualityReading(180),
        profile: DEFAULT_PROFILE,
        language: 'hi',
      });
    });
    expect(planHi.current.error).toContain('AI योजना तैयार नहीं हो सकी');
    expect(planHi.current.plan?.isFallback).toBe(true);

    vi.unstubAllGlobals();
  });

  it('covers useProfileForm household toggle & validation, useThemeAndMotion media listeners, and helper edge fallbacks', async () => {
    const { useProfileForm } = await import('../../src/hooks/useProfileForm.js');
    const { useThemeAndMotion } = await import('../../src/hooks/useThemeAndMotion.js');
    const { resolveAqiErrorMessage, resolveCitySearchErrorMessage } =
      await import('../../src/hooks/airQualityHelpers.js');
    const { TRANSLATIONS } = await import('../../src/i18n/translations.js');
    const { useFollowUpChat } = await import('../../src/hooks/useFollowUpChat.js');

    expect(resolveAqiErrorMessage('bad', 'en')).toContain('Unable to fetch');
    expect(resolveAqiErrorMessage('bad', 'hi')).toContain('वायु गुणवत्ता डेटा');
    expect(resolveCitySearchErrorMessage('bad', 'en')).toBe('City search failed.');
    expect(resolveCitySearchErrorMessage('bad', 'hi')).toContain('शहर खोज विफल');

    // useProfileForm: toggleHousehold add & remove, invalid submit, valid submit
    const onChange = vi.fn();
    const onSubmit = vi.fn();
    const { result: formHook, rerender: rerenderForm } = renderHook(
      ({ profile }) => useProfileForm({ language: 'en', profile, onChange, onSubmit }),
      { initialProps: { profile: DEFAULT_PROFILE } },
    );

    act(() => {
      formHook.current.toggleHousehold('elderly');
    });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ household: expect.arrayContaining(['elderly']) }),
    );
    rerenderForm({ profile: { ...DEFAULT_PROFILE, household: ['elderly'] } });
    act(() => {
      formHook.current.toggleHousehold('elderly');
    });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ household: [] }));

    rerenderForm({ profile: { ...DEFAULT_PROFILE, notes: 'x'.repeat(505) } });
    act(() => {
      formHook.current.handleSubmit({ preventDefault: vi.fn() } as never);
    });
    expect(formHook.current.errors.notes).toBeTruthy();

    // useThemeAndMotion: matchMedia listeners, theme toggle, language toggle
    let reducedListener: ((e: MediaQueryListEvent) => void) | undefined;
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: query.includes('dark'),
        media: query,
        addEventListener: (_evt: string, cb: (e: MediaQueryListEvent) => void) => {
          if (query.includes('reduce')) {
            reducedListener = cb;
          }
        },
        removeEventListener: vi.fn(),
      })),
    );
    window.localStorage.clear();
    document.documentElement.lang = 'en';
    const { result: themeHook } = renderHook(() => useThemeAndMotion());
    expect(themeHook.current.isDark).toBe(true);
    act(() => {
      reducedListener?.({ matches: true } as MediaQueryListEvent);
    });
    expect(themeHook.current.effectiveAnimationsPaused).toBe(true);
    act(() => {
      themeHook.current.toggleTheme();
      themeHook.current.toggleLanguage();
      themeHook.current.toggleAnimations();
    });
    expect(themeHook.current.isDark).toBe(false);
    expect(document.documentElement.lang).toBe('hi');

    // useFollowUpChat: empty stream -> incomplete error, submit failure -> error message, continue failure
    const encoder = new TextEncoder();
    const emptyStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk: '   ' })}\n\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
        controller.close();
      },
    });
    const truncatedStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ chunk: 'Partial reply' })}\n\n`),
        );
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ done: true, truncated: true })}\n\n`),
        );
        controller.close();
      },
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(emptyStream, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        }),
      )
      .mockRejectedValueOnce('non-error-chat')
      .mockResolvedValueOnce(
        new Response(truncatedStream, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        }),
      )
      .mockRejectedValueOnce(new Error('Continue failed'));
    vi.stubGlobal('fetch', fetchMock);

    const { result: chatHook } = renderHook(() =>
      useFollowUpChat({
        t: TRANSLATIONS.en,
        language: 'en',
        location: DEFAULT_LOCATION,
        reading: null,
        plan: null,
      }),
    );

    act(() => chatHook.current.setInput('First empty test'));
    await act(async () => {
      await chatHook.current.handleSubmit({ preventDefault: vi.fn() } as never);
    });
    expect(chatHook.current.messages.at(-1)?.content).toBe(TRANSLATIONS.en.chatIncompleteError);

    act(() => chatHook.current.setInput('Second failure test'));
    await act(async () => {
      await chatHook.current.handleSubmit({ preventDefault: vi.fn() } as never);
    });
    expect(chatHook.current.messages.at(-1)?.content).toBe(TRANSLATIONS.en.chatUnavailableError);

    act(() => chatHook.current.setInput('Third truncated test'));
    await act(async () => {
      await chatHook.current.handleSubmit({ preventDefault: vi.fn() } as never);
    });
    const truncId = chatHook.current.messages.at(-1)?.id ?? '';
    await act(async () => {
      await chatHook.current.handleContinueMessage(truncId);
    });
    await act(async () => {
      await chatHook.current.handleContinueMessage('non-existent-id');
    });
    expect(chatHook.current.messages.at(-1)?.content).toBe('Continue failed');

    // Empty chat submit triggers validation error without hitting fetch
    await act(async () => {
      chatHook.current.setInput('   ');
    });
    await act(async () => {
      await chatHook.current.handleSubmit({ preventDefault: vi.fn() } as never);
    });
    expect(chatHook.current.inputError).toBeTruthy();

    // citySearchHelpers: debounced search failure + submit cached first city
    const { dispatchCitySubmit, runDebouncedSearch } =
      await import('../../src/hooks/citySearchHelpers.js');
    const setResults = vi.fn();
    const setHasSearched = vi.fn();
    const setError = vi.fn();
    const setIsSearching = vi.fn();
    const onSelectCity = vi.fn();
    const submitAbortRef = { current: null as AbortController | null };

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Geocode unavailable')));
    await runDebouncedSearch('Mumbai', 'en', new AbortController().signal, {
      setResults,
      setHasSearched,
      setError,
      setIsSearching,
    });
    expect(setResults).toHaveBeenCalledWith([]);
    expect(setHasSearched).toHaveBeenCalledWith(true);
    expect(setError).toHaveBeenCalled();
    expect(setIsSearching).toHaveBeenCalledWith(false);

    await dispatchCitySubmit(
      {
        searchQuery: 'Mumbai',
        searchResults: [DEFAULT_LOCATION],
        language: 'en',
        submitAbortRef,
      },
      { setResults, setHasSearched, setError, setIsSearching, onSelectCity },
    );
    expect(onSelectCity).toHaveBeenCalledWith(DEFAULT_LOCATION);

    // Abort branches in usePlanGenerator, followUpChatHelpers, and executeCoordinateLoad reverseGeocode catch
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError')));
    const { result: abortedPlan } = renderHook(() => usePlanGenerator());
    await act(async () => {
      await abortedPlan.current.generatePlan({
        location: DEFAULT_LOCATION,
        airQuality: createManualAirQualityReading(180),
        profile: DEFAULT_PROFILE,
        language: 'en',
      });
    });
    expect(abortedPlan.current.error).toBeNull();

    const { executeContinueTruncatedReply, executeSubmittedQuestion } =
      await import('../../src/hooks/followUpChatHelpers.js');
    const chatAbort = new AbortController();
    chatAbort.abort();
    const setMessagesMock = vi.fn();
    const setStreamingMock = vi.fn();
    await executeSubmittedQuestion('Mask?', 'a-1', [], {
      t: TRANSLATIONS.en,
      language: 'en',
      context: { locationName: 'Delhi', usAqi: 180, categoryLabel: 'Unhealthy' },
      signal: chatAbort.signal,
      setMessages: setMessagesMock,
      setIsStreaming: setStreamingMock,
      nextErrorId: () => 'err-1',
    });
    await executeContinueTruncatedReply('a-1', 'Base', [], {
      t: TRANSLATIONS.en,
      language: 'en',
      context: { locationName: 'Delhi', usAqi: 180, categoryLabel: 'Unhealthy' },
      signal: chatAbort.signal,
      setMessages: setMessagesMock,
      setIsStreaming: setStreamingMock,
      nextErrorId: () => 'err-2',
    });
    expect(setMessagesMock).not.toHaveBeenCalled();

    const { executeCoordinateLoad, useAqiLoader } = await import('../../src/hooks/useAqiLoader.js');
    const setLocSpy = vi.fn();
    await executeCoordinateLoad(
      { latitude: 26.85, longitude: 80.95, language: 'en' },
      {
        setLocation: setLocSpy,
        clearSearchInput: vi.fn(),
        loadAqiForLocation: vi.fn().mockResolvedValue(undefined),
      },
    );
    await executeCoordinateLoad(
      { latitude: 26.85, longitude: 80.95, label: 'Lucknow Center', language: 'en' },
      {
        setLocation: setLocSpy,
        clearSearchInput: vi.fn(),
        loadAqiForLocation: vi.fn().mockResolvedValue(undefined),
      },
    );
    expect(setLocSpy).toHaveBeenCalledTimes(2);

    // citySearchHelpers: invalid short query on submit + empty results network submit
    await dispatchCitySubmit(
      { searchQuery: 'a', searchResults: [], language: 'en', submitAbortRef },
      { setResults, setHasSearched, setError, setIsSearching, onSelectCity },
    );
    expect(setError).toHaveBeenCalled();

    const mumbaiLoc = {
      id: 'city-1',
      name: 'Mumbai',
      country: 'India',
      latitude: 19.076,
      longitude: 72.8777,
      source: 'search' as const,
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            results: [
              {
                id: 1,
                name: 'Mumbai',
                latitude: 19.076,
                longitude: 72.8777,
                country: 'India',
              },
            ],
          }),
          { status: 200 },
        ),
      ),
    );
    await dispatchCitySubmit(
      { searchQuery: 'Mumbai', searchResults: [], language: 'en', submitAbortRef },
      { setResults, setHasSearched, setError, setIsSearching, onSelectCity },
    );
    expect(onSelectCity).toHaveBeenCalledWith(expect.objectContaining({ name: mumbaiLoc.name }));

    // usePlanGenerator: retryLastPlan after successful plan streams chunk updates
    const validPlanJson = JSON.stringify({
      summary: 'Plan summary',
      bestTimeWindow: '1 PM - 4 PM',
      worstTimeWindow: '6 AM - 9 AM',
      dailyRoutine: [
        {
          title: 'Walk',
          detail: 'Midday walk',
          whyItHelps: 'Lower smog',
          estimatedImpact: '20% lower exposure',
        },
      ],
      indoorAirHacks: [
        {
          title: 'HEPA',
          detail: 'Run HEPA',
          whyItHelps: 'Filters PM2.5',
          estimatedImpact: '40% lower indoor PM2.5',
        },
      ],
      sustainableAlternatives: [
        {
          title: 'Metro',
          detail: 'Use metro',
          whyItHelps: 'Less tailpipe',
          estimatedImpact: '10 kg CO2/week',
        },
      ],
      healthProtection: [
        {
          title: 'N95',
          detail: 'Wear N95',
          whyItHelps: 'Blocks PM2.5',
          estimatedImpact: '50% less inhalation',
        },
      ],
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => {
        const encoder2 = new TextEncoder();
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(
              encoder2.encode(`data: ${JSON.stringify({ chunk: validPlanJson })}\n\n`),
            );
            controller.enqueue(encoder2.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
            controller.close();
          },
        });
        return Promise.resolve(
          new Response(stream, {
            status: 200,
            headers: { 'Content-Type': 'text/event-stream' },
          }),
        );
      }),
    );
    await act(async () => {
      await abortedPlan.current.generatePlan({
        location: DEFAULT_LOCATION,
        airQuality: createManualAirQualityReading(180),
        profile: DEFAULT_PROFILE,
        language: 'en',
        bypassCache: true,
      });
    });
    expect(abortedPlan.current.streamCharCount).toBeGreaterThan(0);
    await act(async () => {
      await abortedPlan.current.retryLastPlan();
    });
    expect(abortedPlan.current.plan?.summary).toBe('Plan summary');

    // citySearchHelpers: submit search network error + already-aborted signal
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network down')));
    await dispatchCitySubmit(
      { searchQuery: 'Jaipur', searchResults: [], language: 'en', submitAbortRef },
      { setResults, setHasSearched, setError, setIsSearching, onSelectCity },
    );
    expect(setError).toHaveBeenCalled();

    const preAborted = new AbortController();
    preAborted.abort();
    await runDebouncedSearch('Jaipur', 'en', preAborted.signal, {
      setResults,
      setHasSearched,
      setError,
      setIsSearching,
    });

    // useProfileForm valid submit clears notes error and invokes onSubmit
    rerenderForm({ profile: DEFAULT_PROFILE });
    act(() => {
      formHook.current.handleSubmit({ preventDefault: vi.fn() } as never);
    });
    expect(onSubmit).toHaveBeenCalledWith(DEFAULT_PROFILE);

    // useThemeAndMotion: matchMedia media listener when prefersReducedMotion is false initially
    act(() => {
      reducedListener?.({ matches: false } as MediaQueryListEvent);
    });
    expect(themeHook.current.isDark).toBe(false);

    // useAqiLoader: non-abort error path + reverse-geocode coordinate match/mismatch updater
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('AQI endpoint down')));
    const aqiSetError = vi.fn();
    const { result: aqiLoaderHook } = renderHook(() =>
      useAqiLoader('en', {
        setReading: vi.fn(),
        setError: aqiSetError,
        setLoading: vi.fn(),
      }),
    );
    await act(async () => {
      await aqiLoaderHook.current(DEFAULT_LOCATION, true);
    });
    expect(aqiSetError).toHaveBeenCalled();

    let latestLoc: LocationData = {
      id: 'geo-26.8500-80.9500',
      name: 'Current Location',
      country: '',
      latitude: 26.85,
      longitude: 80.95,
      source: 'geolocation',
    };
    const applyLoc = vi.fn((updater: LocationData | ((prev: LocationData) => LocationData)) => {
      latestLoc = typeof updater === 'function' ? updater(latestLoc) : updater;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            resolved: true,
            name: 'Lucknow',
            admin1: 'Uttar Pradesh',
            country: 'India',
          }),
          { status: 200 },
        ),
      ),
    );
    await executeCoordinateLoad(
      { latitude: 26.85, longitude: 80.95, language: 'en' },
      {
        setLocation: applyLoc as never,
        clearSearchInput: vi.fn(),
        loadAqiForLocation: vi.fn().mockResolvedValue(undefined),
      },
    );
    expect(latestLoc.name).toBe('Lucknow');
    // Verify updater preserves newer location when coordinates no longer match
    const updaterFn = applyLoc.mock.calls.find((call) => typeof call[0] === 'function')?.[0] as
      ((prev: LocationData) => LocationData) | undefined;
    expect(updaterFn?.(DEFAULT_LOCATION)).toEqual(DEFAULT_LOCATION);

    // citySearchHelpers: runDebouncedSearch success, empty submit results, and pre-aborted submit
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            results: [{ id: 2, name: 'Pune', latitude: 18.52, longitude: 73.85, country: 'India' }],
          }),
          { status: 200 },
        ),
      ),
    );
    setResults.mockClear();
    await runDebouncedSearch('Pune', 'en', new AbortController().signal, {
      setResults,
      setHasSearched,
      setError,
      setIsSearching,
    });
    expect(setResults).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ name: 'Pune' })]),
    );

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [] }), { status: 200 })),
    );
    onSelectCity.mockClear();
    await dispatchCitySubmit(
      { searchQuery: 'NoSuchPlace', searchResults: [], language: 'en', submitAbortRef },
      { setResults, setHasSearched, setError, setIsSearching, onSelectCity },
    );
    expect(onSelectCity).not.toHaveBeenCalled();

    // useThemeAndMotion: graceful fallback when window.matchMedia is undefined
    window.localStorage.clear();
    vi.stubGlobal('matchMedia', undefined);
    const { result: noMatchMediaHook } = renderHook(() => useThemeAndMotion());
    expect(noMatchMediaHook.current.isDark).toBe(false);
    expect(noMatchMediaHook.current.effectiveAnimationsPaused).toBe(false);

    vi.unstubAllGlobals();
  });
});
