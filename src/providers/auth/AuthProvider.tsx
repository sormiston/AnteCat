import { supabase } from "@/lib/supabase";
import type { Session, User } from "@supabase/supabase-js";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * `loading` until the initial getSession() resolves. Route guards wait on this
 * so the wrong route never flashes before the persisted session is restored.
 */
export type AuthStatus = "loading" | "signedIn" | "signedOut";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  status: AuthStatus;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setStatus(data.session ? "signedIn" : "signedOut");
    });

    // Fires for SIGNED_IN / SIGNED_OUT / TOKEN_REFRESHED, so it is also what
    // keeps `session.access_token` current for anything reading it.
    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);
        setStatus(nextSession ? "signedIn" : "signedOut");
      },
    );

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ session, user: session?.user ?? null, status }),
    [session, status],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return value;
}
