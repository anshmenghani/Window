// Who is logged in, and their profile. Wraps the whole app (see src/app/_layout.tsx).
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { getMyProfile } from './data';
import type { Profile } from './types';

type Session = {
  profile: Profile | null;
  loading: boolean;
  /** Re-fetch the profile (after sign in, sign out, or saving onboarding). */
  refresh: () => Promise<Profile | null>;
};

const SessionContext = createContext<Session>({ profile: null, loading: true, refresh: async () => null });

export function SessionProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const p = await getMyProfile();
      setProfile(p);
      return p;
    } catch {
      setProfile(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return <SessionContext.Provider value={{ profile, loading, refresh }}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}
