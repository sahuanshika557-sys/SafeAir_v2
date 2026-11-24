import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../src/App.js';
import { TRANSLATIONS } from '../../src/i18n/translations.js';
import { clearAqiCache } from '../../src/services/airQuality.js';
import { resetGeminiClientState } from '../../src/services/gemini.js';
import { clearReverseGeocodeCache } from '../../src/services/geocoding.js';

function createSseStreamResponse(frames: Array<Record<string, unknown>>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const frame of frames) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(frame)}\n\n`));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

const MUMBAI_PLAN_JSON = JSON.stringify({
  summary: 'Custom Mumbai coastal smog action plan for seniors and metro commuters.',
  bestTimeWindow: '1 PM - 4 PM',
  worstTimeWindow: '6 AM - 9 AM',
  dailyRoutine: [
    {
      title: 'Morning indoor breathing exercises',
      detail: 'Keep outdoor walks after 1 PM when winds disperse smog.',
      whyItHelps: 'Avoids cool morning inversion pollution peaks.',
      estimatedImpact: '20%–30% lower morning PM2.5 exposure',
    },
  ],
  indoorAirHacks: [
    {
      title: 'Run HEPA purifier on medium in bedroom',
      detail: 'Keep windows closed during rush hours and seal door gaps.',
      whyItHelps: 'Captures fine PM2.5 particulates continuously.',
      estimatedImpact: '35%–50% lower indoor PM2.5',
    },
  ],
  sustainableAlternatives: [
    {
      title: 'Choose Metro over solo cab trips',
      detail: 'Combine errands into one midday metro ride.',
      whyItHelps: 'Cuts per-passenger NO2 and tailpipe particulate emissions.',
      estimatedImpact: '11.5 kg CO2 avoided/week',
    },
  ],
  healthProtection: [
    {
      title: 'Fitted N95 respirator for seniors',
      detail: 'Ensure tight nose-bridge fit along arterial roads.',
      whyItHelps: 'Filters >90% of fine airborne PM2.5 when sealed.',
      estimatedImpact: '35%–45% lower PM2.5 inhalation',
    },
  ],
});

describe('End-to-end App flows & Light/Dark Accessibility', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove('dark', 'animations-paused');
    document.documentElement.lang = 'en';
    clearAqiCache();
    clearReverseGeocodeCache();
    resetGeminiClientState();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.documentElement.classList.remove('dark', 'animations-paused');
    document.documentElement.lang = 'en';
  });

  it('completes search -> live AQI -> profile -> streamed plan -> chat Continue -> language & dark mode with zero axe violations', async () => {
    let chatCallCount = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('geocoding-api.open-meteo.com')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              results: [
                {
                  id: 1275339,
                  name: 'Mumbai',
                  latitude: 19.076,
                  longitude: 72.8777,
                  country: 'India',
                  admin1: 'Maharashtra',
                },
              ],
            }),
            { status: 200 },
          ),
        );
      }
      if (url.includes('air-quality-api.open-meteo.com')) {
        const isMumbai = url.includes('19.07');
        return Promise.resolve(
          new Response(
            JSON.stringify({
              current: {
                time: '2026-11-20T11:00',
                us_aqi: isMumbai ? 112 : 185,
                pm2_5: isMumbai ? 40.2 : 108.5,
                pm10: isMumbai ? 75.4 : 168.0,
                nitrogen_dioxide: 24.5,
                ozone: 38.0,
              },
            }),
            { status: 200 },
          ),
        );
      }
      if (url.includes('/api/plan')) {
        return Promise.resolve(
          createSseStreamResponse([
            { chunk: MUMBAI_PLAN_JSON.slice(0, 120) },
            { chunk: MUMBAI_PLAN_JSON.slice(120) },
            { done: true, model: 'gemini-3.5-flash-lite' },
          ]),
        );
      }
      if (url.includes('/api/chat')) {
        chatCallCount += 1;
        if (chatCallCount === 1) {
          return Promise.resolve(
            createSseStreamResponse([
              { chunk: 'Use an **N95 mask** along busy junctions' },
              { done: true, truncated: true, finishReason: 'MAX_TOKENS' },
            ]),
          );
        }
        return Promise.resolve(
          createSseStreamResponse([
            { chunk: ' and seal windows indoors during evening traffic.' },
            { done: true },
          ]),
        );
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });
    vi.stubGlobal('fetch', fetchMock);

    const { container } = render(<App />);

    // 1. Wait for initial New Delhi AQI (185)
    await waitFor(() => {
      expect(screen.getByRole('img', { name: /185 US AQI/i })).toBeInTheDocument();
    });

    // 2. Search and select Mumbai
    const searchInput = screen.getByLabelText(TRANSLATIONS.en.citySearchLabel);
    await userEvent.type(searchInput, 'Mumbai');
    const mumbaiBtn = await screen.findByRole('button', { name: /Mumbai/i }, { timeout: 3000 });
    await userEvent.click(mumbaiBtn);

    await waitFor(() => {
      expect(screen.getByRole('img', { name: /112 US AQI/i })).toBeInTheDocument();
    });

    // 3. Customize profile and submit -> live streamed AI plan renders
    const elderlyCheckbox = screen.getByRole('checkbox', {
      name: TRANSLATIONS.en.householdOptions.elderly,
    });
    await userEvent.click(elderlyCheckbox);
    await userEvent.click(screen.getByRole('button', { name: TRANSLATIONS.en.generatePlanBtn }));

    await waitFor(() => {
      expect(
        screen.getByText('Custom Mumbai coastal smog action plan for seniors and metro commuters.'),
      ).toBeInTheDocument();
    });

    // 4. Ask follow-up question in lazy FollowUpChat -> truncated -> click Continue
    const chatInput = await screen.findByLabelText(TRANSLATIONS.en.chatInputLabel);
    await userEvent.type(chatInput, 'Which mask is safer for walks?');
    await userEvent.click(screen.getByRole('button', { name: TRANSLATIONS.en.chatSendBtn }));

    const continueBtn = await screen.findByRole('button', {
      name: TRANSLATIONS.en.chatShowMoreLabel,
    });
    await userEvent.click(continueBtn);

    await waitFor(() => {
      expect(screen.getByText(/seal windows indoors during evening traffic/)).toBeInTheDocument();
    });

    // 5. Light mode axe audit
    expect(await axe(container)).toHaveNoViolations();

    // 6. Toggle dark mode and verify axe passes in dark theme too
    await userEvent.click(screen.getByRole('button', { name: TRANSLATIONS.en.themeToggleDark }));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(await axe(container)).toHaveNoViolations();

    // 7. Toggle EN -> HI and verify <html lang>, document.title, and localized UI
    await userEvent.click(
      screen.getByRole('button', { name: TRANSLATIONS.en.languageSwitchLabel }),
    );
    await waitFor(() => {
      expect(document.documentElement.lang).toBe('hi');
      expect(document.title).toBe(TRANSLATIONS.hi.pageTitle);
    });
    expect(screen.getByText(TRANSLATIONS.hi.heroTagline)).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  }, 20000);

  it('recovers from /api/plan failure (fallback plan + alert) when user clicks Retry AI Plan', async () => {
    let planAttempt = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('air-quality-api.open-meteo.com')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              current: {
                time: '2026-11-20T11:00',
                us_aqi: 235,
                pm2_5: 145.0,
                pm10: 210.0,
                nitrogen_dioxide: 42.0,
                ozone: 28.0,
              },
            }),
            { status: 200 },
          ),
        );
      }
      if (url.includes('/api/plan')) {
        planAttempt += 1;
        if (planAttempt === 1) {
          return Promise.resolve(
            new Response(JSON.stringify({ category: 'model_unavailable', error: 'Busy' }), {
              status: 503,
              headers: { 'Content-Type': 'application/json' },
            }),
          );
        }
        return Promise.resolve(
          new Response(JSON.stringify({ text: MUMBAI_PLAN_JSON, model: 'gemini-3.5-flash-lite' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);
    await waitFor(() => {
      expect(screen.getByRole('img', { name: /235 US AQI/i })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: TRANSLATIONS.en.generatePlanBtn }));

    const alertBanner = await screen.findByRole('alert');
    expect(alertBanner).toHaveTextContent(/unavailable or not accessible/i);
    expect(screen.getByText(TRANSLATIONS.en.fallbackBannerNotice)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: TRANSLATIONS.en.retryBtn }));

    await waitFor(() => {
      expect(
        screen.getByText('Custom Mumbai coastal smog action plan for seniors and metro commuters.'),
      ).toBeInTheDocument();
    });
    expect(screen.queryByText(TRANSLATIONS.en.fallbackBannerNotice)).toBeNull();
  }, 15000);
});
