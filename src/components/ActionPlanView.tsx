import { useEffect, useRef, useState, type ReactElement } from 'react';
import { useSpeechSynthesis } from '../hooks/useSpeechSynthesis.js';
import type { TranslationDictionary } from '../i18n/translations.js';
import type {
  ActionPlan,
  AirQualityReading,
  Language,
  LifestyleProfile,
  LocationData,
  PlanSectionKey,
} from '../types/index.js';
import { PlanHeaderBar } from './plan/PlanHeaderBar.js';
import { PlanStatePanels } from './plan/PlanStatePanels.js';
import { PlanTabPanel } from './plan/PlanTabPanel.js';
import {
  buildPlanSpeechText,
  buildWhyFitsSummary,
  isPlanOutdated,
} from './plan/planTextHelpers.js';

interface ActionPlanViewProps {
  t: TranslationDictionary;
  language: Language;
  plan: ActionPlan | null;
  isGenerating: boolean;
  streamCharCount: number;
  error: string | null;
  onRetry: () => void;
  currentLocation?: LocationData;
  currentReading?: AirQualityReading | null;
  currentProfile?: LifestyleProfile;
  onRegenerateForCurrent?: () => void;
  animationsPaused?: boolean;
}

function resolvePlaceLabel(
  location: LocationData | undefined,
  language: Language,
): string | undefined {
  if (!location) {
    return undefined;
  }
  if (location.id === 'default-new-delhi' && language === 'hi') {
    return 'नई दिल्ली, भारत';
  }
  return [location.name, location.country].filter(Boolean).join(', ');
}

function PlanSummaryOverview({
  t,
  plan,
  personalizationSummary,
}: Readonly<{
  t: TranslationDictionary;
  plan: ActionPlan;
  personalizationSummary: string | null;
}>): ReactElement {
  return (
    <>
      {personalizationSummary && (
        <div className="rounded-lg border border-teal-200 dark:border-teal-800 bg-teal-50/70 dark:bg-teal-950/40 p-4 space-y-1">
          <p className="text-xs font-bold uppercase tracking-wide text-teal-900 dark:text-teal-200">
            {t.whyFitsTitle}
          </p>
          <p className="text-sm text-slate-800 dark:text-slate-200">{personalizationSummary}</p>
        </div>
      )}
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 space-y-3">
        <p className="text-sm sm:text-base font-medium text-slate-900 dark:text-slate-100">
          {plan.summary}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm pt-2 border-t border-slate-200 dark:border-slate-800">
          <div>
            <span className="font-semibold text-emerald-800 dark:text-emerald-300">
              {t.bestWindowLabel}:{' '}
            </span>
            <span className="text-slate-700 dark:text-slate-300">{plan.bestTimeWindow}</span>
          </div>
          <div>
            <span className="font-semibold text-rose-800 dark:text-rose-300">
              {t.worstWindowLabel}:{' '}
            </span>
            <span className="text-slate-700 dark:text-slate-300">{plan.worstTimeWindow}</span>
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * Displays the 4-section personalized plan with WAI-ARIA tabs, streaming skeleton,
 * stale-plan detection, personalization summary, spot & breathing-lungs illustrations,
 * Read Aloud control, and focus management.
 */
export function ActionPlanView({
  t,
  language,
  plan,
  isGenerating,
  streamCharCount,
  error,
  onRetry,
  currentLocation,
  currentReading,
  currentProfile,
  onRegenerateForCurrent,
  animationsPaused = false,
}: Readonly<ActionPlanViewProps>): ReactElement {
  const [activeTab, setActiveTab] = useState<PlanSectionKey>('dailyRoutine');
  const planFocusRef = useRef<HTMLDivElement | null>(null);
  const prevGeneratingRef = useRef<boolean>(isGenerating);
  const { isSupported, isSpeaking, speak, stop } = useSpeechSynthesis();

  useEffect(() => {
    const wasGenerating = prevGeneratingRef.current;
    prevGeneratingRef.current = isGenerating;
    if (wasGenerating && !isGenerating && plan && planFocusRef.current) {
      planFocusRef.current.focus();
    }
  }, [isGenerating, plan]);

  const tabLabels: Record<PlanSectionKey, string> = {
    dailyRoutine: t.tabDailyRoutine,
    indoorAirHacks: t.tabIndoorHacks,
    sustainableAlternatives: t.tabSustainable,
    healthProtection: t.tabHealthProtection,
  };
  const currentPlaceLabel = resolvePlaceLabel(currentLocation, language);
  const outdated = isPlanOutdated(plan, currentReading, currentLocation, language);
  const currentCategoryLabel = currentReading
    ? language === 'hi'
      ? currentReading.category.labelHi
      : currentReading.category.labelEn
    : '';
  const personalizationSummary = buildWhyFitsSummary(
    t,
    language,
    plan?.generatedForProfile ?? currentProfile,
    currentPlaceLabel,
    currentReading,
  );

  const handleReadAloud = (): void => {
    if (!plan) {
      return;
    }
    if (isSpeaking) {
      stop();
      return;
    }
    speak(
      buildPlanSpeechText({
        t,
        language,
        plan,
        activeTab,
        tabLabel: tabLabels[activeTab],
        outdated,
      }),
      language,
    );
  };

  return (
    <section
      id="action-plan"
      aria-labelledby="plan-section-heading"
      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-8 space-y-6"
    >
      <PlanHeaderBar
        t={t}
        showReadAloud={Boolean(plan && !outdated && isSupported)}
        isSpeaking={isSpeaking}
        onReadAloud={handleReadAloud}
      />
      <div aria-live="polite">
        <PlanStatePanels
          t={t}
          plan={plan}
          isGenerating={isGenerating}
          streamCharCount={streamCharCount}
          error={error}
          isOutdated={outdated}
          currentReading={currentReading}
          currentPlaceLabel={currentPlaceLabel}
          currentCategoryLabel={currentCategoryLabel}
          onRetry={onRetry}
          onRegenerateForCurrent={onRegenerateForCurrent}
        />
        {plan && !isGenerating && !outdated && (
          <div ref={planFocusRef} tabIndex={-1} className="space-y-6 focus:outline-none">
            <PlanSummaryOverview
              t={t}
              plan={plan}
              personalizationSummary={personalizationSummary}
            />
            <PlanTabPanel
              t={t}
              language={language}
              plan={plan}
              activeTab={activeTab}
              onSelectTab={setActiveTab}
              tabLabels={tabLabels}
              activeCategoryKey={
                currentReading?.category.key ?? plan.generatedForCategoryKey ?? 'unhealthy'
              }
              accentHex={currentReading?.category.accentHex}
              animationsPaused={animationsPaused}
            />
          </div>
        )}
      </div>
    </section>
  );
}
