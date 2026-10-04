import { useLayoutEffect, useRef } from 'react';

/**
 * Ref that always holds the latest value. Long-lived callbacks (speech events,
 * async loops) read `.current` instead of the stale closure they were created with.
 */
export function useLatestRef<T>(value: T) {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}
