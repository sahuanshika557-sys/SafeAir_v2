import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import aqiHandler from '../../api/aqi.js';
import chatHandler from '../../api/chat.js';
import geocodeHandler from '../../api/geocode.js';
import healthHandler from '../../api/health.js';
import planHandler from '../../api/plan.js';
import reverseGeocodeHandler from '../../api/reverse-geocode.js';
import { DEFAULT_LOCATION, DEFAULT_PROFILE } from '../../src/constants/index.js';
import {
  getGeminiModelCandidates,
  getPrimaryGeminiModel,
  resetServerCaches,
  resetServerRateLimiter,
  setServerAiTestOverrides,
  type ServerApiRequest,
  type ServerApiResponse,
} from '../../src/server/apiHandlers.js';
import { createManualAirQualityReading } from '../../src/utils/aqi.js';

function createMockRequest(options: {
  method: string;
  url: string;
  query?: Record<string, string>;
  body?: unknown;
  headers?: Record<string, string | string[]>;
  readableEnded?: boolean;
}): ServerApiRequest {
  const req = new EventEmitter() as ServerApiRequest;
  req.method = options.method;
  req.url = options.url;
  req.query = options.query;
  req.body = options.body;
  req.headers = options.headers ?? {};
  Object.defineProperty(req, 'readableEnded', {
    value: options.readableEnded ?? true,
    configurable: true,
  });
  return req;
}

function createMockResponse(): {
  res: ServerApiResponse;
  headers: Record<string, string>;
  chunks: string[];
  getBody: () => string;
} {
  const headers: Record<string, string> = {};
  const chunks: string[] = [];
  let ended = false;

  const res = {
    statusCode: 200,
    get writableEnded() {
      return ended;
    },
    setHeader(name: string, value: string | number | readonly string[]) {
      headers[name.toLowerCase()] = Array.isArray(value) ? value.join(', ') : String(value);
      return res;
    },
    write(chunk: string | Uint8Array) {
      chunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf-8'));
      return true;
    },
    end(chunk?: string | Uint8Array) {
      if (chunk !== undefined) {
        chunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf-8'));
      }
      ended = true;
      return res;
    },
    flushHeaders: vi.fn(),
  } as unknown as ServerApiResponse;

  return {
    res,
    headers,
    chunks,
    getBody: () => chunks.join(''),
  };
}

const VALID_PLAN_OBJ = {
  summary: 'High smog plan for Delhi.',
  bestTimeWindow: '1 PM - 4 PM',
  worstTimeWindow: '6 AM - 9 AM',
  dailyRoutine: [
    {
      title: 'Morning indoor prep',
      detail: 'Keep kids indoors before 9 AM.',
      whyItHelps: 'Avoids winter inversion trapping.',
      estimatedImpact: '25%–35% lower morning exposure',
    },
  ],
  indoorAirHacks: [
    {
      title: 'Wet mop floors',
      detail: 'Wipe floors with a damp cloth daily.',
      whyItHelps: 'Removes settled PM10 and dust.',
      estimatedImpact: '15%–25% lower dust',
    },
  ],
  sustainableAlternatives: [
    {
      title: 'Metro commute',
      detail: 'Take the Metro instead of solo cars.',
      whyItHelps: 'Reduces tailpipe PM2.5 and NO2.',
      estimatedImpact: '11.5 kg CO2 avoided/week',
    },
  ],
  healthProtection: [
    {
      title: 'Fitted N95 mask',
      detail: 'Wear a properly sealed N95 outdoors.',
      whyItHelps: 'Filters >90% of fine particles when sealed.',
      estimatedImpact: '30%–40% lower daily inhaled PM2.5',
    },
  ],
};

function createAsyncChunksStream(parts: string[], failOnIndex?: { index: number; error: Error }) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const [index, part] of parts.entries()) {
        if (failOnIndex && index === failOnIndex.index) {
          throw failOnIndex.error;
        }
        yield { text: part };
      }
    },
  };
}

describe('Vercel serverless functions & shared server handlers', () => {
  const originalKey = process.env.GEMINI_API_KEY;
  const originalModel = process.env.GEMINI_MODEL;
  const originalFallback = process.env.GEMINI_FALLBACK_MODEL;

  beforeEach(() => {
    resetServerRateLimiter();
    resetServerCaches();
    setServerAiTestOverrides(null);
    vi.restoreAllMocks();
  });

  afterEach(() => {
    setServerAiTestOverrides(null);
    if (originalKey === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = originalKey;
    }
    if (originalModel === undefined) {
      delete process.env.GEMINI_MODEL;
    } else {
      process.env.GEMINI_MODEL = originalModel;
    }
    if (originalFallback === undefined) {
      delete process.env.GEMINI_FALLBACK_MODEL;
    } else {
      process.env.GEMINI_FALLBACK_MODEL = originalFallback;
    }
  });

  it('serves GET /api/health without leaking GEMINI_API_KEY and reads GEMINI_MODEL overrides', async () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_MODEL;

    expect(getPrimaryGeminiModel()).toBe('gemini-3.5-flash-lite');
    expect(getGeminiModelCandidates()).toEqual([
      'gemini-3.5-flash-lite',
      'gemini-3.8-flash',
      'gemini-3.6-flash',
    ]);

    const unconfiguredReq = createMockRequest({ method: 'GET', url: '/api/health' });
    const unconfiguredRes = createMockResponse();
    await healthHandler(unconfiguredReq, unconfiguredRes.res);
    expect(unconfiguredRes.res.statusCode).toBe(200);
    expect(unconfiguredRes.headers['cache-control']).toBe('no-store');
    expect(unconfiguredRes.headers['cross-origin-opener-policy']).toBe('same-origin');
    const healthUnconf = JSON.parse(unconfiguredRes.getBody());
    expect(healthUnconf.ok).toBe(true);
    expect(healthUnconf.keyConfigured).toBe(false);
    expect(healthUnconf.model).toBe('gemini-3.5-flash-lite');
    expect(healthUnconf.fallbackModels).toEqual([
      'gemini-3.5-flash-lite',
      'gemini-3.8-flash',
      'gemini-3.6-flash',
    ]);
    expect(healthUnconf.runtime).toBe('nodejs');

    process.env.GEMINI_API_KEY = 'AIzaSyTestSecretKeyValue123456';
    process.env.GEMINI_MODEL = 'gemini-4-hydrogen';
    expect(getGeminiModelCandidates()).toEqual([
      'gemini-4-hydrogen',
      'gemini-3.5-flash-lite',
      'gemini-3.8-flash',
      'gemini-3.6-flash',
    ]);
    const configuredReq = createMockRequest({ method: 'GET', url: '/api/health' });
    const configuredRes = createMockResponse();
    await healthHandler(configuredReq, configuredRes.res);
    expect(configuredRes.res.statusCode).toBe(200);
    expect(configuredRes.getBody()).not.toContain('AIzaSy');
    const healthConf = JSON.parse(configuredRes.getBody());
    expect(healthConf.keyConfigured).toBe(true);
    expect(healthConf.model).toBe('gemini-4-hydrogen');

    const postHealth = createMockRequest({ method: 'POST', url: '/api/health' });
    const postHealthRes = createMockResponse();
    await healthHandler(postHealth, postHealthRes.res);
    expect(postHealthRes.res.statusCode).toBe(405);

    const optHealth = createMockRequest({ method: 'OPTIONS', url: '/api/health' });
    const optHealthRes = createMockResponse();
    await healthHandler(optHealth, optHealthRes.res);
    expect(optHealthRes.res.statusCode).toBe(204);
  });

  it('enforces GET, validates parameters, and caches /api/geocode, /api/aqi, and /api/reverse-geocode', async () => {
    const postGeoReq = createMockRequest({ method: 'POST', url: '/api/geocode?name=Delhi' });
    const postGeoRes = createMockResponse();
    await geocodeHandler(postGeoReq, postGeoRes.res);
    expect(postGeoRes.res.statusCode).toBe(405);

    const badGeoReq = createMockRequest({
      method: 'GET',
      url: '/api/geocode?name=x',
      query: { name: 'x' },
    });
    const badGeoRes = createMockResponse();
    await geocodeHandler(badGeoReq, badGeoRes.res);
    expect(badGeoRes.res.statusCode).toBe(400);

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ results: [{ id: 1, name: 'Delhi' }] }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ current: { us_aqi: 155 } }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            city: 'Jaipur',
            locality: 'Malviya Nagar',
            principalSubdivision: 'Rajasthan',
            countryName: 'India',
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    const goodGeoReq = createMockRequest({
      method: 'GET',
      url: '/api/geocode?name=Delhi',
      query: { name: 'Delhi' },
    });
    const goodGeoRes = createMockResponse();
    await geocodeHandler(goodGeoReq, goodGeoRes.res);
    expect(goodGeoRes.res.statusCode).toBe(200);
    expect(JSON.parse(goodGeoRes.getBody())).toEqual({ results: [{ id: 1, name: 'Delhi' }] });

    // Cached second geocode call uses server TTL cache (zero extra upstream fetch)
    const cachedGeoRes = createMockResponse();
    await geocodeHandler(goodGeoReq, cachedGeoRes.res);
    expect(cachedGeoRes.res.statusCode).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const badAqiReq = createMockRequest({
      method: 'GET',
      url: '/api/aqi?latitude=999&longitude=77',
      query: { latitude: '999', longitude: '77' },
    });
    const badAqiRes = createMockResponse();
    await aqiHandler(badAqiReq, badAqiRes.res);
    expect(badAqiRes.res.statusCode).toBe(400);

    const goodAqiReq = createMockRequest({
      method: 'GET',
      url: '/api/aqi?latitude=28.6139&longitude=77.2090',
    });
    const goodAqiRes = createMockResponse();
    await aqiHandler(goodAqiReq, goodAqiRes.res);
    expect(goodAqiRes.res.statusCode).toBe(200);
    expect(goodAqiRes.headers['x-content-type-options']).toBe('nosniff');
    expect(goodAqiRes.headers['referrer-policy']).toBe('no-referrer');
    expect(goodAqiRes.headers['cache-control']).toContain('s-maxage=300');
    expect(JSON.parse(goodAqiRes.getBody())).toEqual({ current: { us_aqi: 155 } });

    // Reverse geocode tests
    const badRevReq = createMockRequest({
      method: 'GET',
      url: '/api/reverse-geocode?latitude=abc&longitude=75',
    });
    const badRevRes = createMockResponse();
    await reverseGeocodeHandler(badRevReq, badRevRes.res);
    expect(badRevRes.res.statusCode).toBe(400);

    const goodRevReq = createMockRequest({
      method: 'GET',
      url: '/api/reverse-geocode?latitude=26.9124&longitude=75.7873&language=en',
    });
    const goodRevRes = createMockResponse();
    await reverseGeocodeHandler(goodRevReq, goodRevRes.res);
    expect(goodRevRes.res.statusCode).toBe(200);
    expect(JSON.parse(goodRevRes.getBody())).toEqual({
      resolved: true,
      name: 'Malviya Nagar',
      admin1: 'Rajasthan',
      country: 'India',
    });

    // Cached hit for same reverse-geocode coordinates
    const cachedRevRes = createMockResponse();
    await reverseGeocodeHandler(goodRevReq, cachedRevRes.res);
    expect(cachedRevRes.res.statusCode).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    // Reverse geocode upstream failure degrades gracefully with 200 { resolved: false }
    fetchMock.mockRejectedValueOnce(new Error('Upstream timeout'));
    const failRevReq = createMockRequest({
      method: 'GET',
      url: '/api/reverse-geocode?latitude=19.07&longitude=72.87&language=hi',
    });
    const failRevRes = createMockResponse();
    await reverseGeocodeHandler(failRevReq, failRevRes.res);
    expect(failRevRes.res.statusCode).toBe(200);
    expect(JSON.parse(failRevRes.getBody()).resolved).toBe(false);
  });

  it('validates methods, Content-Type, string/Buffer/stream req.body, oversized payloads, and missing key', async () => {
    delete process.env.GEMINI_API_KEY;

    const getPlanReq = createMockRequest({ method: 'GET', url: '/api/plan' });
    const getPlanRes = createMockResponse();
    await planHandler(getPlanReq, getPlanRes.res);
    expect(getPlanRes.res.statusCode).toBe(405);

    const badMimeReq = createMockRequest({
      method: 'POST',
      url: '/api/plan',
      headers: { 'content-type': 'text/plain' },
      body: '{}',
    });
    const badMimeRes = createMockResponse();
    await planHandler(badMimeReq, badMimeRes.res);
    expect(badMimeRes.res.statusCode).toBe(415);

    const hugeStringReq = createMockRequest({
      method: 'POST',
      url: '/api/plan',
      body: 'x'.repeat(40000),
    });
    const hugeStringRes = createMockResponse();
    await planHandler(hugeStringReq, hugeStringRes.res);
    expect(hugeStringRes.res.statusCode).toBe(413);

    const badPlanReq = createMockRequest({ method: 'POST', url: '/api/plan', body: {} });
    const badPlanRes = createMockResponse();
    await planHandler(badPlanReq, badPlanRes.res);
    expect(badPlanRes.res.statusCode).toBe(400);

    // Vercel-style raw JSON string body (req.body as string) must parse cleanly
    const validPlanPayload = {
      language: 'en',
      location: DEFAULT_LOCATION,
      airQuality: createManualAirQualityReading(180),
      profile: DEFAULT_PROFILE,
    };
    const stringBodyPlanReq = createMockRequest({
      method: 'POST',
      url: '/api/plan',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validPlanPayload),
    });
    const stringBodyPlanRes = createMockResponse();
    await planHandler(stringBodyPlanReq, stringBodyPlanRes.res);
    expect(stringBodyPlanRes.res.statusCode).toBe(503);
    expect(JSON.parse(stringBodyPlanRes.getBody())).toEqual({
      error: expect.stringMatching(/not configured/i),
      category: 'missing_key',
    });

    // Buffer body support for chat handler
    const bufferChatReq = createMockRequest({
      method: 'POST',
      url: '/api/chat',
      body: Buffer.from(
        JSON.stringify({
          language: 'hi',
          message: 'N95 मास्क कब पहनना चाहिए?',
          history: [],
          context: {
            locationName: 'New Delhi',
            usAqi: 180,
            categoryLabel: 'अस्वस्थ',
          },
        }),
        'utf-8',
      ),
    });
    const bufferChatRes = createMockResponse();
    await chatHandler(bufferChatReq, bufferChatRes.res);
    expect(bufferChatRes.res.statusCode).toBe(503);
    expect(JSON.parse(bufferChatRes.getBody()).category).toBe('missing_key');

    // Empty chat message after sanitization fails cleanly with 400
    const xssEmptyChatReq = createMockRequest({
      method: 'POST',
      url: '/api/chat',
      body: {
        language: 'en',
        message: '<<<>>>',
        history: [],
        context: { locationName: 'Delhi', usAqi: 180, categoryLabel: 'Unhealthy' },
      },
    });
    const xssEmptyChatRes = createMockResponse();
    await chatHandler(xssEmptyChatReq, xssEmptyChatRes.res);
    expect(xssEmptyChatRes.res.statusCode).toBe(400);
  });

  it('handles Gemini model config, transient 429 retry, 404 model fallback, invalid key, timeout, SSE fallback to JSON, and repair', async () => {
    const validPlanJson = JSON.stringify(VALID_PLAN_OBJ);
    const basePlanBody = {
      language: 'en',
      location: DEFAULT_LOCATION,
      airQuality: createManualAirQualityReading(220),
      profile: DEFAULT_PROFILE,
    };

    // 1. Primary 429 once -> retries and succeeds with SSE on gemini-3.5-flash-lite (thinkingConfig MINIMAL + maxOutputTokens 4096)
    const generateContentStream = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('RESOURCE_EXHAUSTED'), { status: 429 }))
      .mockResolvedValueOnce(
        createAsyncChunksStream([validPlanJson.slice(0, 60), validPlanJson.slice(60)]),
      );
    const generateContent = vi.fn();

    setServerAiTestOverrides({
      aiClient: {
        models: { generateContentStream, generateContent } as never,
      },
      retryDelayBaseMs: 5,
      totalTimeoutMs: 500,
    });

    const sseReq = createMockRequest({
      method: 'POST',
      url: '/api/plan',
      body: JSON.stringify(basePlanBody),
    });
    const sseRes = createMockResponse();
    await planHandler(sseReq, sseRes.res);
    expect(sseRes.res.statusCode).toBe(200);
    expect(sseRes.headers['content-type']).toContain('text/event-stream');
    expect(generateContentStream).toHaveBeenCalledTimes(2);
    expect(generateContentStream.mock.calls[0]?.[0]?.model).toBe('gemini-3.5-flash-lite');
    expect(generateContentStream.mock.calls[0]?.[0]?.config).toMatchObject({
      maxOutputTokens: 4096,
      thinkingConfig: { thinkingLevel: 'MINIMAL' },
    });
    expect(generateContentStream.mock.calls[0]?.[0]?.config).not.toHaveProperty('temperature');
    expect(sseRes.getBody()).toContain('Morning indoor prep');
    expect(sseRes.getBody()).toContain('"done":true');

    // 2. Primary 404 + second 403 permission error -> falls back automatically to gemini-3.6-flash
    generateContentStream.mockReset();
    generateContentStream
      .mockRejectedValueOnce(Object.assign(new Error('Model not found'), { status: 404 }))
      .mockRejectedValueOnce(
        Object.assign(new Error('PERMISSION_DENIED: no access to model'), { status: 403 }),
      )
      .mockResolvedValueOnce(createAsyncChunksStream(['Use fitted ', 'N95 masks.']));

    const chatFallbackReq = createMockRequest({
      method: 'POST',
      url: '/api/chat',
      body: {
        language: 'en',
        message: 'Which mask?',
        history: [],
        context: { locationName: 'Delhi', usAqi: 220, categoryLabel: 'Very Unhealthy' },
      },
    });
    const chatFallbackRes = createMockResponse();
    await chatHandler(chatFallbackReq, chatFallbackRes.res);
    expect(chatFallbackRes.res.statusCode).toBe(200);
    expect(generateContentStream.mock.calls[0]?.[0]?.model).toBe('gemini-3.5-flash-lite');
    expect(generateContentStream.mock.calls[0]?.[0]?.config).toMatchObject({
      maxOutputTokens: 2400,
    });
    expect(generateContentStream.mock.calls[1]?.[0]?.model).toBe('gemini-3.8-flash');
    expect(generateContentStream.mock.calls[2]?.[0]?.model).toBe('gemini-3.6-flash');
    expect(chatFallbackRes.getBody()).toContain('N95 masks.');

    // 3. Invalid key (403) fails fast without retry and returns 502 { category: 'invalid_key' }
    generateContentStream.mockReset();
    generateContent.mockReset();
    generateContentStream.mockRejectedValue(
      Object.assign(new Error('API_KEY_INVALID: bad AIzaSySecret123456'), { status: 403 }),
    );
    const badKeyReq = createMockRequest({
      method: 'POST',
      url: '/api/plan',
      body: basePlanBody,
    });
    const badKeyRes = createMockResponse();
    await planHandler(badKeyReq, badKeyRes.res);
    expect(badKeyRes.res.statusCode).toBe(502);
    expect(generateContentStream).toHaveBeenCalledTimes(1);
    const badKeyBody = JSON.parse(badKeyRes.getBody());
    expect(badKeyBody.category).toBe('invalid_key');
    expect(badKeyRes.getBody()).not.toContain('AIzaSy');

    // 4. Stream fails with non-auth upstream error -> auto-fallback to non-streaming JSON (with 1 repair pass!)
    generateContentStream.mockReset();
    generateContent.mockReset();
    generateContentStream.mockRejectedValue(new Error('Stream buffering error'));
    generateContent
      .mockResolvedValueOnce({ text: '{"summary": "malformed json' })
      .mockResolvedValueOnce({ text: validPlanJson });

    const autoFallbackReq = createMockRequest({
      method: 'POST',
      url: '/api/plan',
      body: basePlanBody,
    });
    const autoFallbackRes = createMockResponse();
    await planHandler(autoFallbackReq, autoFallbackRes.res);
    expect(autoFallbackRes.res.statusCode).toBe(200);
    expect(autoFallbackRes.headers['content-type']).toContain('application/json');
    const jsonFallback = JSON.parse(autoFallbackRes.getBody());
    expect(jsonFallback.nonStreaming).toBe(true);
    expect(jsonFallback.text).toContain('Morning indoor prep');
    expect(generateContent).toHaveBeenCalledTimes(2);

    // 5. Overall timeout returns 504 { category: 'timeout' }
    generateContentStream.mockReset();
    generateContent.mockReset();
    generateContentStream.mockRejectedValue(new DOMException('Timed out', 'AbortError'));
    generateContent.mockRejectedValue(new DOMException('Timed out', 'AbortError'));
    const timeoutReq = createMockRequest({
      method: 'POST',
      url: '/api/chat',
      body: {
        language: 'en',
        message: 'How to seal gaps?',
        history: [],
        context: { locationName: 'Delhi', usAqi: 220, categoryLabel: 'Very Unhealthy' },
      },
    });
    const timeoutRes = createMockResponse();
    await chatHandler(timeoutReq, timeoutRes.res);
    expect(timeoutRes.res.statusCode).toBe(504);
    expect(JSON.parse(timeoutRes.getBody()).category).toBe('timeout');

    // 6. Mid-stream error writes SSE error event with category + errorType safely
    generateContentStream.mockReset();
    generateContentStream.mockResolvedValueOnce(
      createAsyncChunksStream(['part1', 'part2'], {
        index: 1,
        error: Object.assign(new Error('Stream reset'), { name: 'ApiError', status: 503 }),
      }),
    );
    const midStreamReq = createMockRequest({
      method: 'POST',
      url: '/api/chat',
      body: {
        language: 'hi',
        message: 'क्या करें?',
        history: [],
        context: { locationName: 'Delhi', usAqi: 220, categoryLabel: 'बहुत अस्वस्थ' },
      },
    });
    const midStreamRes = createMockResponse();
    await chatHandler(midStreamReq, midStreamRes.res);
    expect(midStreamRes.res.statusCode).toBe(200);
    expect(midStreamRes.getBody()).toContain('"errorType":"ApiError"');
    expect(midStreamRes.getBody()).toContain('"category":"model_unavailable"');
  });

  it('isolates rate limits per client IP and enforces 429 on excess bursts', async () => {
    delete process.env.GEMINI_API_KEY;

    const validChatBody = {
      language: 'en',
      message: 'Should I run a purifier tonight?',
      history: [],
      context: {
        locationName: 'New Delhi',
        usAqi: 210,
        categoryLabel: 'Very Unhealthy',
      },
    };

    for (let i = 0; i < 20; i += 1) {
      const req = createMockRequest({
        method: 'POST',
        url: '/api/chat',
        body: validChatBody,
        headers: { 'x-forwarded-for': '198.51.100.10' },
      });
      const res = createMockResponse();
      await chatHandler(req, res.res);
      expect(res.res.statusCode).toBe(503);
    }

    const blockedReq = createMockRequest({
      method: 'POST',
      url: '/api/chat',
      body: validChatBody,
      headers: { 'x-forwarded-for': '198.51.100.10' },
    });
    const blockedRes = createMockResponse();
    await chatHandler(blockedReq, blockedRes.res);
    expect(blockedRes.res.statusCode).toBe(429);

    // Distinct IP must remain unaffected
    const otherIpReq = createMockRequest({
      method: 'POST',
      url: '/api/chat',
      body: validChatBody,
      headers: { 'x-forwarded-for': '203.0.113.42' },
    });
    const otherIpRes = createMockResponse();
    await chatHandler(otherIpReq, otherIpRes.res);
    expect(otherIpRes.res.statusCode).toBe(503);
  });

  it('covers raw stream body reading, non-streaming /api/chat, Gemini 3/4 config, exhausted retries, repair failure, and Open-Meteo errors', async () => {
    const validPlanJson = JSON.stringify(VALID_PLAN_OBJ);
    const basePlanBody = {
      language: 'en',
      location: DEFAULT_LOCATION,
      airQuality: createManualAirQualityReading(195),
      profile: DEFAULT_PROFILE,
    };

    // 1. Raw Node IncomingMessage stream body (body=undefined, readableEnded=false)
    const generateContentStream = vi
      .fn()
      .mockResolvedValueOnce(createAsyncChunksStream([validPlanJson]));
    const generateContent = vi.fn().mockResolvedValueOnce({ text: 'Run HEPA purifier tonight.' });
    process.env.GEMINI_MODEL = 'gemini-3-flash';

    setServerAiTestOverrides({
      aiClient: { models: { generateContentStream, generateContent } as never },
      retryDelayBaseMs: 2,
      totalTimeoutMs: 500,
    });

    const streamBodyReq = createMockRequest({
      method: 'POST',
      url: '/api/plan',
      readableEnded: false,
      query: undefined,
      headers: { 'x-forwarded-for': '198.51.100.88' },
    });
    const streamBodyRes = createMockResponse();
    const pendingPlan = planHandler(streamBodyReq, streamBodyRes.res);
    streamBodyReq.emit('data', Buffer.from(JSON.stringify(basePlanBody).slice(0, 40), 'utf-8'));
    streamBodyReq.emit('data', JSON.stringify(basePlanBody).slice(40));
    streamBodyReq.emit('end');
    await pendingPlan;

    expect(streamBodyRes.res.statusCode).toBe(200);
    expect(generateContentStream.mock.calls[0]?.[0]?.config).toHaveProperty('thinkingConfig');

    // 2. Non-streaming chat via Accept: application/json
    delete process.env.GEMINI_MODEL;
    const jsonChatReq = createMockRequest({
      method: 'POST',
      url: '/api/chat',
      headers: { accept: 'application/json' },
      body: {
        language: 'en',
        message: 'Should I run HEPA?',
        history: [],
        context: { locationName: 'Delhi', usAqi: 195, categoryLabel: 'Unhealthy' },
      },
    });
    const jsonChatRes = createMockResponse();
    await chatHandler(jsonChatReq, jsonChatRes.res);
    expect(jsonChatRes.res.statusCode).toBe(200);
    expect(JSON.parse(jsonChatRes.getBody())).toEqual({
      text: 'Run HEPA purifier tonight.',
      model: 'gemini-3.5-flash-lite',
      nonStreaming: true,
      truncated: false,
    });

    // 3. Exhausted 429 retries on both stream + fallback models returns 429 quota_exceeded
    generateContentStream.mockRejectedValue(
      Object.assign(new Error('RESOURCE_EXHAUSTED'), { status: 429 }),
    );
    generateContent.mockRejectedValue(
      Object.assign(new Error('RESOURCE_EXHAUSTED'), { status: 429 }),
    );
    const exhaustedReq = createMockRequest({
      method: 'POST',
      url: '/api/plan',
      body: { ...basePlanBody, stream: false },
    });
    const exhaustedRes = createMockResponse();
    await planHandler(exhaustedReq, exhaustedRes.res);
    expect(exhaustedRes.res.statusCode).toBe(429);
    expect(JSON.parse(exhaustedRes.getBody()).category).toBe('quota_exceeded');

    // 4. Plan repair failing after malformed JSON returns 502 upstream_error
    generateContent.mockResolvedValue({ text: 'still-not-valid-json' });
    const repairFailReq = createMockRequest({
      method: 'POST',
      url: '/api/plan',
      body: { ...basePlanBody, stream: false },
    });
    const repairFailRes = createMockResponse();
    await planHandler(repairFailReq, repairFailRes.res);
    expect(repairFailRes.res.statusCode).toBe(502);
    expect(JSON.parse(repairFailRes.getBody()).category).toBe('upstream_error');

    // 5. Open-Meteo /api/geocode & /api/aqi upstream HTTP failure + network error
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('Bad Gateway', { status: 502 }))
      .mockRejectedValueOnce(new Error('DNS timeout'));
    vi.stubGlobal('fetch', fetchMock);

    const failGeoRes = createMockResponse();
    await geocodeHandler(
      createMockRequest({ method: 'GET', url: '/api/geocode?name=Pune' }),
      failGeoRes.res,
    );
    expect(failGeoRes.res.statusCode).toBe(502);

    const failAqiRes = createMockResponse();
    await aqiHandler(
      createMockRequest({ method: 'GET', url: '/api/aqi?latitude=18.52&longitude=73.85' }),
      failAqiRes.res,
    );
    expect(failAqiRes.res.statusCode).toBe(504);

    // 6. MY_GEMINI_API_KEY placeholder counts as unconfigured
    process.env.GEMINI_API_KEY = 'MY_GEMINI_API_KEY';
    const placeholderHealthRes = createMockResponse();
    await healthHandler(
      createMockRequest({ method: 'GET', url: '/api/health' }),
      placeholderHealthRes.res,
    );
    expect(JSON.parse(placeholderHealthRes.getBody()).keyConfigured).toBe(false);
  });

  it('covers remaining server error, streaming overflow, query/header variants, and reverse-geocode fallback paths', async () => {
    const basePlanBody = {
      language: 'en',
      location: DEFAULT_LOCATION,
      airQuality: createManualAirQualityReading(185),
      profile: DEFAULT_PROFILE,
    };

    // 1. OPTIONS preflight & array query/x-forwarded-for headers
    const optPlanRes = createMockResponse();
    await planHandler(createMockRequest({ method: 'OPTIONS', url: '/api/plan' }), optPlanRes.res);
    expect(optPlanRes.res.statusCode).toBe(204);

    const optChatRes = createMockResponse();
    await chatHandler(createMockRequest({ method: 'OPTIONS', url: '/api/chat' }), optChatRes.res);
    expect(optChatRes.res.statusCode).toBe(204);

    // Query as string[] + Proxy cache miss then upstream 404/invalid schema on reverse-geocode
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response('Not found', { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ city: 12345 }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const arrayQueryGeoRes = createMockResponse();
    await geocodeHandler(
      createMockRequest({
        method: 'GET',
        url: '/api/geocode?name=Delhi',
        query: { name: ['Indore'] as unknown as string },
      }),
      arrayQueryGeoRes.res,
    );
    expect(arrayQueryGeoRes.res.statusCode).toBe(200);

    const revHttpErrRes = createMockResponse();
    await reverseGeocodeHandler(
      createMockRequest({
        method: 'GET',
        url: '/api/reverse-geocode?latitude=15.0&longitude=75.0',
      }),
      revHttpErrRes.res,
    );
    expect(revHttpErrRes.res.statusCode).toBe(200);
    expect(JSON.parse(revHttpErrRes.getBody()).resolved).toBe(false);

    const revBadSchemaRes = createMockResponse();
    await reverseGeocodeHandler(
      createMockRequest({
        method: 'GET',
        url: '/api/reverse-geocode?latitude=16.0&longitude=76.0',
      }),
      revBadSchemaRes.res,
    );
    expect(revBadSchemaRes.res.statusCode).toBe(200);
    expect(JSON.parse(revBadSchemaRes.getBody()).resolved).toBe(false);

    // 2. Buffer oversized (413), oversized object (413), and stream body overflow / invalid JSON
    const hugeBufRes = createMockResponse();
    await chatHandler(
      createMockRequest({
        method: 'POST',
        url: '/api/chat',
        body: Buffer.alloc(40000, 'a'),
      }),
      hugeBufRes.res,
    );
    expect(hugeBufRes.res.statusCode).toBe(413);

    const hugeObjRes = createMockResponse();
    await planHandler(
      createMockRequest({
        method: 'POST',
        url: '/api/plan',
        body: { padding: 'x'.repeat(40000) },
      }),
      hugeObjRes.res,
    );
    expect(hugeObjRes.res.statusCode).toBe(413);

    const streamOverflowReq = createMockRequest({
      method: 'POST',
      url: '/api/chat',
      readableEnded: false,
      headers: { 'x-forwarded-for': ['198.51.100.77, 10.0.0.1'] as unknown as string },
    });
    (streamOverflowReq as unknown as { destroy: () => void }).destroy = vi.fn();
    const streamOverflowRes = createMockResponse();
    const pendingOverflow = chatHandler(streamOverflowReq, streamOverflowRes.res);
    streamOverflowReq.emit('data', Buffer.alloc(40000, 'b'));
    await pendingOverflow;
    expect(streamOverflowRes.res.statusCode).toBe(413);

    const streamBadJsonReq = createMockRequest({
      method: 'POST',
      url: '/api/chat',
      readableEnded: false,
    });
    const streamBadJsonRes = createMockResponse();
    const pendingBadJson = chatHandler(streamBadJsonReq, streamBadJsonRes.res);
    streamBadJsonReq.emit('data', Buffer.from('{bad json', 'utf-8'));
    streamBadJsonReq.emit('end');
    await pendingBadJson;
    expect(streamBadJsonRes.res.statusCode).toBe(400);

    const badChatMimeRes = createMockResponse();
    await chatHandler(
      createMockRequest({
        method: 'POST',
        url: '/api/chat',
        headers: { 'content-type': 'text/plain' },
        body: '{}',
      }),
      badChatMimeRes.res,
    );
    expect(badChatMimeRes.res.statusCode).toBe(415);

    // 3. Empty stream response falls back to non-streaming JSON + non-streaming invalid_key fails fast
    const generateContentStream = vi
      .fn()
      .mockResolvedValueOnce(createAsyncChunksStream([]))
      .mockResolvedValueOnce(createAsyncChunksStream([]));
    const generateContent = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('API_KEY_INVALID'), { status: 403 }));

    setServerAiTestOverrides({
      aiClient: { models: { generateContentStream, generateContent } as never },
      retryDelayBaseMs: 1,
      totalTimeoutMs: 500,
    });

    const emptyThenKeyFailRes = createMockResponse();
    await planHandler(
      createMockRequest({
        method: 'POST',
        url: '/api/plan',
        headers: { 'x-forwarded-for': '203.0.113.99' },
        body: basePlanBody,
      }),
      emptyThenKeyFailRes.res,
    );
    expect(emptyThenKeyFailRes.res.statusCode).toBe(502);
    expect(JSON.parse(emptyThenKeyFailRes.getBody()).category).toBe('invalid_key');

    // 4. Plan route per-IP rate limiting (429 after 20 requests)
    setServerAiTestOverrides(null);
    delete process.env.GEMINI_API_KEY;
    for (let i = 0; i < 20; i += 1) {
      const r = createMockResponse();
      await planHandler(
        createMockRequest({
          method: 'POST',
          url: '/api/plan',
          headers: { 'x-forwarded-for': '192.0.2.55' },
          body: basePlanBody,
        }),
        r.res,
      );
      expect(r.res.statusCode).toBe(503);
    }
    const planRateBlocked = createMockResponse();
    await planHandler(
      createMockRequest({
        method: 'POST',
        url: '/api/plan',
        headers: { 'x-forwarded-for': '192.0.2.55' },
        body: basePlanBody,
      }),
      planRateBlocked.res,
    );
    expect(planRateBlocked.res.statusCode).toBe(429);
  });

  it('covers socket IP fallback, MAX_TRACKED_IPS eviction, req close abort, clean non-streaming plan, and bad schema 400s', async () => {
    const validPlanJson = JSON.stringify(VALID_PLAN_OBJ);
    const basePlanBody = {
      language: 'en',
      location: DEFAULT_LOCATION,
      airQuality: createManualAirQualityReading(185),
      profile: DEFAULT_PROFILE,
    };

    // 1. req.socket.remoteAddress fallback + MAX_TRACKED_IPS (>500) eviction
    delete process.env.GEMINI_API_KEY;
    for (let i = 0; i < 502; i += 1) {
      const r = createMockResponse();
      const sockReq = createMockRequest({
        method: 'POST',
        url: '/api/chat',
        body: {},
      });
      Object.defineProperty(sockReq, 'socket', {
        value: { remoteAddress: `10.0.${Math.floor(i / 250)}.${i % 250}` },
        configurable: true,
      });
      await chatHandler(sockReq, r.res);
      expect(r.res.statusCode).toBe(400);
    }

    // 2. Clean non-streaming /api/plan returning 200 without needing repair
    const generateContent = vi.fn().mockResolvedValue({ text: validPlanJson });
    const generateContentStream = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('INVALID_ARGUMENT'), { status: 400 }));
    setServerAiTestOverrides({
      aiClient: { models: { generateContentStream, generateContent } as never },
      retryDelayBaseMs: 2,
      totalTimeoutMs: 500,
    });

    const cleanNonStreamRes = createMockResponse();
    await planHandler(
      createMockRequest({
        method: 'POST',
        url: '/api/plan',
        body: { ...basePlanBody, stream: false },
      }),
      cleanNonStreamRes.res,
    );
    expect(cleanNonStreamRes.res.statusCode).toBe(200);
    expect(JSON.parse(cleanNonStreamRes.getBody()).nonStreaming).toBe(true);

    // 3. Stream bad_request (400) does NOT fall back to non-streaming
    const streamBadReqRes = createMockResponse();
    await planHandler(
      createMockRequest({
        method: 'POST',
        url: '/api/plan',
        body: basePlanBody,
      }),
      streamBadReqRes.res,
    );
    expect(streamBadReqRes.res.statusCode).toBe(400);
    expect(JSON.parse(streamBadReqRes.getBody()).category).toBe('bad_request');

    // 4. req.emit('close') during delayed retry aborts cleanly
    generateContentStream.mockReset();
    generateContentStream.mockRejectedValue(
      Object.assign(new Error('RESOURCE_EXHAUSTED'), { status: 429 }),
    );
    setServerAiTestOverrides({
      aiClient: { models: { generateContentStream, generateContent } as never },
      retryDelayBaseMs: 100,
      totalTimeoutMs: 500,
    });
    const abortingReq = createMockRequest({
      method: 'POST',
      url: '/api/plan',
      body: basePlanBody,
    });
    const abortingRes = createMockResponse();
    const pendingAbort = planHandler(abortingReq, abortingRes.res);
    await new Promise((r) => setTimeout(r, 15));
    abortingReq.emit('close');
    await pendingAbort;
    expect(abortingRes.res.statusCode).toBe(504);

    // 5. Real createGeminiClient() path invoked briefly when GEMINI_API_KEY is set without overrides
    setServerAiTestOverrides(null);
    process.env.GEMINI_API_KEY = 'AIzaSyFakeKeyForClientInitCheck';
    // Stub global fetch so GoogleGenAI call fails fast cleanly without real network traffic
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(Object.assign(new Error('API_KEY_INVALID'), { status: 403 })),
    );
    const realClientInitRes = createMockResponse();
    await chatHandler(
      createMockRequest({
        method: 'POST',
        url: '/api/chat',
        body: {
          language: 'en',
          message: 'Quick test?',
          history: [],
          context: { locationName: 'Delhi', usAqi: 185, categoryLabel: 'Unhealthy' },
        },
      }),
      realClientInitRes.res,
    );
    expect(realClientInitRes.res.statusCode).toBe(502);
  });

  it('supports GET /api/health?probe=1 with safe error categories, no secret leaks, and strict rate limiting', async () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_MODEL;

    // 1. Missing key
    const missingKeyProbeRes = createMockResponse();
    await healthHandler(
      createMockRequest({
        method: 'GET',
        url: '/api/health?probe=1',
        headers: { 'x-forwarded-for': '198.51.100.1' },
      }),
      missingKeyProbeRes.res,
    );
    expect(missingKeyProbeRes.res.statusCode).toBe(503);
    expect(JSON.parse(missingKeyProbeRes.getBody())).toEqual({
      ok: false,
      modelTried: 'gemini-3.5-flash-lite',
      status: 503,
      category: 'missing_key',
    });

    // 2. Successful probe
    const generateContent = vi.fn().mockResolvedValueOnce({ text: 'OK' });
    setServerAiTestOverrides({
      aiClient: { models: { generateContent } as never },
      totalTimeoutMs: 500,
    });
    const okProbeRes = createMockResponse();
    await healthHandler(
      createMockRequest({
        method: 'GET',
        url: '/api/health?probe=1',
        headers: { 'x-forwarded-for': '198.51.100.1' },
      }),
      okProbeRes.res,
    );
    expect(okProbeRes.res.statusCode).toBe(200);
    expect(okProbeRes.headers['cache-control']).toBe('no-store');
    expect(JSON.parse(okProbeRes.getBody())).toEqual({
      ok: true,
      modelTried: 'gemini-3.5-flash-lite',
      status: 200,
      category: null,
    });

    // 3. Model unavailable (404) & raw body never leaked
    generateContent.mockRejectedValueOnce(
      Object.assign(new Error('Raw secret AIzaSyLeak123456 not found for model'), { status: 404 }),
    );
    const unavailableRes = createMockResponse();
    await healthHandler(
      createMockRequest({
        method: 'GET',
        url: '/api/health?probe=1',
        headers: { 'x-forwarded-for': '198.51.100.1' },
      }),
      unavailableRes.res,
    );
    expect(unavailableRes.res.statusCode).toBe(503);
    expect(unavailableRes.getBody()).not.toContain('AIzaSyLeak');
    expect(unavailableRes.getBody()).not.toContain('Raw secret');
    expect(JSON.parse(unavailableRes.getBody())).toEqual({
      ok: false,
      modelTried: 'gemini-3.5-flash-lite',
      status: 404,
      category: 'model_unavailable',
    });

    // 4. Invalid key (401)
    generateContent.mockRejectedValueOnce(
      Object.assign(new Error('API_KEY_INVALID'), { status: 401 }),
    );
    const badKeyRes = createMockResponse();
    await healthHandler(
      createMockRequest({
        method: 'GET',
        url: '/api/health?probe=1',
        headers: { 'x-forwarded-for': '198.51.100.1' },
      }),
      badKeyRes.res,
    );
    expect(badKeyRes.res.statusCode).toBe(502);
    expect(JSON.parse(badKeyRes.getBody())).toEqual({
      ok: false,
      modelTried: 'gemini-3.5-flash-lite',
      status: 401,
      category: 'invalid_key',
    });

    // 5. Timeout (AbortError) -> consumes 5th allowed slot for this IP
    generateContent.mockRejectedValueOnce(new DOMException('Timed out', 'AbortError'));
    const timeoutRes = createMockResponse();
    await healthHandler(
      createMockRequest({
        method: 'GET',
        url: '/api/health?probe=1',
        headers: { 'x-forwarded-for': '198.51.100.1' },
      }),
      timeoutRes.res,
    );
    expect(timeoutRes.res.statusCode).toBe(504);
    expect(JSON.parse(timeoutRes.getBody())).toEqual({
      ok: false,
      modelTried: 'gemini-3.5-flash-lite',
      status: 504,
      category: 'timeout',
    });

    // 6. 6th probe from same IP hits rate limit (429 quota_exceeded) without invoking Gemini
    const rateLimitedRes = createMockResponse();
    await healthHandler(
      createMockRequest({
        method: 'GET',
        url: '/api/health?probe=1',
        headers: { 'x-forwarded-for': '198.51.100.1' },
      }),
      rateLimitedRes.res,
    );
    expect(rateLimitedRes.res.statusCode).toBe(429);
    expect(JSON.parse(rateLimitedRes.getBody())).toEqual({
      ok: false,
      modelTried: 'gemini-3.5-flash-lite',
      status: 429,
      category: 'quota_exceeded',
    });
    expect(generateContent).toHaveBeenCalledTimes(4);

    // 7. Distinct IP can probe upstream_error cleanly
    generateContent.mockRejectedValueOnce(new Error('ECONNRESET upstream error'));
    const upstreamRes = createMockResponse();
    await healthHandler(
      createMockRequest({
        method: 'GET',
        url: '/api/health?probe=1',
        headers: { 'x-forwarded-for': '203.0.113.50' },
      }),
      upstreamRes.res,
    );
    expect(upstreamRes.res.statusCode).toBe(502);
    expect(JSON.parse(upstreamRes.getBody())).toEqual({
      ok: false,
      modelTried: 'gemini-3.5-flash-lite',
      status: 502,
      category: 'upstream_error',
    });
  });

  it('tracks MAX_TOKENS truncation and applies server-side scientific accuracy sanitization on plan and chat', async () => {
    const basePlanBody = {
      language: 'en',
      location: DEFAULT_LOCATION,
      airQuality: createManualAirQualityReading(220),
      profile: DEFAULT_PROFILE,
    };

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // 1. Streaming /api/plan containing houseplant & 100% filtration myth -> emits replacementText SSE event
    const mythPlan = {
      ...VALID_PLAN_OBJ,
      indoorAirHacks: [
        {
          title: 'Keep snake plants indoors',
          detail: 'Keep snake plants in bedroom to purify PM2.5.',
          whyItHelps: 'Removes 100% of toxins naturally.',
          estimatedImpact: '15%–25% cleaner indoor air',
        },
      ],
    };
    const mythPlanJson = JSON.stringify(mythPlan);
    const generateContentStream = vi
      .fn()
      .mockResolvedValueOnce(
        createAsyncChunksStream([mythPlanJson.slice(0, 70), mythPlanJson.slice(70)]),
      );
    const generateContent = vi.fn();

    setServerAiTestOverrides({
      aiClient: { models: { generateContentStream, generateContent } as never },
      retryDelayBaseMs: 1,
      totalTimeoutMs: 500,
    });

    const planStreamRes = createMockResponse();
    await planHandler(
      createMockRequest({
        method: 'POST',
        url: '/api/plan',
        headers: { 'x-forwarded-for': '198.51.100.31' },
        body: basePlanBody,
      }),
      planStreamRes.res,
    );
    expect(planStreamRes.res.statusCode).toBe(200);
    expect(planStreamRes.getBody()).toContain('replacementText');
    const replacementMatch = /"replacementText":"((?:[^"\\]|\\.)*)"/.exec(planStreamRes.getBody());
    expect(replacementMatch?.[1]).toBeDefined();
    const replacedJson = JSON.parse(`"${replacementMatch?.[1] ?? ''}"`);
    expect(replacedJson).toContain('box-fan');
    expect(replacedJson).not.toContain('Removes 100% of toxins');

    // 2. Streaming /api/chat with MAX_TOKENS finishReason + scientific myth sanitization
    generateContentStream.mockReset();
    generateContentStream.mockResolvedValueOnce({
      async *[Symbol.asyncIterator]() {
        yield { text: 'Keep a snake plant to purify indoor air and ' };
        yield {
          text: 'block 100% of smoke.',
          candidates: [{ finishReason: 'MAX_TOKENS' }],
        };
      },
    });

    const chatStreamRes = createMockResponse();
    await chatHandler(
      createMockRequest({
        method: 'POST',
        url: '/api/chat',
        headers: { 'x-forwarded-for': '198.51.100.32' },
        body: {
          language: 'en',
          message: 'Do plants clean indoor smog?',
          history: [],
          context: { locationName: 'Delhi', usAqi: 220, categoryLabel: 'Very Unhealthy' },
        },
      }),
      chatStreamRes.res,
    );
    expect(chatStreamRes.res.statusCode).toBe(200);
    const chatSseBody = chatStreamRes.getBody();
    expect(chatSseBody).toContain('"finishReason":"MAX_TOKENS"');
    expect(chatSseBody).toContain('"truncated":true');
    expect(chatSseBody).not.toContain('block 100% of smoke');

    // 3. Non-streaming /api/chat with MAX_TOKENS + Hindi myth sanitization
    generateContent.mockResolvedValueOnce({
      text: 'कमरे में स्नेक प्लांट हवा शुद्ध करते हैं और कपड़े का मास्क PM2.5 रोकता है।',
      candidates: [{ finishReason: 'MAX_TOKENS' }],
    });

    const hiChatRes = createMockResponse();
    await chatHandler(
      createMockRequest({
        method: 'POST',
        url: '/api/chat',
        headers: { 'x-forwarded-for': '198.51.100.33', accept: 'application/json' },
        body: {
          language: 'hi',
          message: 'क्या पौधे हवा साफ करते हैं?',
          history: [],
          context: { locationName: 'नई दिल्ली', usAqi: 220, categoryLabel: 'बहुत अस्वस्थ' },
        },
      }),
      hiChatRes.res,
    );
    expect(hiChatRes.res.statusCode).toBe(200);
    const parsedHiChat = JSON.parse(hiChatRes.getBody());
    expect(parsedHiChat.truncated).toBe(true);
    expect(parsedHiChat.finishReason).toBe('MAX_TOKENS');
    expect(parsedHiChat.text).toContain('HEPA');
    expect(parsedHiChat.text).toContain('N95');

    // 4. Non-streaming /api/plan with scientific myth sanitization
    generateContent.mockResolvedValueOnce({ text: mythPlanJson });
    const nonStreamMythPlanRes = createMockResponse();
    await planHandler(
      createMockRequest({
        method: 'POST',
        url: '/api/plan',
        headers: { 'x-forwarded-for': '198.51.100.34' },
        body: { ...basePlanBody, stream: false },
      }),
      nonStreamMythPlanRes.res,
    );
    expect(nonStreamMythPlanRes.res.statusCode).toBe(200);
    const parsedNonStreamPlan = JSON.parse(nonStreamMythPlanRes.getBody());
    expect(parsedNonStreamPlan.text).toContain('HEPA');
    expect(parsedNonStreamPlan.text).not.toContain('Removes 100% of toxins');

    warnSpy.mockRestore();
  });

  it('enforces strict JSON media-type checking (rejects spoofed text/plain; application/json, allows +json) and settles stream overflow safely', async () => {
    const spoofedCtRes = createMockResponse();
    await planHandler(
      createMockRequest({
        method: 'POST',
        url: '/api/plan',
        headers: {
          'content-type': 'text/plain; application/json',
          'x-real-ip': '203.0.113.77',
        },
        body: { ok: true },
      }),
      spoofedCtRes.res,
    );
    expect(spoofedCtRes.res.statusCode).toBe(415);
    expect(spoofedCtRes.headers['x-permitted-cross-domain-policies']).toBe('none');

    // +json media type (e.g., application/problem+json) passes content-type check
    const problemJsonRes = createMockResponse();
    await chatHandler(
      createMockRequest({
        method: 'POST',
        url: '/api/chat',
        headers: {
          'content-type': 'application/problem+json; charset=utf-8',
          'x-vercel-forwarded-for': '203.0.113.88',
        },
        body: { invalid: true },
      }),
      problemJsonRes.res,
    );
    expect(problemJsonRes.res.statusCode).toBe(400);

    // Stream overflow followed by trailing chunks settles once with 413
    const streamReq = createMockRequest({
      method: 'POST',
      url: '/api/chat',
      headers: {
        'content-type': 'application/json',
        'x-real-ip': '203.0.113.99',
      },
      readableEnded: false,
    });
    streamReq.destroy = vi.fn();
    const streamRes = createMockResponse();
    const pending = chatHandler(streamReq, streamRes.res);
    streamReq.emit('data', Buffer.alloc(20 * 1024, 'a'));
    streamReq.emit('data', Buffer.alloc(20 * 1024, 'b'));
    streamReq.emit('data', Buffer.alloc(1024, 'c'));
    streamReq.emit('end');
    await pending;
    expect(streamRes.res.statusCode).toBe(413);
    expect(streamReq.destroy).toHaveBeenCalledTimes(1);
  });

  it('validates server env variables with Zod and handles unexpected errors in runApiRoute', async () => {
    const { getServerPort, readServerEnv } = await import('../../src/server/env.js');
    const { runApiRoute } = await import('../../src/server/routeHelpers.js');

    expect(
      readServerEnv({ PORT: '8080', APP_URL: 'https://safe-air-v2.vercel.app' }),
    ).toMatchObject({
      PORT: 8080,
      APP_URL: 'https://safe-air-v2.vercel.app',
    });
    expect(() => readServerEnv({ PORT: '70000' })).toThrow(/Invalid server environment/);
    expect(() => readServerEnv({ PORT: 'abc' })).toThrow(/Invalid server environment/);
    expect(() => readServerEnv({ APP_URL: 'not-a-valid-url' })).toThrow(
      /Invalid server environment/,
    );
    expect(() => readServerEnv({ APP_URL: 'mailto:safeair@example.invalid' })).toThrow(
      /Invalid server environment/,
    );
    vi.stubEnv('PORT', '');
    expect(getServerPort()).toBe(3000);
    vi.stubEnv('PORT', '4500');
    expect(getServerPort()).toBe(4500);
    vi.unstubAllEnvs();

    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onError = vi.fn();
    const res = createMockResponse();
    await runApiRoute(
      createMockRequest({ method: 'GET', url: '/api/health' }),
      res.res,
      { allowedMethod: 'GET', routeLabel: '/api/health', onError },
      () => Promise.reject(Object.assign(new Error('ETIMEDOUT upstream stall'), { status: 504 })),
    );
    expect(onError).toHaveBeenCalledWith('timeout', 504);
    errSpy.mockRestore();

    // geminiStream & geminiSseEmitter edge branches
    const {
      generateNonStreamingWithRetry,
      openValidatedStreamWithRetry,
      pumpGeminiStreamToSse,
      tryParseValidPlanJson,
    } = await import('../../src/server/geminiStream.js');
    expect(tryParseValidPlanJson('{"summary":"incomplete"}', 'en')).toBeNull();

    const emptyRespMock = {
      models: {
        generateContent: vi.fn().mockResolvedValue({ text: '   ' }),
        generateContentStream: vi.fn().mockImplementation(async () => ({
          [Symbol.asyncIterator]: () => {
            const chunks = [
              { text: '', candidates: [{ finishReason: 'STOP' }] },
              { text: 'Recovered chunk', candidates: [] },
            ];
            let idx = 0;
            return {
              next: async () =>
                idx < chunks.length
                  ? { value: chunks[idx++], done: false }
                  : { value: undefined, done: true },
            };
          },
        })),
      },
    };
    const abortCtrl = new AbortController();
    await expect(
      generateNonStreamingWithRetry(emptyRespMock as never, {
        routeLabel: '/api/chat',
        contents: 'hi',
        systemInstruction: 'sys',
        signal: abortCtrl.signal,
      }),
    ).rejects.toThrow(/Empty response from Gemini/);

    const firstStream = await openValidatedStreamWithRetry(emptyRespMock as never, {
      routeLabel: '/api/chat',
      contents: 'hi',
      systemInstruction: 'sys',
      signal: abortCtrl.signal,
    });
    expect(firstStream.firstChunk).toBe('Recovered chunk');
    expect(firstStream.firstFinishReason).toBe('STOP');

    // Pump stream exceeding CHAT_STREAM_FORCE_FLUSH_CHARS without punctuation then failing mid-stream
    const longNoPunctuation = 'houseplants do not fix indoor smog '.repeat(8);
    const sseRes = createMockResponse();
    const errSpy2 = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy2 = vi.spyOn(console, 'warn').mockImplementation(() => {});
    let stepCount = 0;
    await pumpGeminiStreamToSse(
      sseRes.res,
      {
        firstChunk: longNoPunctuation,
        model: 'gemini-3.5-flash-lite',
        iterator: {
          next: async () => {
            stepCount += 1;
            if (stepCount === 1) {
              return { value: { text: '' }, done: false };
            }
            if (stepCount === 2) {
              return { value: { text: 'pending tail fragment' }, done: false };
            }
            throw Object.assign(new Error('Stream dropped'), { status: 503 });
          },
        },
      },
      { routeLabel: '/api/chat', contextType: 'chat', language: 'en' },
    );
    expect(sseRes.getBody()).toContain('pending tail fragment');
    expect(sseRes.getBody()).toContain('model_unavailable');
    errSpy2.mockRestore();
    warnSpy2.mockRestore();

    const { readJsonBody, sendJson } = await import('../../src/server/httpBody.js');
    const endedRes = createMockResponse();
    endedRes.res.end();
    sendJson(endedRes.res, 200, { ok: true });
    expect(endedRes.getBody()).toBe('');

    const emptyEndedReq = createMockRequest({
      method: 'POST',
      url: '/api/chat',
      headers: { 'content-type': ['   '] },
    });
    Object.defineProperty(emptyEndedReq, 'readableEnded', { value: true, configurable: true });
    expect(await readJsonBody(emptyEndedReq)).toEqual({});

    // Restrictive CORS: matching Origin + Host echoes exact Origin; untrusted or invalid Origin returns 403
    const sameOriginRes = createMockResponse();
    await healthHandler(
      createMockRequest({
        method: 'GET',
        url: '/api/health',
        headers: {
          origin: 'https://safe-air-v2.vercel.app',
          host: 'safe-air-v2.vercel.app',
        },
      }),
      sameOriginRes.res,
    );
    expect(sameOriginRes.res.statusCode).toBe(200);
    expect(sameOriginRes.headers['access-control-allow-origin']).toBe(
      'https://safe-air-v2.vercel.app',
    );
    expect(sameOriginRes.headers['vary']).toBe('Origin');

    const crossOriginRes = createMockResponse();
    await healthHandler(
      createMockRequest({
        method: 'GET',
        url: '/api/health',
        headers: {
          origin: 'https://evil.example',
          host: 'safe-air-v2.vercel.app',
        },
      }),
      crossOriginRes.res,
    );
    expect(crossOriginRes.res.statusCode).toBe(403);
    expect(crossOriginRes.headers['access-control-allow-origin']).toBeUndefined();

    const invalidOriginRes = createMockResponse();
    await healthHandler(
      createMockRequest({
        method: 'GET',
        url: '/api/health',
        headers: {
          origin: 'not-a-valid-origin',
          host: 'safe-air-v2.vercel.app',
        },
      }),
      invalidOriginRes.res,
    );
    expect(invalidOriginRes.res.statusCode).toBe(403);

    vi.stubEnv('APP_URL', 'https://preview-safeair.example');
    const appUrlRes = createMockResponse();
    await healthHandler(
      createMockRequest({
        method: 'GET',
        url: '/api/health',
        headers: {
          origin: 'https://preview-safeair.example',
          'x-forwarded-host': 'other.host',
        },
      }),
      appUrlRes.res,
    );
    expect(appUrlRes.res.statusCode).toBe(200);
    vi.unstubAllEnvs();
  });
});
