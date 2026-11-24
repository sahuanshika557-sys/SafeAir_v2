import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import { DEFAULT_LOCATION } from '../constants/index.js';
import { fetchAirQuality } from '../services/airQuality.js';
import { reverseGeocodeCoordinates } from '../services/geocoding.js';
import type { AirQualityReading, Language, LocationData } from '../types/index.js';
import { isAbortError } from '../utils/network.js';
import {
  buildGeolocationLocation,
  isSameGeoCoordinateLocation,
  resolveAqiErrorMessage,
} from './airQualityHelpers.js';

interface AqiLoaderHandlers {
  setReading: (r: AirQualityReading) => void;
  setError: (e: string | null) => void;
  setLoading: (l: boolean) => void;
}

async function runAqiFetch(
  target: LocationData,
  bypassCache: boolean,
  language: Language,
  signal: AbortSignal,
  handlers: AqiLoaderHandlers,
): Promise<void> {
  handlers.setLoading(true);
  handlers.setError(null);
  try {
    const nextReading = await fetchAirQuality(target.latitude, target.longitude, {
      bypassCache,
      signal,
      language,
    });
    if (!signal.aborted) {
      handlers.setReading(nextReading);
    }
  } catch (err: unknown) {
    if (!isAbortError(err) && !signal.aborted) {
      handlers.setError(resolveAqiErrorMessage(err, language));
    }
  } finally {
    if (!signal.aborted) {
      handlers.setLoading(false);
    }
  }
}

async function resolveGeoCityLabel(
  latitude: number,
  longitude: number,
  language: Language,
  setLocation: Dispatch<SetStateAction<LocationData>>,
): Promise<void> {
  const resolvedPlace = await reverseGeocodeCoordinates(latitude, longitude, language).catch(
    () => null,
  );
  if (!resolvedPlace) {
    return;
  }
  setLocation((prev) =>
    isSameGeoCoordinateLocation(prev, latitude, longitude)
      ? {
          ...prev,
          name: resolvedPlace.name,
          admin1: resolvedPlace.admin1,
          country: resolvedPlace.country,
        }
      : prev,
  );
}

/** Coordinates coordinate-based AQI lookup plus optional reverse geocoding. */
export async function executeCoordinateLoad(
  params: { latitude: number; longitude: number; label?: string; language: Language },
  deps: {
    setLocation: Dispatch<SetStateAction<LocationData>>;
    clearSearchInput: () => void;
    loadAqiForLocation: (target: LocationData, bypassCache?: boolean) => Promise<void>;
  },
): Promise<void> {
  const { latitude, longitude, label, language } = params;
  const initialLoc = buildGeolocationLocation(latitude, longitude, language, label);
  deps.setLocation(initialLoc);
  deps.clearSearchInput();
  if (label) {
    await deps.loadAqiForLocation(initialLoc, true);
    return;
  }
  await Promise.all([
    resolveGeoCityLabel(latitude, longitude, language, deps.setLocation),
    deps.loadAqiForLocation(initialLoc, true),
  ]);
}

/** Manages initial AQI fetch and abort-safe on-demand location reloading. */
export function useAqiLoader(
  language: Language,
  handlers: AqiLoaderHandlers,
): (target: LocationData, bypassCache?: boolean) => Promise<void> {
  const aqiAbortRef = useRef<AbortController | null>(null);
  const languageRef = useRef<Language>(language);
  const { setReading, setError, setLoading } = handlers;

  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  useEffect(() => {
    const controller = new AbortController();
    aqiAbortRef.current = controller;
    void runAqiFetch(DEFAULT_LOCATION, false, languageRef.current, controller.signal, {
      setReading,
      setError,
      setLoading,
    });
    return (): void => {
      controller.abort();
      aqiAbortRef.current?.abort();
    };
  }, [setError, setLoading, setReading]);

  return useCallback(
    async (target: LocationData, bypassCache: boolean = false): Promise<void> => {
      aqiAbortRef.current?.abort();
      const controller = new AbortController();
      aqiAbortRef.current = controller;
      await runAqiFetch(target, bypassCache, language, controller.signal, {
        setReading,
        setError,
        setLoading,
      });
    },
    [language, setError, setLoading, setReading],
  );
}
