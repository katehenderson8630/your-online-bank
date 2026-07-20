import { createContext, useContext, useEffect, useState, ReactNode, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

type Profile = {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  kyc_status: "pending" | "approved" | "rejected" | "frozen";
  kyc_reason: string | null;
};

type Ctx = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<Ctx | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const ensureProfile = async (authUser: User) => {
    const meta = authUser.user_metadata ?? {};
    const fallbackName = typeof meta.full_name === "string" && meta.full_name.trim()
      ? meta.full_name
      : authUser.email?.split("@")[0] ?? "User";
    const { data } = await supabase
      .from("profiles")
      .upsert({
        id: authUser.id,
        email: authUser.email ?? "",
        full_name: fallbackName,
        phone: typeof meta.phone === "string" ? meta.phone : null,
        avatar_url: typeof meta.avatar_url === "string" ? meta.avatar_url : null,
      }, { onConflict: "id", ignoreDuplicates: true })
      .select("*")
      .maybeSingle();
    return data as Profile | null;
  };

  const loadExtras = async (authUser: User) => {
    const [{ data: p }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", authUser.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", authUser.id),
    ]);
    setProfile((p as Profile | null) ?? await ensureProfile(authUser));
    setIsAdmin(!!roles?.some((r) => r.role === "admin"));
  };

  const subscribeProfile = (uid: string) => {
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    channelRef.current = supabase
      .channel(`profile-${uid}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${uid}` }, (payload) => {
        setProfile((prev) => ({ ...(prev as Profile), ...(payload.new as Profile) }));
      })
      .subscribe();
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setLoading(true);
        const authUser = s.user;
        setTimeout(() => {
          loadExtras(authUser).finally(() => setLoading(false));
          subscribeProfile(authUser.id);
        }, 0);
      } else {
        setProfile(null);
        setIsAdmin(false);
        setLoading(false);
        if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null; }
      }
    });
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        loadExtras(s.user).finally(() => setLoading(false));
        subscribeProfile(s.user.id);
      } else setLoading(false);
    });
    return () => {
      sub.subscription.unsubscribe();
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, []);

  const refreshProfile = async () => {
    if (user) await loadExtras(user);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, isAdmin, loading, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
};
