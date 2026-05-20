import { useState, useEffect } from 'react';

export type TimePhase = 'morning' | 'afternoon' | 'evening' | 'night';

export const useCircadian = (): TimePhase => {
  const getPhase = (): TimePhase => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 21) return 'evening';
    return 'night';
  };

  const [phase, setPhase] = useState<TimePhase>(getPhase());

  useEffect(() => {
    const interval = setInterval(() => {
      setPhase(getPhase());
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, []);

  return phase;
};
