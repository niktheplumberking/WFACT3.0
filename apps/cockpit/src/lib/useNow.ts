import { useEffect, useState } from "react";

/**
 * The current time, ticking every `everyMs` while `active` (a live elapsed counter). Stops ticking when inactive, so a
 * finished build's page never re-renders on a timer. Keep it in the smallest component that shows the time: every tick
 * re-renders that component.
 */
export function useNow(active: boolean, everyMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(t);
  }, [active, everyMs]);
  return now;
}
