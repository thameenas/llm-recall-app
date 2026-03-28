import { useState, useEffect } from "react";

/**
 * Returns a debounced version of the value.
 * The returned value only updates after `delay` ms of no changes.
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    // Start a timer. If value changes again before the timer fires,
    // the cleanup function cancels the old timer and a new one starts.
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
