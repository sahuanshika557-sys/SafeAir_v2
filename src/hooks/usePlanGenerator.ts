import { useCallback, useEffect, useRef, useState } from 'react';
import { generatePersonalizedPlan } from '../services/gemini.js';
import type {
  ActionPlan,
  AirQualityReading,
  Language,
  LifestyleProfile,
  LocationData,
} from '../types/index.js';
import { buildRuleBasedFallbackPlan } from '../utils/fallbackPlan.js';
import { isAbortError } from '../utils/network.js';

interface PlanGenerationParams {
  location: LocationData;
  airQuality: AirQualityReading;
  profile: LifestyleProfile;
  language: Language;
  bypassCache?: boolean;
}

/**
 * State and actions returned by {@link usePlanGenerator}.
 */
export interface UsePlanGeneratorReturn {
  plan: ActionPlan | null;
  isGenerating: boolean;
  streamCharCount: number;
  error: string | null;
  generatePlan: (params: PlanGenerationParams) => Promise<void>;
  retryLastPlan: () => Promise<void>;
}

interface PlanGenerationCallbacks {
  setStreamCharCount: (count: number) => void;
  setPlan: (plan: ActionPlan) => void;
  setError: (msg: string) => void;
  setIsGenerating: (val: boolean) => void;
}

function handlePlanFailure(
  err: unknown,
  params: PlanGenerationParams,
  signal: AbortSignal,
  callbacks: Pick<PlanGenerationCallbacks, 'setError' | 'setPlan'>,
): void {
  if (isAbortError(err) || signal.aborted) {
    return;
  }
  const fallbackMsg =
    params.language === 'hi'
      ? 'अभी AI योजना तैयार नहीं हो सकी। नियम-आधारित मार्गदर्शन दिखाया जा रहा है।'
      : 'Unable to generate AI plan right now. Showing rule-based guidance.';
  callbacks.setError(err instanceof Error ? err.message : fallbackMsg);
  callbacks.setPlan(
    buildRuleBasedFallbackPlan(params.airQuality, params.profile, params.language, params.location),
  );
}

async function runPlanGeneration(
  params: PlanGenerationParams,
  signal: AbortSignal,
  callbacks: PlanGenerationCallbacks,
): Promise<void> {
  try {
    const result = await generatePersonalizedPlan({
      ...params,
      signal,
      onStreamProgress: (partial) => {
        if (!signal.aborted) {
          callbacks.setStreamCharCount(partial.length);
        }
      },
    });
    if (!signal.aborted) {
      callbacks.setPlan(result);
    }
  } catch (err: unknown) {
    handlePlanFailure(err, params, signal, callbacks);
  } finally {
    if (!signal.aborted) {
      callbacks.setIsGenerating(false);
    }
  }
}

/**
 * Manages streaming personalized action plan generation with `AbortController` cancellation,
 * retry support, and automatic rule-based fallback on AI errors.
 */
export function usePlanGenerator(): UsePlanGeneratorReturn {
  const [plan, setPlan] = useState<ActionPlan | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [streamCharCount, setStreamCharCount] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const lastRequestRef = useRef<Omit<PlanGenerationParams, 'bypassCache'> | null>(null);

  useEffect(() => {
    return (): void => abortRef.current?.abort();
  }, []);

  const generatePlan = useCallback(async (params: PlanGenerationParams): Promise<void> => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    lastRequestRef.current = {
      location: params.location,
      airQuality: params.airQuality,
      profile: params.profile,
      language: params.language,
    };
    setIsGenerating(true);
    setStreamCharCount(0);
    setError(null);
    await runPlanGeneration(params, controller.signal, {
      setStreamCharCount,
      setPlan,
      setError,
      setIsGenerating,
    });
  }, []);

  const retryLastPlan = useCallback(async (): Promise<void> => {
    const last = lastRequestRef.current;
    if (last) {
      await generatePlan({ ...last, bypassCache: true });
    }
  }, [generatePlan]);

  return { plan, isGenerating, streamCharCount, error, generatePlan, retryLastPlan };
}
