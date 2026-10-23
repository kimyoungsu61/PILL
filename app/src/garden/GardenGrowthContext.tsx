import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';
import { createGrowthTracker, type GardenGrowth } from './growthCelebration';
import type { GardenState } from './types';

type GrowthContext = {
  celebration: GardenGrowth | null;
  observeGarden: (garden: GardenState, celebrate?: boolean) => void;
  dismissGrowth: () => void;
};
const Context = createContext<GrowthContext | null>(null);

export function GardenGrowthProvider({ children }: { children: ReactNode }) {
  const { token, email } = useAuth();
  // Browser sessions share a sentinel token, so the email is also part of the
  // boundary. No progress or celebration may leak across account changes.
  return <SessionGrowth key={`${token ?? 'signed-out'}:${email ?? ''}`}>{children}</SessionGrowth>;
}

function SessionGrowth({ children }: { children: ReactNode }) {
  const tracker = useRef(createGrowthTracker());
  const [celebration, setCelebration] = useState<GardenGrowth | null>(null);
  const observeGarden = useCallback((garden: GardenState, celebrate = true) => {
    const growth = tracker.current.observe(garden, celebrate);
    if (growth) setCelebration(growth);
  }, []);
  const dismissGrowth = useCallback(() => setCelebration(null), []);
  const value = useMemo(() => ({ celebration, observeGarden, dismissGrowth }), [celebration, observeGarden, dismissGrowth]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useGardenGrowth() {
  const context = useContext(Context);
  if (!context) throw new Error('GardenGrowthProvider is required');
  return context;
}
