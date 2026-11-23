import { lazy, Suspense, useCallback, useMemo, useState, type ReactElement } from 'react';
import { ActionPlanView } from './components/ActionPlanView.js';
import { AqiHeroCard } from './components/AqiHeroCard.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import { Footer } from './components/Footer.js';
import { Header } from './components/Header.js';
import { ProfileForm } from './components/ProfileForm.js';
import { DEFAULT_PROFILE } from './constants/index.js';
import { useAirQuality, type UseAirQualityReturn } from './hooks/useAirQuality.js';
import { useGeolocation } from './hooks/useGeolocation.js';
import { usePlanGenerator, type UsePlanGeneratorReturn } from './hooks/usePlanGenerator.js';
import { useThemeAndMotion } from './hooks/useThemeAndMotion.js';
import { TRANSLATIONS, type TranslationDictionary } from './i18n/translations.js';
import type { Language, LifestyleProfile } from './types/index.js';

const LazyImpactCalculator = lazy(() => import('./components/ImpactCalculator.js'));
const LazyFollowUpChat = lazy(() => import('./components/FollowUpChat.js'));

function SectionSkeleton({ label }: Readonly<{ label: string }>): ReactElement {
  return (
    <div
      aria-busy="true"
      aria-label={label}
      className="h-56 animate-pulse rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6"
    />
  );
}

function DashboardMainContent({
  t,
  language,
  profile,
  onProfileChange,
  airQualityState,
  isLocating,
  geoError,
  planState,
  effectiveAnimationsPaused,
  onGeolocationClick,
  onGeneratePlan,
  onRegenerateForCurrent,
}: Readonly<{
  t: TranslationDictionary;
  language: Language;
  profile: LifestyleProfile;
  onProfileChange: (nextProfile: LifestyleProfile) => void;
  airQualityState: UseAirQualityReturn;
  isLocating: boolean;
  geoError: string | null;
  planState: UsePlanGeneratorReturn;
  effectiveAnimationsPaused: boolean;
  onGeolocationClick: () => void;
  onGeneratePlan: (validatedProfile: LifestyleProfile) => void;
  onRegenerateForCurrent: () => void;
}>): ReactElement {
  return (
    <main id="main-content" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8 space-y-6">
      <ErrorBoundary sectionTitle={t.navAirQuality} bodyText={t.errorBoundaryBody} retryLabel={t.errorBoundaryRetry}>
        <AqiHeroCard
          t={t} language={language} location={airQualityState.location} reading={airQualityState.reading}
          isLoadingAqi={airQualityState.isLoadingAqi} aqiError={airQualityState.aqiError}
          searchQuery={airQualityState.searchQuery} onSearchQueryChange={airQualityState.setSearchQuery}
          searchResults={airQualityState.searchResults} hasSearched={airQualityState.hasSearched}
          isSearching={airQualityState.isSearching} searchError={airQualityState.searchError}
          onSelectCity={airQualityState.selectCity} onSubmitCitySearch={() => void airQualityState.submitCitySearch()}
          onRequestGeolocation={onGeolocationClick} isLocating={isLocating} geoError={geoError}
          onApplyManualAqi={airQualityState.applyManualAqi} onRefreshAqi={airQualityState.refreshAqi}
          animationsPaused={effectiveAnimationsPaused}
        />
      </ErrorBoundary>
      <ErrorBoundary sectionTitle={t.profileTitle} bodyText={t.errorBoundaryBody} retryLabel={t.errorBoundaryRetry}>
        <ProfileForm
          t={t} language={language} profile={profile} onChange={onProfileChange}
          onSubmit={onGeneratePlan} isGenerating={planState.isGenerating} hasReading={Boolean(airQualityState.reading)}
        />
      </ErrorBoundary>
      <ErrorBoundary sectionTitle={t.planTitle} bodyText={t.errorBoundaryBody} retryLabel={t.errorBoundaryRetry}>
        <ActionPlanView
          t={t} language={language} plan={planState.plan} isGenerating={planState.isGenerating}
          streamCharCount={planState.streamCharCount} error={planState.error}
          onRetry={() => void planState.retryLastPlan()} currentLocation={airQualityState.location}
          currentReading={airQualityState.reading} currentProfile={profile}
          animationsPaused={effectiveAnimationsPaused} onRegenerateForCurrent={onRegenerateForCurrent}
        />
      </ErrorBoundary>
      <ErrorBoundary sectionTitle={t.impactTitle} bodyText={t.errorBoundaryBody} retryLabel={t.errorBoundaryRetry}>
        <Suspense fallback={<SectionSkeleton label={t.impactTitle} />}>
          <LazyImpactCalculator t={t} language={language} />
        </Suspense>
      </ErrorBoundary>
      <ErrorBoundary sectionTitle={t.chatTitle} bodyText={t.errorBoundaryBody} retryLabel={t.errorBoundaryRetry}>
        <Suspense fallback={<SectionSkeleton label={t.chatTitle} />}>
          <LazyFollowUpChat t={t} language={language} location={airQualityState.location} reading={airQualityState.reading} plan={planState.plan} />
        </Suspense>
      </ErrorBoundary>
    </main>
  );
}

/**
 * Root SafeAir Saathi application orchestrating AQI lookup, profile personalization,
 * Gemini action plan streaming, impact calculator, follow-up Q&A, theme, and motion preferences.
 */
export default function App(): ReactElement {
  const {
    language, isDark, animationsPaused, effectiveAnimationsPaused,
    toggleLanguage, toggleTheme, toggleAnimations,
  } = useThemeAndMotion();
  const [profile, setProfile] = useState<LifestyleProfile>(DEFAULT_PROFILE);
  const t = useMemo(() => TRANSLATIONS[language], [language]);
  const airQualityState = useAirQuality(language);
  const { isLocating, error: geoError, requestLocation } = useGeolocation(language);
  const planState = usePlanGenerator();

  const handleGeolocationClick = useCallback(async (): Promise<void> => {
    const coords = await requestLocation();
    if (coords) {
      await airQualityState.loadByCoordinates(coords.latitude, coords.longitude);
    }
  }, [airQualityState, requestLocation]);

  const handleGeneratePlan = useCallback(
    (validatedProfile: LifestyleProfile): void => {
      if (!airQualityState.reading) {
        return;
      }
      void planState.generatePlan({
        location: airQualityState.location, airQuality: airQualityState.reading, profile: validatedProfile, language,
      });
    },
    [airQualityState.location, airQualityState.reading, language, planState],
  );

  const handleRegenerateForCurrent = useCallback((): void => {
    if (!airQualityState.reading) {
      return;
    }
    void planState.generatePlan({
      location: airQualityState.location, airQuality: airQualityState.reading, profile, language, bypassCache: true,
    });
  }, [airQualityState.location, airQualityState.reading, language, planState, profile]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <Header t={t} language={language} onToggleLanguage={toggleLanguage} />
      <DashboardMainContent
        t={t} language={language} profile={profile} onProfileChange={setProfile}
        airQualityState={airQualityState} isLocating={isLocating} geoError={geoError}
        planState={planState} effectiveAnimationsPaused={effectiveAnimationsPaused}
        onGeolocationClick={() => void handleGeolocationClick()}
        onGeneratePlan={handleGeneratePlan} onRegenerateForCurrent={handleRegenerateForCurrent}
      />
      <Footer t={t} isDark={isDark} animationsPaused={animationsPaused} onToggleAnimations={toggleAnimations} onToggleTheme={toggleTheme} />
    </div>
  );
}
