import { useRef, type KeyboardEvent, type ReactElement } from 'react';
import type { TranslationDictionary } from '../../i18n/translations.js';
import type { ActionPlan, AqiCategoryKey, Language, PlanSectionKey } from '../../types/index.js';
import {
  BreathingLungsIllustration,
  LazyIllustrationGate,
  PlanSectionIllustration,
} from '../illustrations/index.js';
import { RecommendationCard } from './RecommendationCard.js';

/** Ordered keys for the four tabs in the Action Plan section. */
export const PLAN_SECTION_ORDER: readonly PlanSectionKey[] = [
  'dailyRoutine',
  'indoorAirHacks',
  'sustainableAlternatives',
  'healthProtection',
];

interface PlanTabPanelProps {
  t: TranslationDictionary;
  language: Language;
  plan: ActionPlan;
  activeTab: PlanSectionKey;
  onSelectTab: (tab: PlanSectionKey) => void;
  tabLabels: Record<PlanSectionKey, string>;
  activeCategoryKey: AqiCategoryKey;
  accentHex?: string;
  animationsPaused: boolean;
}

function ActivePlanSectionBody({
  t,
  language,
  plan,
  sectionKey,
  label,
  activeCategoryKey,
  accentHex,
  animationsPaused,
}: Readonly<{
  t: TranslationDictionary;
  language: Language;
  plan: ActionPlan;
  sectionKey: PlanSectionKey;
  label: string;
  activeCategoryKey: AqiCategoryKey;
  accentHex?: string;
  animationsPaused: boolean;
}>): ReactElement {
  return (
    <div className="safeair-card-enter space-y-4">
      <div className="flex items-center gap-3">
        <LazyIllustrationGate minHeightClass="w-11 h-11 shrink-0">
          <PlanSectionIllustration sectionKey={sectionKey} className="w-11 h-11 shrink-0" />
        </LazyIllustrationGate>
        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{label}</h3>
        {sectionKey === 'healthProtection' && (
          <BreathingLungsIllustration
            categoryKey={activeCategoryKey}
            accentHex={accentHex}
            animationsPaused={animationsPaused}
            className="w-7 h-7 shrink-0"
          />
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {plan[sectionKey].map((item, idx) => (
          <RecommendationCard
            key={`${sectionKey}-${idx}-${item.title}`}
            item={item}
            language={language}
            t={t}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Accessible WAI-ARIA tablist and panels rendering the 4 sections of an ActionPlan.
 */
export function PlanTabPanel({
  t,
  language,
  plan,
  activeTab,
  onSelectTab,
  tabLabels,
  activeCategoryKey,
  accentHex,
  animationsPaused,
}: Readonly<PlanTabPanelProps>): ReactElement {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleTabKeyDown = (e: KeyboardEvent<HTMLButtonElement>, idx: number): void => {
    let nextIndex: number;
    if (e.key === 'ArrowRight') {
      nextIndex = (idx + 1) % PLAN_SECTION_ORDER.length;
    } else if (e.key === 'ArrowLeft') {
      nextIndex = (idx - 1 + PLAN_SECTION_ORDER.length) % PLAN_SECTION_ORDER.length;
    } else if (e.key === 'Home') {
      nextIndex = 0;
    } else if (e.key === 'End') {
      nextIndex = PLAN_SECTION_ORDER.length - 1;
    } else {
      return;
    }
    e.preventDefault();
    const nextKey = PLAN_SECTION_ORDER[nextIndex];
    if (nextKey) {
      onSelectTab(nextKey);
      tabRefs.current[nextIndex]?.focus();
    }
  };

  return (
    <div>
      <div
        role="tablist"
        aria-label={t.planTitle}
        className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-3"
      >
        {PLAN_SECTION_ORDER.map((sectionKey, idx) => {
          const isActive = activeTab === sectionKey;
          return (
            <button
              key={sectionKey}
              ref={(el) => {
                tabRefs.current[idx] = el;
              }}
              id={`plan-tab-${sectionKey}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`plan-panel-${sectionKey}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onSelectTab(sectionKey)}
              onKeyDown={(e) => handleTabKeyDown(e, idx)}
              className={`inline-flex min-h-[44px] max-w-full items-center gap-2 rounded-lg px-4 py-2 text-left text-sm font-semibold transition-colors sm:whitespace-nowrap ${
                isActive
                  ? 'bg-teal-800 text-white dark:bg-teal-700'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              <span>{tabLabels[sectionKey]}</span>
              {sectionKey === 'healthProtection' && (
                <BreathingLungsIllustration
                  categoryKey={activeCategoryKey}
                  accentHex={isActive ? '#ffffff' : accentHex}
                  animationsPaused={animationsPaused}
                  className="w-5 h-5 shrink-0"
                />
              )}
            </button>
          );
        })}
      </div>

      {PLAN_SECTION_ORDER.map((sectionKey) => {
        const isActive = activeTab === sectionKey;
        return (
          <div
            key={sectionKey}
            id={`plan-panel-${sectionKey}`}
            role="tabpanel"
            aria-labelledby={`plan-tab-${sectionKey}`}
            tabIndex={isActive ? 0 : -1}
            hidden={!isActive}
            className="pt-5"
          >
            {isActive && (
              <ActivePlanSectionBody
                t={t}
                language={language}
                plan={plan}
                sectionKey={sectionKey}
                label={tabLabels[sectionKey]}
                activeCategoryKey={activeCategoryKey}
                accentHex={accentHex}
                animationsPaused={animationsPaused}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
