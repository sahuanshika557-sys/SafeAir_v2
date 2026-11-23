import type { ReactElement } from 'react';
import type { ImpactChoiceId, PlanSectionKey } from '../../types/index.js';
import { EmptyPlanIllustration } from './EmptyPlanIllustration.js';
import { ErrorStateIllustration } from './ErrorStateIllustration.js';
import { HealthProtectionIllustration } from './HealthProtectionIllustration.js';
import { IndoorAirIllustration } from './IndoorAirIllustration.js';
import { RoutineIllustration } from './RoutineIllustration.js';
import { SustainableIllustration } from './SustainableIllustration.js';
import { SwapCompostIllustration } from './SwapCompostIllustration.js';
import { SwapCycleIllustration } from './SwapCycleIllustration.js';
import { SwapInductionIllustration } from './SwapInductionIllustration.js';
import { SwapMaskIllustration } from './SwapMaskIllustration.js';
import { SwapMetroIllustration } from './SwapMetroIllustration.js';
import { SwapSealingIllustration } from './SwapSealingIllustration.js';

/**
 * Renders the decorative spot illustration corresponding to a plan section tab key.
 * Intended for lazy/deferred rendering below the fold.
 */
export function PlanSectionIllustration({
  sectionKey,
  className = 'w-11 h-11 shrink-0',
}: Readonly<{
  sectionKey: PlanSectionKey;
  className?: string;
}>): ReactElement {
  switch (sectionKey) {
    case 'dailyRoutine':
      return <RoutineIllustration className={className} />;
    case 'indoorAirHacks':
      return <IndoorAirIllustration className={className} />;
    case 'sustainableAlternatives':
      return <SustainableIllustration className={className} />;
    case 'healthProtection':
      return <HealthProtectionIllustration className={className} />;
  }
}

/**
 * Renders the decorative spot illustration corresponding to an impact calculator choice.
 */
export function ImpactSwapIllustration({
  choiceId,
  className = 'w-9 h-9 shrink-0',
}: Readonly<{
  choiceId: ImpactChoiceId;
  className?: string;
}>): ReactElement {
  switch (choiceId) {
    case 'metro_over_car':
      return <SwapMetroIllustration className={className} />;
    case 'n95_mask':
      return <SwapMaskIllustration className={className} />;
    case 'induction_over_wood':
      return <SwapInductionIllustration className={className} />;
    case 'no_waste_burning':
      return <SwapCompostIllustration className={className} />;
    case 'hepa_seal_windows':
      return <SwapSealingIllustration className={className} />;
    case 'cycle_short_trips':
      return <SwapCycleIllustration className={className} />;
  }
}

/**
 * Renders friendly below-the-fold state graphics (`empty` or `error`).
 */
export function StateGraphic({
  variant,
  className,
}: Readonly<{
  variant: 'empty' | 'error';
  className?: string;
}>): ReactElement {
  return variant === 'empty' ? (
    <EmptyPlanIllustration className={className} />
  ) : (
    <ErrorStateIllustration className={className} />
  );
}
