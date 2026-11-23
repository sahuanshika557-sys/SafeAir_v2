import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import App from '../../src/App.js';
import { ActionPlanView } from '../../src/components/ActionPlanView.js';
import { AqiHeroCard } from '../../src/components/AqiHeroCard.js';
import { CleanAirThoughtCard } from '../../src/components/CleanAirThoughtCard.js';
import { ErrorBoundary } from '../../src/components/ErrorBoundary.js';
import { FollowUpChat } from '../../src/components/FollowUpChat.js';
import { Header } from '../../src/components/Header.js';
import { ImpactCalculator } from '../../src/components/ImpactCalculator.js';
import { ProfileForm } from '../../src/components/ProfileForm.js';
import { SafeMarkdown } from '../../src/components/SafeMarkdown.js';
import {
  BreathingLungsIllustration,
  getHeroAtmosphereTheme,
  getLungsColorForCategory,
  HeroSkylineIllustration,
} from '../../src/components/illustrations/index.js';
import {
  ANIMATIONS_PAUSED_STORAGE_KEY,
  DEFAULT_LOCATION,
  DEFAULT_PROFILE,
} from '../../src/constants/index.js';
import { TRANSLATIONS } from '../../src/i18n/translations.js';
import { createManualAirQualityReading } from '../../src/utils/aqi.js';
import { buildRuleBasedFallbackPlan } from '../../src/utils/fallbackPlan.js';

describe('SafeAir Saathi components and accessibility (jest-axe)', () => {
  it('renders Header with skip link, language toggle, and zero axe violations', async () => {
    const onToggle = vi.fn();
    const { container } = render(
      <Header t={TRANSLATIONS.en} language="en" onToggleLanguage={onToggle} />,
    );
    expect(screen.getByText('Skip to main content')).toBeInTheDocument();
    const langBtn = screen.getByRole('button', { name: TRANSLATIONS.en.languageSwitchLabel });
    await userEvent.click(langBtn);
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('renders AqiHeroCard with live pollutants, search submit, manual N/A fallback, and zero axe violations', async () => {
    const liveReading = {
      ...createManualAirQualityReading(185),
      pm25: 108.4,
      pm10: 162.1,
      no2: 27.8,
      o3: 112.0,
      source: 'open-meteo',
      isManual: false,
    };
    const onSelectCity = vi.fn();
    const onSubmitCitySearch = vi.fn();
    const onApplyManual = vi.fn().mockReturnValue({ success: true });
    const onGeolocate = vi.fn();

    const { container, rerender } = render(
      <AqiHeroCard
        t={TRANSLATIONS.en}
        language="en"
        location={DEFAULT_LOCATION}
        reading={liveReading}
        isLoadingAqi={false}
        aqiError={null}
        searchQuery="Lucknow"
        onSearchQueryChange={vi.fn()}
        searchResults={[
          {
            id: 'city-1',
            name: 'Lucknow',
            admin1: 'Uttar Pradesh',
            country: 'India',
            latitude: 26.8467,
            longitude: 80.9462,
            source: 'search',
          },
        ]}
        isSearching={false}
        searchError={null}
        onSelectCity={onSelectCity}
        onSubmitCitySearch={onSubmitCitySearch}
        onRequestGeolocation={onGeolocate}
        isLocating={false}
        geoError={null}
        onApplyManualAqi={onApplyManual}
        onRefreshAqi={vi.fn()}
        animationsPaused={true}
      />,
    );

    expect(screen.getByText('Unhealthy')).toBeInTheDocument();
    expect(screen.getByText('108.4 µg/m³')).toBeInTheDocument();
    expect(screen.getByText('27.8 µg/m³')).toBeInTheDocument();
    expect(screen.getByText('112 µg/m³')).toBeInTheDocument();
    expect(screen.getByText(/Open-Meteo Air Quality API/i)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /185 US AQI/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: TRANSLATIONS.en.citySearchBtn }));
    expect(onSubmitCitySearch).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', { name: /Lucknow/i }));
    expect(onSelectCity).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', { name: /Use My Location/i }));
    expect(onGeolocate).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', { name: /Enter AQI manually/i }));
    await userEvent.click(screen.getByRole('button', { name: /Apply AQI/i }));
    expect(onApplyManual).toHaveBeenCalledWith(185);

    expect(await axe(container)).toHaveNoViolations();

    // Hindi mode with manual fallback shows pure Hindi category & unavailable pollutants (no 0 µg/m³)
    const manualReading = createManualAirQualityReading(185);
    rerender(
      <AqiHeroCard
        t={TRANSLATIONS.hi}
        language="hi"
        location={DEFAULT_LOCATION}
        reading={manualReading}
        isLoadingAqi={false}
        aqiError={null}
        searchQuery=""
        onSearchQueryChange={vi.fn()}
        searchResults={[]}
        isSearching={false}
        searchError={null}
        onSelectCity={onSelectCity}
        onSubmitCitySearch={onSubmitCitySearch}
        onRequestGeolocation={onGeolocate}
        isLocating={false}
        geoError={null}
        onApplyManualAqi={onApplyManual}
        onRefreshAqi={vi.fn()}
        animationsPaused={true}
      />,
    );

    expect(screen.getByText('नई दिल्ली, दिल्ली, भारत')).toBeInTheDocument();
    expect(screen.getByText('अस्वस्थ')).toBeInTheDocument();
    expect(screen.queryByText(/\(Unhealthy\)/)).not.toBeInTheDocument();
    expect(screen.getAllByText('उपलब्ध नहीं')).toHaveLength(4);
    expect(screen.getByText(/मैनुअल AQI प्रविष्टि/)).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('renders ProfileForm, shows validation alert for >500 chars notes, submits valid profile, and passes axe', async () => {
    const onSubmit = vi.fn();
    let currentProfile = { ...DEFAULT_PROFILE };
    const { container, rerender } = render(
      <ProfileForm
        t={TRANSLATIONS.en}
        profile={currentProfile}
        onChange={(next) => {
          currentProfile = next;
        }}
        onSubmit={onSubmit}
        isGenerating={false}
        hasReading={true}
      />,
    );

    const tooLongProfile = { ...DEFAULT_PROFILE, notes: 'a'.repeat(505) };
    rerender(
      <ProfileForm
        t={TRANSLATIONS.en}
        profile={tooLongProfile}
        onChange={vi.fn()}
        onSubmit={onSubmit}
        isGenerating={false}
        hasReading={true}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /Generate Personalized Plan/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/500/);
    expect(document.activeElement).toBe(screen.getByLabelText(TRANSLATIONS.en.notesLabel));
    expect(onSubmit).not.toHaveBeenCalled();

    rerender(
      <ProfileForm
        t={TRANSLATIONS.en}
        profile={DEFAULT_PROFILE}
        onChange={vi.fn()}
        onSubmit={onSubmit}
        isGenerating={false}
        hasReading={true}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Generate Personalized Plan/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);

    expect(await axe(container)).toHaveNoViolations();
  });

  it('renders ActionPlanView summary, deduplicated impact text, error+retry, outdated state, focus move, and passes axe', async () => {
    const reading = createManualAirQualityReading(225);
    const plan = buildRuleBasedFallbackPlan(reading, DEFAULT_PROFILE, 'en', DEFAULT_LOCATION);
    expect(plan.dailyRoutine[0]).toBeDefined();
    if (plan.dailyRoutine[0]) {
      plan.dailyRoutine[0].estimatedImpact = 'Approximate: 25%–40% lower morning intake';
    }
    const onRetry = vi.fn();
    const onRegenerate = vi.fn();

    const { container, rerender } = render(
      <ActionPlanView
        t={TRANSLATIONS.en}
        language="en"
        plan={null}
        isGenerating={true}
        streamCharCount={42}
        error={null}
        onRetry={onRetry}
        currentLocation={DEFAULT_LOCATION}
        currentReading={reading}
        currentProfile={DEFAULT_PROFILE}
        onRegenerateForCurrent={onRegenerate}
      />,
    );

    // Transitioning isGenerating true -> false moves focus onto the plan container
    rerender(
      <ActionPlanView
        t={TRANSLATIONS.en}
        language="en"
        plan={plan}
        isGenerating={false}
        streamCharCount={0}
        error="Temporary AI outage"
        onRetry={onRetry}
        currentLocation={DEFAULT_LOCATION}
        currentReading={reading}
        currentProfile={DEFAULT_PROFILE}
        onRegenerateForCurrent={onRegenerate}
      />,
    );

    expect(screen.getByText(TRANSLATIONS.en.medicalDisclaimerTitle)).toBeInTheDocument();
    expect(screen.getByText(TRANSLATIONS.en.whyFitsTitle)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Temporary AI outage');
    expect(document.activeElement).toHaveAttribute('tabindex', '-1');

    // Impact line must NOT duplicate "Approximate:"
    const impactNode = screen.getByText(/25%–40% lower morning intake/i);
    expect(impactNode.textContent).not.toMatch(/\(approximate\):\s*Approximate:/i);

    await userEvent.click(screen.getByRole('button', { name: /Retry AI Plan/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);

    const indoorTab = screen.getByRole('tab', { name: TRANSLATIONS.en.tabIndoorHacks });
    await userEvent.click(indoorTab);
    expect(indoorTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText(/Time ventilation strictly to midday/i)).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 4 }).length).toBeGreaterThan(0);

    expect(await axe(container)).toHaveNoViolations();

    // Changing location or AQI marks the plan outdated, hides stale summary, and shows Regenerate CTA
    const newLocation = {
      id: 'city-mumbai',
      name: 'Mumbai',
      country: 'India',
      latitude: 19.076,
      longitude: 72.8777,
      source: 'search' as const,
    };
    const newReading = createManualAirQualityReading(92);

    rerender(
      <ActionPlanView
        t={TRANSLATIONS.en}
        language="en"
        plan={plan}
        isGenerating={false}
        streamCharCount={0}
        error={null}
        onRetry={onRetry}
        currentLocation={newLocation}
        currentReading={newReading}
        currentProfile={DEFAULT_PROFILE}
        onRegenerateForCurrent={onRegenerate}
      />,
    );

    const statusBanner = screen.getByRole('status');
    expect(statusBanner).toHaveTextContent(/Mumbai, India \(92 US AQI/i);
    expect(screen.queryByText(plan.summary)).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: TRANSLATIONS.en.regenerateForLocationBtn }),
    );
    expect(onRegenerate).toHaveBeenCalledTimes(1);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('renders ImpactCalculator with conservative ~35% default, How we estimate toggle, and passes axe', async () => {
    const { container } = render(<ImpactCalculator t={TRANSLATIONS.en} language="en" />);
    expect(screen.getByText(/Approx\. 11\.5 kg CO₂/i)).toBeInTheDocument();
    expect(screen.getByText(/^~35%$/)).toBeInTheDocument();

    const howBtn = screen.getByRole('button', { name: TRANSLATIONS.en.impactHowWeEstimateTitle });
    expect(howBtn).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(howBtn);
    expect(howBtn).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/cap total reduction at 65%/i)).toBeInTheDocument();

    const woodCheckbox = screen.getByRole('checkbox', {
      name: /Use Induction \/ Electric or LPG/i,
    });
    await userEvent.click(woodCheckbox);
    await waitFor(() => {
      expect(screen.getByText(/Approx\. 17\.7 kg CO₂/i)).toBeInTheDocument();
    });

    expect(await axe(container)).toHaveNoViolations();
  });

  it('renders FollowUpChat, validates empty submit, and passes axe', async () => {
    const reading = createManualAirQualityReading(180);
    const { container } = render(
      <FollowUpChat
        t={TRANSLATIONS.en}
        language="en"
        location={DEFAULT_LOCATION}
        reading={reading}
        plan={null}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /Send/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/enter a question/i);

    expect(await axe(container)).toHaveNoViolations();
  });

  it('supports keyboard tab navigation and Read Aloud in ActionPlanView', async () => {
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

    const reading = createManualAirQualityReading(195);
    const plan = buildRuleBasedFallbackPlan(reading, DEFAULT_PROFILE, 'en', DEFAULT_LOCATION);

    render(
      <ActionPlanView
        t={TRANSLATIONS.en}
        language="en"
        plan={plan}
        isGenerating={false}
        streamCharCount={0}
        error={null}
        onRetry={vi.fn()}
        currentLocation={DEFAULT_LOCATION}
        currentReading={reading}
      />,
    );

    const routineTab = screen.getByRole('tab', { name: TRANSLATIONS.en.tabDailyRoutine });
    routineTab.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: TRANSLATIONS.en.tabIndoorHacks })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await userEvent.keyboard('{End}');
    expect(screen.getByRole('tab', { name: TRANSLATIONS.en.tabHealthProtection })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await userEvent.keyboard('{Home}');
    expect(routineTab).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: TRANSLATIONS.en.tabHealthProtection })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    await userEvent.click(screen.getByRole('button', { name: TRANSLATIONS.en.readAloudBtn }));
    expect(speakMock).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it('streams FollowUpChat markdown safely without rendering raw HTML tags (XSS guard)', async () => {
    const encoder = new TextEncoder();
    const ssePayload =
      'Wear **N95** outdoors.<script>window.__xss=1</script><img src=x onerror=alert(1)>';
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk: ssePayload })}\n\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
        controller.close();
      },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(
        new Response(stream, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        }),
      ),
    );

    const reading = createManualAirQualityReading(180);
    const { container } = render(
      <FollowUpChat
        t={TRANSLATIONS.en}
        language="en"
        location={DEFAULT_LOCATION}
        reading={reading}
        plan={null}
      />,
    );

    const input = screen.getByLabelText(TRANSLATIONS.en.chatInputLabel);
    await userEvent.type(input, 'Which mask is best?');
    await userEvent.click(screen.getByRole('button', { name: TRANSLATIONS.en.chatSendBtn }));

    await waitFor(() => {
      expect(screen.getByText('N95')).toBeInTheDocument();
    });
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    vi.unstubAllGlobals();
  });

  it('catches child errors in ErrorBoundary and recovers when retry is clicked', async () => {
    const consoleErrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let shouldThrow = true;
    function FlakyPanel() {
      if (shouldThrow) {
        throw new Error('Render crash');
      }
      return <p>Panel recovered</p>;
    }

    render(
      <ErrorBoundary sectionTitle="Air Quality" bodyText="Panel error" retryLabel="Try Again">
        <FlakyPanel />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Panel error');
    shouldThrow = false;
    await userEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    expect(screen.getByText('Panel recovered')).toBeInTheDocument();
    consoleErrSpy.mockRestore();
  });

  it('renders AQI-reactive HeroSkylineIllustration tiers & localized aria-labels, and BreathingLungsIllustration category colors', async () => {
    expect(getHeroAtmosphereTheme('good').tier).toBe('clear');
    expect(getHeroAtmosphereTheme('sensitive').tier).toBe('hazy');
    expect(getHeroAtmosphereTheme('hazardous').tier).toBe('dense');
    expect(getLungsColorForCategory('very_unhealthy')).toBe('#7e22ce');

    const goodReading = createManualAirQualityReading(38);
    const { container, rerender } = render(
      <HeroSkylineIllustration
        t={TRANSLATIONS.en}
        categoryKey={goodReading.category.key}
        locationName="New Delhi"
        categoryLabel={goodReading.category.labelEn}
        animationsPaused={false}
      />,
    );
    const skylineClear = screen.getByRole('img', {
      name: TRANSLATIONS.en.heroIllustrationClearLabel('New Delhi', 'Good'),
    });
    expect(skylineClear).toBeInTheDocument();
    expect(container.firstElementChild).toHaveAttribute('data-atmosphere-tier', 'clear');
    expect(await axe(container)).toHaveNoViolations();

    const severeReading = createManualAirQualityReading(320);
    rerender(
      <HeroSkylineIllustration
        t={TRANSLATIONS.hi}
        categoryKey={severeReading.category.key}
        locationName="नई दिल्ली"
        categoryLabel={severeReading.category.labelHi}
        animationsPaused={false}
      />,
    );
    const skylineDense = screen.getByRole('img', {
      name: TRANSLATIONS.hi.heroIllustrationDenseLabel('नई दिल्ली', 'खतरनाक'),
    });
    expect(skylineDense).toBeInTheDocument();
    expect(container.firstElementChild).toHaveAttribute('data-atmosphere-tier', 'dense');
    expect(await axe(container)).toHaveNoViolations();

    const { container: lungsBox, rerender: rerenderLungs } = render(
      <BreathingLungsIllustration categoryKey="hazardous" animationsPaused={false} />,
    );
    const lungsSvg = lungsBox.querySelector('svg');
    expect(lungsSvg).toHaveAttribute('data-lungs-category', 'hazardous');
    expect(lungsSvg).toHaveAttribute('data-lungs-color', '#881337');
    expect(lungsSvg?.getAttribute('class')).toContain('safeair-lungs-breathe');

    rerenderLungs(<BreathingLungsIllustration categoryKey="good" animationsPaused={true} />);
    expect(lungsBox.querySelector('svg')).toHaveAttribute('data-lungs-category', 'good');
    expect(lungsBox.querySelector('svg')?.getAttribute('class')).not.toContain(
      'safeair-lungs-breathe',
    );
  });

  it('animates AqiGauge from 0 to target value via requestAnimationFrame and snaps when animationsPaused', () => {
    let currentNow = 0;
    let rafIdCounter = 0;
    const queuedCallbacks = new Map<number, FrameRequestCallback>();

    vi.spyOn(performance, 'now').mockImplementation(() => currentNow);
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((cb: FrameRequestCallback) => {
        rafIdCounter += 1;
        queuedCallbacks.set(rafIdCounter, cb);
        return rafIdCounter;
      }),
    );
    vi.stubGlobal(
      'cancelAnimationFrame',
      vi.fn((id: number) => {
        queuedCallbacks.delete(id);
      }),
    );

    const reading = createManualAirQualityReading(240);
    const { rerender } = render(
      <AqiHeroCard
        t={TRANSLATIONS.en}
        language="en"
        location={DEFAULT_LOCATION}
        reading={reading}
        isLoadingAqi={false}
        aqiError={null}
        searchQuery=""
        onSearchQueryChange={vi.fn()}
        searchResults={[]}
        isSearching={false}
        searchError={null}
        onSelectCity={vi.fn()}
        onRequestGeolocation={vi.fn()}
        isLocating={false}
        geoError={null}
        onApplyManualAqi={vi.fn().mockReturnValue({ success: true })}
        onRefreshAqi={vi.fn()}
        animationsPaused={false}
      />,
    );

    const gaugeSvg = screen.getByRole('img', { name: /240 US AQI/i });
    expect(gaugeSvg).toHaveAttribute('data-target-aqi', '240');
    expect(gaugeSvg).toHaveAttribute('data-displayed-aqi', '0');

    // Advance past animation duration (650ms)
    act(() => {
      currentNow = 700;
      const entries = Array.from(queuedCallbacks.values());
      queuedCallbacks.clear();
      entries.forEach((cb) => cb(700));
    });
    expect(gaugeSvg).toHaveAttribute('data-displayed-aqi', '240');

    // When animationsPaused={true}, renders target immediately with zero delay
    rerender(
      <AqiHeroCard
        t={TRANSLATIONS.en}
        language="en"
        location={DEFAULT_LOCATION}
        reading={createManualAirQualityReading(155)}
        isLoadingAqi={false}
        aqiError={null}
        searchQuery=""
        onSearchQueryChange={vi.fn()}
        searchResults={[]}
        isSearching={false}
        searchError={null}
        onSelectCity={vi.fn()}
        onRequestGeolocation={vi.fn()}
        isLocating={false}
        geoError={null}
        onApplyManualAqi={vi.fn().mockReturnValue({ success: true })}
        onRefreshAqi={vi.fn()}
        animationsPaused={true}
      />,
    );
    expect(screen.getByRole('img', { name: /155 US AQI/i })).toHaveAttribute(
      'data-displayed-aqi',
      '155',
    );
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('rotates CleanAirThoughtCard every 10s, omits aria-live, pauses on hover/focus/button, and stays static when global animations paused', async () => {
    expect(TRANSLATIONS.en.cleanAirThoughts).toHaveLength(8);
    expect(TRANSLATIONS.hi.cleanAirThoughts).toHaveLength(8);

    vi.useFakeTimers();
    const { container, rerender } = render(
      <CleanAirThoughtCard t={TRANSLATIONS.en} animationsPaused={false} />,
    );

    const aside = screen.getByRole('complementary', { name: TRANSLATIONS.en.thoughtCardTitle });
    expect(aside).not.toHaveAttribute('aria-live');
    const enThought0 = TRANSLATIONS.en.cleanAirThoughts[0] ?? '';
    const enThought1 = TRANSLATIONS.en.cleanAirThoughts[1] ?? '';
    const enThought2 = TRANSLATIONS.en.cleanAirThoughts[2] ?? '';
    const hiThought0 = TRANSLATIONS.hi.cleanAirThoughts[0] ?? '';
    expect(screen.getByText(new RegExp(enThought0))).toBeInTheDocument();

    // Advances to thought 2 after 10s
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(screen.getByText(new RegExp(enThought1))).toBeInTheDocument();

    // Pauses on mouse enter
    fireEvent.mouseEnter(aside);
    act(() => {
      vi.advanceTimersByTime(20000);
    });
    expect(screen.getByText(new RegExp(enThought1))).toBeInTheDocument();
    fireEvent.mouseLeave(aside);

    // Pauses on focus, resumes on blur outside card
    fireEvent.focus(aside);
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(screen.getByText(new RegExp(enThought1))).toBeInTheDocument();
    fireEvent.blur(aside, { relatedTarget: null });

    // Resumes after blur -> advances to thought 3
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(screen.getByText(new RegExp(enThought2))).toBeInTheDocument();

    // Explicit Pause/Play button toggles rotation
    const pauseBtn = screen.getByRole('button', { name: TRANSLATIONS.en.thoughtPauseBtn });
    fireEvent.click(pauseBtn);
    expect(pauseBtn).toHaveAttribute('aria-pressed', 'true');
    act(() => {
      vi.advanceTimersByTime(15000);
    });
    expect(screen.getByText(new RegExp(enThought2))).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: TRANSLATIONS.en.thoughtPlayBtn }));

    // Global animationsPaused locks onto thought 1 (index 0) and hides rotation button
    rerender(<CleanAirThoughtCard t={TRANSLATIONS.hi} animationsPaused={true} />);
    expect(screen.getByText(new RegExp(hiThought0))).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: TRANSLATIONS.hi.thoughtPauseBtn })).toBeNull();
    vi.useRealTimers();

    expect(await axe(container)).toHaveNoViolations();
  });

  it('shows SafeMarkdown Hindi lists without raw HTML, and handles truncated FollowUpChat with Continue button', async () => {
    const encoder = new TextEncoder();
    const truncatedStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ chunk: '** N95 मास्क:** बाहर जाते समय' })}\n\n`),
        );
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ done: true, truncated: true, finishReason: 'MAX_TOKENS' })}\n\n`,
          ),
        );
        controller.close();
      },
    });
    const continuationStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ chunk: ' नाक पर सील जरूर जाँचें।\n\n- घर में HEPA प्यूरीफायर चलाएँ।' })}\n\n`,
          ),
        );
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
        controller.close();
      },
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(truncatedStream, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(continuationStream, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const reading = createManualAirQualityReading(230);
    const { container } = render(
      <FollowUpChat
        t={TRANSLATIONS.hi}
        language="hi"
        location={DEFAULT_LOCATION}
        reading={reading}
        plan={null}
      />,
    );

    const logRegion = screen.getByRole('log', { name: TRANSLATIONS.hi.chatHistoryLabel });
    expect(logRegion).toHaveAttribute('tabindex', '0');

    const input = screen.getByLabelText(TRANSLATIONS.hi.chatInputLabel);
    await userEvent.click(screen.getByRole('button', { name: TRANSLATIONS.hi.chatSendBtn }));
    expect(document.activeElement).toBe(input);

    await userEvent.type(input, 'मास्क कैसे पहनें?');
    await userEvent.click(screen.getByRole('button', { name: TRANSLATIONS.hi.chatSendBtn }));

    // Normalized "** N95 मास्क:**" renders cleanly as <strong> without stray asterisks, plus Continue CTA
    await waitFor(() => {
      expect(screen.getByText('N95 मास्क:')).toBeInTheDocument();
    });
    expect(screen.getByText(TRANSLATIONS.hi.chatTruncatedNotice)).toBeInTheDocument();
    const continueBtn = screen.getByRole('button', { name: TRANSLATIONS.hi.chatShowMoreLabel });
    expect(continueBtn).toHaveTextContent(TRANSLATIONS.hi.chatContinueBtn);
    expect(await axe(container)).toHaveNoViolations();

    // Clicking Continue sends continuation prompt while keeping user prompt untouched
    await userEvent.click(continueBtn);
    await waitFor(() => {
      expect(screen.getByText(/HEPA प्यूरीफायर चलाएँ/)).toBeInTheDocument();
    });
    expect(screen.queryByText(TRANSLATIONS.hi.chatTruncatedNotice)).toBeNull();
    expect(screen.getByText('मास्क कैसे पहनें?')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();

    // Direct SafeMarkdown unit rendering check
    const { container: mdBox } = render(
      <SafeMarkdown text={'1. **पहला नियम:**\n- *साफ़ हवा* चुनें'} />,
    );
    expect(mdBox.querySelector('ol')).not.toBeNull();
    expect(mdBox.querySelector('ul')).not.toBeNull();
    expect(mdBox.querySelector('strong')).toHaveTextContent('पहला नियम:');
    expect(await axe(mdBox)).toHaveNoViolations();

    vi.unstubAllGlobals();
  });

  it('applies loading-only pulse on ProfileForm submit, renders empty/error plan states, and toggles footer Pause animations in App', async () => {
    // 1. ProfileForm pulse class present ONLY when isGenerating=true
    const { rerender } = render(
      <ProfileForm
        t={TRANSLATIONS.en}
        profile={DEFAULT_PROFILE}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        isGenerating={false}
        hasReading={true}
      />,
    );
    const submitIdle = screen.getByRole('button', { name: /Generate Personalized Plan/i });
    expect(submitIdle.className).not.toContain('safeair-btn-loading-pulse');

    rerender(
      <ProfileForm
        t={TRANSLATIONS.en}
        profile={DEFAULT_PROFILE}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        isGenerating={true}
        hasReading={true}
      />,
    );
    const submitLoading = screen.getByRole('button', { name: TRANSLATIONS.en.generatingPlanBtn });
    expect(submitLoading.className).toContain('safeair-btn-loading-pulse');

    // 2. ActionPlanView empty state & error-only state illustrations pass jest-axe
    const onErrorRetry = vi.fn();
    const { container: emptyPlanBox, rerender: rerenderPlanState } = render(
      <ActionPlanView
        t={TRANSLATIONS.en}
        language="en"
        plan={null}
        isGenerating={false}
        streamCharCount={0}
        error={null}
        onRetry={onErrorRetry}
        currentLocation={DEFAULT_LOCATION}
        currentReading={createManualAirQualityReading(160)}
      />,
    );
    expect(screen.getByText(TRANSLATIONS.en.planEmptyTitle)).toBeInTheDocument();
    expect(await axe(emptyPlanBox)).toHaveNoViolations();

    rerenderPlanState(
      <ActionPlanView
        t={TRANSLATIONS.en}
        language="en"
        plan={null}
        isGenerating={false}
        streamCharCount={0}
        error="AI service temporarily unreachable."
        onRetry={onErrorRetry}
        currentLocation={DEFAULT_LOCATION}
        currentReading={createManualAirQualityReading(160)}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('AI service temporarily unreachable.');
    await userEvent.click(screen.getByRole('button', { name: TRANSLATIONS.en.retryBtn }));
    expect(onErrorRetry).toHaveBeenCalledTimes(1);
    expect(await axe(emptyPlanBox)).toHaveNoViolations();

    // 3. ImpactCalculator renders swap illustrations alongside choices and passes narrow-width layout safety
    const { container: impactBox } = render(<ImpactCalculator t={TRANSLATIONS.hi} language="hi" />);
    expect(impactBox.querySelectorAll('svg').length).toBeGreaterThanOrEqual(6);
    expect(await axe(impactBox)).toHaveNoViolations();

    // 3. App root footer Pause animations toggle & persistence
    window.localStorage.clear();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            current: {
              time: '2026-11-20T10:00',
              us_aqi: 175,
              pm2_5: 90,
              pm10: 140,
              nitrogen_dioxide: 30,
              ozone: 22,
            },
          }),
          { status: 200 },
        ),
      ),
    );

    render(<App />);
    await waitFor(() => expect(screen.getByText(TRANSLATIONS.en.heroTagline)).toBeInTheDocument());

    const animBtn = screen.getByRole('button', { name: TRANSLATIONS.en.animationsPauseBtn });
    expect(animBtn).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(animBtn);

    expect(document.documentElement.classList.contains('animations-paused')).toBe(true);
    expect(window.localStorage.getItem(ANIMATIONS_PAUSED_STORAGE_KEY)).toBe('true');
    expect(
      screen.getByRole('button', { name: TRANSLATIONS.en.animationsResumeBtn }),
    ).toHaveAttribute('aria-pressed', 'true');

    document.documentElement.classList.remove('animations-paused');
    vi.unstubAllGlobals();
  });
});
