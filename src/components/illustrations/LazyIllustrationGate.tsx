import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';

interface LazyIllustrationGateProps {
  children: ReactNode;
  minHeightClass?: string;
}

/**
 * Defers mounting decorative below-the-fold SVG illustrations until near the viewport when
 * `IntersectionObserver` is available, while rendering immediately in non-observer environments.
 */
export function LazyIllustrationGate({
  children,
  minHeightClass = 'min-h-[2.75rem]',
}: Readonly<LazyIllustrationGateProps>): ReactElement {
  const [shouldRender, setShouldRender] = useState<boolean>(
    () => typeof window === 'undefined' || typeof window.IntersectionObserver !== 'function',
  );
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (shouldRender) {
      return;
    }
    const target = hostRef.current;
    if (!target || typeof window.IntersectionObserver !== 'function') {
      setShouldRender(true);
      return;
    }

    const observer = new window.IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldRender(true);
          observer.disconnect();
        }
      },
      { rootMargin: '120px' },
    );

    observer.observe(target);
    return (): void => {
      observer.disconnect();
    };
  }, [shouldRender]);

  return (
    <div ref={hostRef} className={shouldRender ? 'contents' : minHeightClass}>
      {shouldRender ? children : null}
    </div>
  );
}
