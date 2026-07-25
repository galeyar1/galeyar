"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";
import { db } from "@/lib/db/schema";
import type { UserProfile } from "@/lib/supabase/types";

interface AuthContextValue {
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) throw error;

      const loaded = data as UserProfile;
      if (loaded.status === "suspended") {
        // Control Center (admin.galeyar.ir) suspension — sign out immediately
        // rather than leaving a suspended account signed in with stale data.
        await supabase.auth.signOut();
        await db.profile.delete("current");
        setProfile(null);
        toast.error("حساب کاربری شما مسدود شده است. برای اطلاعات بیشتر با پشتیبانی تماس بگیرید.");
        return;
      }

      setProfile(loaded);
      await db.profile.put({ ...loaded, cacheKey: "current" });
    } catch {
      // Offline (or first paint before the network settles): fall back to
      // whatever profile we last saw for this device.
      const cached = await db.profile.get("current");
      if (cached && cached.id === userId) {
        setProfile(cached);
      }
    }
  }, []);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (data.session) {
        void loadProfile(data.session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      if (newSession) {
        void loadProfile(newSession.user.id);
        if (event === "SIGNED_IN") {
          void supabase.from("users").update({ last_login_at: new Date().toISOString() }).eq("id", newSession.user.id);
        }
      } else {
        setProfile(null);
        void db.profile.delete("current");
      }
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const refreshProfile = useCallback(async () => {
    if (session) {
      await loadProfile(session.user.id);
    }
  }, [session, loadProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    await db.profile.delete("current");
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ session, profile, loading, refreshProfile, signOut }),
    [session, profile, loading, refreshProfile, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
