import { lazy, Suspense, type ReactElement } from 'react';
import type { UseAirQualityReturn } from '../hooks/useAirQuality.js';
import type { UsePlanGeneratorReturn } from '../hooks/usePlanGenerator.js';
import type { TranslationDictionary } from '../i18n/translations.js';
import type { Language, LifestyleProfile } from '../types/index.js';
import { ActionPlanView } from './ActionPlanView.js';
import { AqiHeroCard } from './AqiHeroCard.js';
import { ErrorBoundary } from './ErrorBoundary.js';
import { ProfileForm } from './ProfileForm.js';

const LazyImpactCalculator = lazy(() => import('./ImpactCalculator.js'));
const LazyFollowUpChat = lazy(() => import('./FollowUpChat.js'));

function SectionSkeleton({ label }: Readonly<{ label: string }>): ReactElement {
  return (
    <div
      aria-busy="true"
      aria-label={label}
      className="h-56 animate-pulse rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6"
    />
  );
}

interface DashboardMainContentProps {
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
}

function BoundedSection({
  sectionTitle,
  t,
  children,
}: Readonly<{
  sectionTitle: string;
  t: TranslationDictionary;
  children: React.ReactNode;
}>): ReactElement {
  return (
    <ErrorBoundary
      sectionTitle={sectionTitle}
      bodyText={t.errorBoundaryBody}
      retryLabel={t.errorBoundaryRetry}
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * Primary dashboard sections wrapped in isolated error boundaries and Suspense fallbacks.
 */
export function DashboardMainContent({
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
}: Readonly<DashboardMainContentProps>): ReactElement {
  return (
    <main
      id="main-content"
      className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8 space-y-6"
    >
      <BoundedSection sectionTitle={t.navAirQuality} t={t}>
        <AqiHeroCard
          t={t}
          language={language}
          location={airQualityState.location}
          reading={airQualityState.reading}
          isLoadingAqi={airQualityState.isLoadingAqi}
          aqiError={airQualityState.aqiError}
          searchQuery={airQualityState.searchQuery}
          onSearchQueryChange={airQualityState.setSearchQuery}
          searchResults={airQualityState.searchResults}
          hasSearched={airQualityState.hasSearched}
          isSearching={airQualityState.isSearching}
          searchError={airQualityState.searchError}
          onSelectCity={airQualityState.selectCity}
          onSubmitCitySearch={() => void airQualityState.submitCitySearch()}
          onRequestGeolocation={onGeolocationClick}
          isLocating={isLocating}
          geoError={geoError}
          onApplyManualAqi={airQualityState.applyManualAqi}
          onRefreshAqi={airQualityState.refreshAqi}
          animationsPaused={effectiveAnimationsPaused}
        />
      </BoundedSection>
      <BoundedSection sectionTitle={t.profileTitle} t={t}>
        <ProfileForm
          t={t}
          language={language}
          profile={profile}
          onChange={onProfileChange}
          onSubmit={onGeneratePlan}
          isGenerating={planState.isGenerating}
          hasReading={Boolean(airQualityState.reading)}
        />
      </BoundedSection>
      <BoundedSection sectionTitle={t.planTitle} t={t}>
        <ActionPlanView
          t={t}
          language={language}
          plan={planState.plan}
          isGenerating={planState.isGenerating}
          streamCharCount={planState.streamCharCount}
          error={planState.error}
          onRetry={() => void planState.retryLastPlan()}
          currentLocation={airQualityState.location}
          currentReading={airQualityState.reading}
          currentProfile={profile}
          animationsPaused={effectiveAnimationsPaused}
          onRegenerateForCurrent={onRegenerateForCurrent}
        />
      </BoundedSection>
      <BoundedSection sectionTitle={t.impactTitle} t={t}>
        <Suspense fallback={<SectionSkeleton label={t.impactTitle} />}>
          <LazyImpactCalculator t={t} language={language} />
        </Suspense>
      </BoundedSection>
      <BoundedSection sectionTitle={t.chatTitle} t={t}>
        <Suspense fallback={<SectionSkeleton label={t.chatTitle} />}>
          <LazyFollowUpChat
            t={t}
            language={language}
            location={airQualityState.location}
            reading={airQualityState.reading}
            plan={planState.plan}
          />
        </Suspense>
      </BoundedSection>
    </main>
  );
}
