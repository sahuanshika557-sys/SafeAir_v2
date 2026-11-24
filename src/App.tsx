import { useCallback, useMemo, useState, type ReactElement } from 'react';
import { DashboardMainContent } from './components/DashboardMainContent.js';
import { Footer } from './components/Footer.js';
import { Header } from './components/Header.js';
import { DEFAULT_PROFILE } from './constants/index.js';
import { useAirQuality } from './hooks/useAirQuality.js';
import { useGeolocation } from './hooks/useGeolocation.js';
import { usePlanGenerator } from './hooks/usePlanGenerator.js';
import { useThemeAndMotion } from './hooks/useThemeAndMotion.js';
import { TRANSLATIONS } from './i18n/translations.js';
import type { LifestyleProfile } from './types/index.js';

/**
 * Root SafeAir Saathi application orchestrating AQI lookup, profile personalization,
 * Gemini action plan streaming, impact calculator, follow-up Q&A, theme, and motion preferences.
 */
export default function App(): ReactElement {
  const {
    language,
    isDark,
    animationsPaused,
    effectiveAnimationsPaused,
    toggleLanguage,
    toggleTheme,
    toggleAnimations,
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
        location: airQualityState.location,
        airQuality: airQualityState.reading,
        profile: validatedProfile,
        language,
      });
    },
    [airQualityState.location, airQualityState.reading, language, planState],
  );

  const handleRegenerateForCurrent = useCallback((): void => {
    if (!airQualityState.reading) {
      return;
    }
    void planState.generatePlan({
      location: airQualityState.location,
      airQuality: airQualityState.reading,
      profile,
      language,
      bypassCache: true,
    });
  }, [airQualityState.location, airQualityState.reading, language, planState, profile]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <Header t={t} language={language} onToggleLanguage={toggleLanguage} />
      <DashboardMainContent
        t={t}
        language={language}
        profile={profile}
        onProfileChange={setProfile}
        airQualityState={airQualityState}
        isLocating={isLocating}
        geoError={geoError}
        planState={planState}
        effectiveAnimationsPaused={effectiveAnimationsPaused}
        onGeolocationClick={() => void handleGeolocationClick()}
        onGeneratePlan={handleGeneratePlan}
        onRegenerateForCurrent={handleRegenerateForCurrent}
      />
      <Footer
        t={t}
        isDark={isDark}
        animationsPaused={animationsPaused}
        onToggleAnimations={toggleAnimations}
        onToggleTheme={toggleTheme}
      />
    </div>
  );
}
