import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase";
import {
  UserProfile,
  UserAuthResponse,
  getActiveUserId,
  setActiveUserId,
  getSavedUserProfile,
  setSavedUserProfile,
  setAuthToken,
  clearAuthSession,
  updateUserProfile as syncBackendProfile,
  registerUser,
  loginUser,
  updateBackendUserPassword,
  DEFAULT_USER_PROFILE
} from "./api";

export interface RegisterParams {
  email: string;
  password: string;
  fullName: string;
  age?: number | null;
  healthConditions?: string[];
  dietaryPreferences?: string[];
  allergies?: string[];
  healthGoals?: string[];
}

interface AuthContextType {
  userProfile: UserProfile | null;
  userId: string;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<UserAuthResponse>;
  register: (params: RegisterParams) => Promise<UserAuthResponse>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  updateProfile: (profile: UserProfile) => Promise<UserProfile>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  userProfile: null,
  userId: "",
  token: null,
  isAuthenticated: false,
  isLoading: true,
  login: async () => { throw new Error("AuthProvider not mounted"); },
  register: async () => { throw new Error("AuthProvider not mounted"); },
  logout: async () => {},
  resetPassword: async () => {},
  updatePassword: async () => {},
  updateProfile: async () => DEFAULT_USER_PROFILE,
  refreshProfile: async () => {}
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userId, setUserIdState] = useState<string>("");
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Helper to extract or fetch a comprehensive UserProfile given a Supabase session
  const loadProfileForUser = async (user: any): Promise<UserProfile> => {
    const uid = user.id;
    const meta = user.user_metadata || {};

    let prof: UserProfile = {
      user_id: uid,
      email: user.email || "",
      full_name: meta.full_name || user.email?.split("@")[0] || "",
      age: meta.age !== undefined && meta.age !== null ? Number(meta.age) : null,
      health_conditions: meta.health_conditions || [],
      dietary_preferences: meta.dietary_preferences || [],
      allergies: meta.allergies || [],
      health_goals: meta.health_goals || []
    };

    // Try fetching existing profile row from Supabase user_profiles table
    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", uid)
        .maybeSingle();

      if (!error && data) {
        prof = {
          user_id: uid,
          email: user.email || data.email || "",
          full_name: data.full_name || prof.full_name,
          age: data.age !== undefined && data.age !== null ? Number(data.age) : prof.age,
          health_conditions: Array.isArray(data.health_conditions) ? data.health_conditions : prof.health_conditions,
          dietary_preferences: Array.isArray(data.dietary_preferences) ? data.dietary_preferences : prof.dietary_preferences,
          allergies: Array.isArray(data.allergies) ? data.allergies : prof.allergies,
          health_goals: Array.isArray(data.health_goals) ? data.health_goals : prof.health_goals,
        };
      }
    } catch (e) {
      console.warn("Notice reading Supabase user_profiles:", e);
    }

    return prof;
  };

  const handleSession = useCallback(async (session: any) => {
    if (session?.user) {
      const uid = session.user.id;
      const accessToken = session.access_token;
      setUserIdState(uid);
      setTokenState(accessToken);
      setActiveUserId(uid);
      setAuthToken(accessToken);

      // Check cached profile first for instant UI response
      const cached = getSavedUserProfile(uid);
      if (cached) {
        setUserProfile(cached);
      }

      // Fetch fresh profile from Supabase
      const freshProf = await loadProfileForUser(session.user);
      setUserProfile(freshProf);
      setSavedUserProfile(freshProf);
    } else {
      setUserIdState("");
      setUserProfile(null);
      setTokenState(null);
      clearAuthSession();
    }
    setIsLoading(false);
  }, []);

  // Listen to Supabase auth state changes and initial session
  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (isMounted) {
        handleSession(session);
      }
    }).catch(() => {
      if (isMounted) setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) {
        handleSession(session);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [handleSession]);

  // Login with Supabase
  const login = async (email: string, password: string): Promise<UserAuthResponse> => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password
      });

      if (error || !data.user || !data.session) {
        // Fallback: try logging in via backend API (handles users registered via backend or during Supabase rate limits)
        try {
          const beRes = await loginUser(email.trim(), password);
          if (beRes && beRes.success) {
            setUserIdState(beRes.user_id);
            setTokenState(beRes.token);
            setActiveUserId(beRes.user_id);
            setUserProfile(beRes.profile);
            setSavedUserProfile(beRes.profile);
            setAuthToken(beRes.token);
            return beRes;
          }
        } catch (beErr) {}
        throw new Error(error?.message || "Invalid email or password");
      }

      const uid = data.user.id;
      const accessToken = data.session.access_token;
      setUserIdState(uid);
      setTokenState(accessToken);
      setActiveUserId(uid);
      setAuthToken(accessToken);

      const prof = await loadProfileForUser(data.user);
      setUserProfile(prof);
      setSavedUserProfile(prof);

      // Best effort sync with backend store
      syncBackendProfile(prof).catch(() => {});

      return {
        success: true,
        user_id: uid,
        email: data.user.email || email,
        full_name: prof.full_name || "",
        token: accessToken,
        message: "Logged in successfully!",
        profile: prof
      };
    } finally {
      setIsLoading(false);
    }
  };

  // Register with Supabase
  const register = async (params: RegisterParams): Promise<UserAuthResponse> => {
    setIsLoading(true);
    try {
      const emailClean = params.email.trim();
      const meta = {
        full_name: params.fullName.trim(),
        age: params.age ?? null,
        health_conditions: params.healthConditions || [],
        dietary_preferences: params.dietaryPreferences || [],
        allergies: params.allergies || [],
        health_goals: params.healthGoals || []
      };

      const { data, error } = await supabase.auth.signUp({
        email: emailClean,
        password: params.password,
        options: {
          data: meta
        }
      });

      if (error) {
        // If Supabase hits its email rate limit (3 emails/hr on free tier built-in SMTP), seamlessly fallback to backend registration
        if (
          error.message?.toLowerCase().includes("rate limit") ||
          error.message?.toLowerCase().includes("too many requests") ||
          (error as any).status === 429
        ) {
          try {
            const beRes = await registerUser(
              emailClean,
              params.password,
              params.fullName.trim(),
              params.age ?? null,
              params.healthConditions || [],
              params.dietaryPreferences || [],
              params.allergies || [],
              params.healthGoals || []
            );
            setUserIdState(beRes.user_id);
            setUserProfile(beRes.profile);
            setTokenState(beRes.token);
            setActiveUserId(beRes.user_id);
            setSavedUserProfile(beRes.profile);
            setAuthToken(beRes.token);
            return beRes;
          } catch (beErr: any) {
            throw new Error(beErr.message || error.message);
          }
        }
        throw new Error(error.message);
      }

      if (!data.user) {
        throw new Error("Registration failed to create user account.");
      }

      const uid = data.user.id;
      const accessToken = data.session?.access_token || "nutrilens_session_active";

      const newProf: UserProfile = {
        user_id: uid,
        email: emailClean,
        full_name: params.fullName.trim(),
        age: params.age ?? null,
        health_conditions: params.healthConditions || [],
        dietary_preferences: params.dietaryPreferences || [],
        allergies: params.allergies || [],
        health_goals: params.healthGoals || []
      };

      // Persist in Supabase user_profiles table (with schema fallback)
      try {
        const fullPayload = {
          user_id: uid,
          email: emailClean,
          full_name: params.fullName.trim(),
          age: params.age ?? null,
          health_conditions: params.healthConditions || [],
          dietary_preferences: params.dietaryPreferences || [],
          allergies: params.allergies || [],
          health_goals: params.healthGoals || [],
          updated_at: new Date().toISOString()
        };
        const { error: upsertErr } = await supabase.from("user_profiles").upsert(fullPayload);
        if (upsertErr && (upsertErr.code === "PGRST204" || upsertErr.message?.includes("column"))) {
          // If remote table schema is missing age or health_conditions, fall back to base columns
          await supabase.from("user_profiles").upsert({
            user_id: uid,
            dietary_preferences: params.dietaryPreferences || [],
            allergies: params.allergies || [],
            health_goals: params.healthGoals || [],
            updated_at: new Date().toISOString()
          });
        }
      } catch (upsertErr) {
        console.warn("Notice: user_profiles table sync deferred (auth metadata is active):", upsertErr);
      }

      setUserIdState(uid);
      setUserProfile(newProf);
      setTokenState(accessToken);
      setActiveUserId(uid);
      setSavedUserProfile(newProf);
      setAuthToken(accessToken);

      // Best effort backend sync
      syncBackendProfile(newProf).catch(() => {});

      return {
        success: true,
        user_id: uid,
        email: emailClean,
        full_name: params.fullName.trim(),
        token: accessToken,
        message: "Account created successfully!",
        profile: newProf
      };
    } finally {
      setIsLoading(false);
    }
  };

  // Logout with Supabase
  const logout = async (): Promise<void> => {
    setIsLoading(true);
    try {
      await supabase.auth.signOut().catch(() => {});
      clearAuthSession();
      setUserIdState("");
      setUserProfile(null);
      setTokenState(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Password Reset Email
  const resetPassword = async (email: string): Promise<void> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    if (error) {
      throw new Error(error.message);
    }
  };

  // Update Password
  const updatePassword = async (newPassword: string): Promise<void> => {
    let supaSuccess = false;
    let supaErrorMsg: string | null = null;

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (!error) {
        supaSuccess = true;
      } else {
        supaErrorMsg = error.message;
      }
    } catch (err: any) {
      supaErrorMsg = err?.message || "Supabase session error";
    }

    // Always synchronize with backend database
    try {
      const activeId = userId || getActiveUserId() || "default_user";
      await updateBackendUserPassword(activeId, newPassword);
      return; // Backend update succeeded!
    } catch (beErr: any) {
      if (supaSuccess) {
        return; // Supabase succeeded, so update is accepted
      }
      throw new Error(supaErrorMsg || beErr?.message || "Failed to update password");
    }
  };

  // Update Profile
  const updateProfile = async (updated: UserProfile): Promise<UserProfile> => {
    const uid = updated.user_id || userId;
    const finalProfile: UserProfile = { ...updated, user_id: uid };

    // Update in Supabase user_profiles table (with schema fallback)
    try {
      const fullPayload = {
        user_id: uid,
        email: finalProfile.email,
        full_name: finalProfile.full_name,
        age: finalProfile.age ?? null,
        health_conditions: finalProfile.health_conditions,
        dietary_preferences: finalProfile.dietary_preferences,
        allergies: finalProfile.allergies,
        health_goals: finalProfile.health_goals,
        updated_at: new Date().toISOString()
      };
      const { error: upsertErr } = await supabase.from("user_profiles").upsert(fullPayload);
      if (upsertErr && (upsertErr.code === "PGRST204" || upsertErr.message?.includes("column"))) {
        // Fall back to base columns supported by current schema
        await supabase.from("user_profiles").upsert({
          user_id: uid,
          dietary_preferences: finalProfile.dietary_preferences,
          allergies: finalProfile.allergies,
          health_goals: finalProfile.health_goals,
          updated_at: new Date().toISOString()
        });
      }
    } catch (e) {
      console.warn("Notice: user_profiles table update deferred (auth metadata is active):", e);
    }

    // Update Supabase auth metadata
    try {
      await supabase.auth.updateUser({
        data: {
          full_name: finalProfile.full_name,
          age: finalProfile.age ?? null,
          health_conditions: finalProfile.health_conditions,
          dietary_preferences: finalProfile.dietary_preferences,
          allergies: finalProfile.allergies,
          health_goals: finalProfile.health_goals
        }
      });
    } catch (e) {
      console.warn("Supabase user metadata update notice:", e);
    }

    setUserProfile(finalProfile);
    setSavedUserProfile(finalProfile);

    // Sync to backend persistent store
    await syncBackendProfile(finalProfile).catch(() => {});
    return finalProfile;
  };

  // Refresh Profile
  const refreshProfile = async (): Promise<void> => {
    if (!userId) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const fresh = await loadProfileForUser(session.user);
        setUserProfile(fresh);
        setSavedUserProfile(fresh);
      }
    } catch (e) {
      console.warn("Could not refresh profile:", e);
    }
  };

  const isAuthenticated = Boolean(userId && userId !== "");

  return (
    <AuthContext.Provider
      value={{
        userProfile,
        userId,
        token,
        isAuthenticated,
        isLoading,
        login,
        register,
        logout,
        resetPassword,
        updatePassword,
        updateProfile,
        refreshProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
