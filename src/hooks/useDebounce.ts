import { useEffect, useState } from 'react';

/**
 * Debounces a changing value by the specified delay in milliseconds.
 *
 * @param value - Rapidly changing input value.
 * @param delayMs - Debounce quiet period in milliseconds.
 * @returns Latest settled value after `delayMs` elapses without further changes.
 */
export function useDebounce<T>(value: T, delayMs: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = globalThis.setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return (): void => {
      globalThis.clearTimeout(timer);
    };
  }, [value, delayMs]);

  return debouncedValue;
}
