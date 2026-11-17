import { useEffect, useState } from 'react';

/** Subscribes to a CSS media query. Returns `fallback` during SSR / first paint. */
export function useMediaQuery(query: string, fallback = false): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia(query).matches
      : fallback
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** True on phones/tablets where the primary input is a finger (no hover). */
export function useIsTouch(): boolean {
  return useMediaQuery('(pointer: coarse)');
}

/** True below the `lg` breakpoint, where the studio collapses to one column. */
export function useIsCompactLayout(): boolean {
  return useMediaQuery('(max-width: 1023px)');
}
