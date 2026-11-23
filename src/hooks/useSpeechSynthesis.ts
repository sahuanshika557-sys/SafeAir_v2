import { useCallback, useEffect, useState } from 'react';
import type { Language } from '../types/index.js';

const SPEECH_SYNTHESIS_RATE = 0.96;

/** State and controls returned by {@link useSpeechSynthesis}. */
export interface UseSpeechSynthesisReturn {
  isSupported: boolean;
  isSpeaking: boolean;
  speak: (text: string, language: Language) => void;
  stop: () => void;
}

function cancelSpeechQuietly(supported: boolean): void {
  if (!supported) {
    return;
  }
  try {
    window.speechSynthesis.cancel();
  } catch {
    // Ignore synthesis cancellation errors.
  }
}

function speakUtteranceText(
  text: string,
  language: Language,
  onStart: () => void,
  onDone: () => void,
): void {
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = language === 'hi' ? 'hi-IN' : 'en-IN';
  utterance.rate = SPEECH_SYNTHESIS_RATE;
  utterance.onend = onDone;
  utterance.onerror = onDone;
  onStart();
  window.speechSynthesis.speak(utterance);
}

/**
 * Accessible Web Speech API wrapper with safe feature detection and cleanup on unmount.
 *
 * @returns Browser speech support status, playback state, and `speak`/`stop` controls.
 */
export function useSpeechSynthesis(): UseSpeechSynthesisReturn {
  const isSupported =
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof SpeechSynthesisUtterance !== 'undefined';

  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

  const stop = useCallback((): void => {
    cancelSpeechQuietly(isSupported);
    setIsSpeaking(false);
  }, [isSupported]);

  const speak = useCallback(
    (text: string, language: Language): void => {
      if (!isSupported || !text.trim()) {
        return;
      }
      try {
        speakUtteranceText(text, language, () => setIsSpeaking(true), () => setIsSpeaking(false));
      } catch {
        setIsSpeaking(false);
      }
    },
    [isSupported],
  );

  useEffect(() => {
    return (): void => cancelSpeechQuietly(isSupported);
  }, [isSupported]);

  return { isSupported, isSpeaking, speak, stop };
}
