import { useEffect, useState } from 'react';

/** Re-render roughly once a minute so relative timestamps stay fresh. */
export function useMinuteTick() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}
