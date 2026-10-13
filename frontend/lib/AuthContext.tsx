import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
  auth,
  googleProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  signInWithPopup,
  updateProfile as updateFirebaseProfile,
  onAuthStateChanged,
  FirebaseUser,
  getFriendlyFirebaseErrorMessage,
  isFirebaseConfigured
} from "./firebase";
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
  syncFirebaseUserWithBackend,
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
  isEmailVerified: boolean;
  firebaseUser: FirebaseUser | null;
  isFirebaseReady: boolean;
  login: (email: string, password: string) => Promise<UserAuthResponse>;
  register: (params: RegisterParams) => Promise<UserAuthResponse>;
  loginWithGoogle: () => Promise<UserAuthResponse>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  resendEmailVerification: () => Promise<void>;
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
  isEmailVerified: false,
  firebaseUser: null,
  isFirebaseReady: false,
  login: async () => { throw new Error("AuthProvider not mounted"); },
  register: async () => { throw new Error("AuthProvider not mounted"); },
  loginWithGoogle: async () => { throw new Error("AuthProvider not mounted"); },
  logout: async () => {},
  resetPassword: async () => {},
  resendEmailVerification: async () => {},
  updatePassword: async () => {},
  updateProfile: async () => DEFAULT_USER_PROFILE,
  refreshProfile: async () => {}
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userId, setUserIdState] = useState<string>("");
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [firebaseUser, setFirebaseUserState] = useState<FirebaseUser | null>(null);
  const [isEmailVerified, setIsEmailVerified] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const isFirebaseReady = isFirebaseConfigured();

  // Helper to fetch/sync profile from Supabase user_profiles table (preserves cloud Supabase data)
  const syncSupabaseProfile = async (uid: string, fallbackProf: UserProfile): Promise<UserProfile> => {
    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", uid)
        .maybeSingle();

      if (!error && data) {
        return {
          user_id: uid,
          email: fallbackProf.email,
          full_name: fallbackProf.full_name,
          age: data.age !== undefined && data.age !== null ? Number(data.age) : fallbackProf.age,
          health_conditions: Array.isArray(data.health_conditions) && data.health_conditions.length > 0
            ? data.health_conditions
            : fallbackProf.health_conditions,
          dietary_preferences: Array.isArray(data.dietary_preferences) && data.dietary_preferences.length > 0
            ? data.dietary_preferences
            : fallbackProf.dietary_preferences,
          allergies: Array.isArray(data.allergies) && data.allergies.length > 0
            ? data.allergies
            : fallbackProf.allergies,
          health_goals: Array.isArray(data.health_goals) && data.health_goals.length > 0
            ? data.health_goals
            : fallbackProf.health_goals,
        };
      }
    } catch (e) {
      console.warn("Notice reading Supabase user_profiles:", e);
    }
    return fallbackProf;
  };

  // Synchronize authenticated Firebase session with local cache, backend SQLite, and Supabase
  const handleFirebaseUser = useCallback(async (user: FirebaseUser | null) => {
    if (user) {
      const uid = user.uid;
      const email = user.email || "";
      const fullName = user.displayName || email.split("@")[0] || "NutriLens Member";
      const verified = user.emailVerified;

      let idToken = "";
      try {
        idToken = await user.getIdToken();
      } catch (tokErr) {
        idToken = "nutrilens_session_active";
      }

      setUserIdState(uid);
      setFirebaseUserState(user);
      setIsEmailVerified(verified);
      setTokenState(idToken);
      setActiveUserId(uid);
      setAuthToken(idToken);

      // Fast optimistic UI restore from local cache
      const cached = getSavedUserProfile(uid);
      if (cached) {
        setUserProfile(cached);
      }

      // Sync with NutriLens backend (preserves existing Supabase & SQLite scan history)
      try {
        const syncRes = await syncFirebaseUserWithBackend(uid, email, fullName, idToken);
        if (syncRes && syncRes.profile) {
          let resolvedProfile = syncRes.profile;

          // Merge with any Supabase cloud preferences
          resolvedProfile = await syncSupabaseProfile(uid, resolvedProfile);

          setUserProfile(resolvedProfile);
          setSavedUserProfile(resolvedProfile);
        }
      } catch (beErr) {
        console.warn("Backend sync notice:", beErr);
        // Fallback default profile if backend is starting up
        const baseProf: UserProfile = cached || {
          ...DEFAULT_USER_PROFILE,
          user_id: uid,
          email,
          full_name: fullName
        };
        setUserProfile(baseProf);
        setSavedUserProfile(baseProf);
      }
    } else {
      // Unauthenticated state
      setUserIdState("");
      setFirebaseUserState(null);
      setIsEmailVerified(false);
      setUserProfile(null);
      setTokenState(null);
      clearAuthSession();
    }
    setIsLoading(false);
  }, []);

  // Listen to Firebase auth state changes
  useEffect(() => {
    let isMounted = true;

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (isMounted) {
        handleFirebaseUser(user);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [handleFirebaseUser]);

  // Firebase Email/Password Login
  const login = async (email: string, password: string): Promise<UserAuthResponse> => {
    setIsLoading(true);
    const cleanEmail = email.trim();

    try {
      const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
      const user = cred.user;
      const idToken = await user.getIdToken();
      const uid = user.uid;

      // Sync identity with backend persistent database
      const syncRes = await syncFirebaseUserWithBackend(
        uid,
        cleanEmail,
        user.displayName || cleanEmail.split("@")[0],
        idToken
      );

      const resolved = await syncSupabaseProfile(uid, syncRes.profile);
      setUserProfile(resolved);
      setSavedUserProfile(resolved);
      setUserIdState(uid);
      setTokenState(idToken);
      setIsEmailVerified(user.emailVerified);

      return {
        ...syncRes,
        profile: resolved
      };
    } catch (err: any) {
      const friendlyMsg = getFriendlyFirebaseErrorMessage(err);
      throw new Error(friendlyMsg);
    } finally {
      setIsLoading(false);
    }
  };

  // Firebase Email/Password Sign Up with Email Verification
  const register = async (params: RegisterParams): Promise<UserAuthResponse> => {
    setIsLoading(true);
    const cleanEmail = params.email.trim();
    const cleanName = params.fullName.trim();

    try {
      const cred = await createUserWithEmailAndPassword(auth, cleanEmail, params.password);
      const user = cred.user;

      // Update Firebase user profile display name
      try {
        await updateFirebaseProfile(user, { displayName: cleanName });
      } catch (pErr) {
        console.warn("Could not set displayName on Firebase user:", pErr);
      }

      // Send Firebase Email Verification
      try {
        await sendEmailVerification(user);
      } catch (evErr) {
        console.warn("Could not dispatch verification email:", evErr);
      }

      const idToken = await user.getIdToken();
      const uid = user.uid;

      const newProf: UserProfile = {
        user_id: uid,
        email: cleanEmail,
        full_name: cleanName,
        age: params.age ?? null,
        health_conditions: params.healthConditions || [],
        dietary_preferences: params.dietaryPreferences || [],
        allergies: params.allergies || [],
        health_goals: params.healthGoals || []
      };

      // 1. Sync and persist in backend SQLite
      try {
        await syncBackendProfile(newProf);
      } catch (e) {}

      // 2. Persist in Supabase user_profiles table (with schema fallback)
      try {
        const fullPayload = {
          user_id: uid,
          email: cleanEmail,
          full_name: cleanName,
          dietary_preferences: params.dietaryPreferences || [],
          allergies: params.allergies || [],
          health_goals: params.healthGoals || [],
          updated_at: new Date().toISOString()
        };
        const { error: upsertErr } = await supabase.from("user_profiles").upsert(fullPayload);
        if (upsertErr && (upsertErr.code === "PGRST204" || upsertErr.message?.includes("column"))) {
          await supabase.from("user_profiles").upsert({
            user_id: uid,
            dietary_preferences: params.dietaryPreferences || [],
            allergies: params.allergies || [],
            health_goals: params.healthGoals || [],
            updated_at: new Date().toISOString()
          });
        }
      } catch (upsertErr) {
        console.warn("Supabase profile save notice:", upsertErr);
      }

      setUserIdState(uid);
      setUserProfile(newProf);
      setTokenState(idToken);
      setIsEmailVerified(user.emailVerified);
      setActiveUserId(uid);
      setSavedUserProfile(newProf);
      setAuthToken(idToken);

      return {
        success: true,
        user_id: uid,
        email: cleanEmail,
        full_name: cleanName,
        token: idToken,
        message: "Account created successfully! Please verify your email.",
        profile: newProf
      };
    } catch (err: any) {
      const friendlyMsg = getFriendlyFirebaseErrorMessage(err);
      throw new Error(friendlyMsg);
    } finally {
      setIsLoading(false);
    }
  };

  // Google Sign-In with Firebase
  const loginWithGoogle = async (): Promise<UserAuthResponse> => {
    setIsLoading(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const user = cred.user;
      const idToken = await user.getIdToken();
      const uid = user.uid;
      const email = user.email || "";
      const fullName = user.displayName || email.split("@")[0] || "NutriLens Member";

      // Sync identity with backend persistent database
      const syncRes = await syncFirebaseUserWithBackend(uid, email, fullName, idToken);
      const resolved = await syncSupabaseProfile(uid, syncRes.profile);

      setUserProfile(resolved);
      setSavedUserProfile(resolved);
      setUserIdState(uid);
      setTokenState(idToken);
      setIsEmailVerified(user.emailVerified);

      return {
        ...syncRes,
        profile: resolved
      };
    } catch (err: any) {
      const friendlyMsg = getFriendlyFirebaseErrorMessage(err);
      throw new Error(friendlyMsg);
    } finally {
      setIsLoading(false);
    }
  };

  // Resend Email Verification link
  const resendEmailVerification = async (): Promise<void> => {
    if (!auth.currentUser) {
      throw new Error("No active user session to send verification email to.");
    }
    try {
      await sendEmailVerification(auth.currentUser);
    } catch (err: any) {
      throw new Error(getFriendlyFirebaseErrorMessage(err));
    }
  };

  // Logout with Firebase
  const logout = async (): Promise<void> => {
    setIsLoading(true);
    try {
      await signOut(auth).catch(() => {});
      clearAuthSession();
      setUserIdState("");
      setUserProfile(null);
      setTokenState(null);
      setFirebaseUserState(null);
      setIsEmailVerified(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Firebase Password Reset Email
  const resetPassword = async (email: string): Promise<void> => {
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch (err: any) {
      throw new Error(getFriendlyFirebaseErrorMessage(err));
    }
  };

  // Update Password (Firebase user + Backend sync)
  const updatePassword = async (newPassword: string): Promise<void> => {
    let fbSuccess = false;
    let fbErrorMsg: string | null = null;

    if (auth.currentUser) {
      try {
        const { updatePassword: updateFbPass } = await import("firebase/auth");
        await updateFbPass(auth.currentUser, newPassword);
        fbSuccess = true;
      } catch (err: any) {
        fbErrorMsg = getFriendlyFirebaseErrorMessage(err);
      }
    }

    // Always synchronize with backend database
    try {
      const activeId = userId || getActiveUserId() || "default_user";
      await updateBackendUserPassword(activeId, newPassword);
      return;
    } catch (beErr: any) {
      if (fbSuccess) return;
      throw new Error(fbErrorMsg || beErr?.message || "Failed to update password");
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
        await supabase.from("user_profiles").upsert({
          user_id: uid,
          dietary_preferences: finalProfile.dietary_preferences,
          allergies: finalProfile.allergies,
          health_goals: finalProfile.health_goals,
          updated_at: new Date().toISOString()
        });
      }
    } catch (e) {
      console.warn("Notice: user_profiles table update deferred:", e);
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
      const fresh = await syncFirebaseUserWithBackend(
        userId,
        userProfile?.email,
        userProfile?.full_name,
        token || undefined
      );
      if (fresh && fresh.profile) {
        const merged = await syncSupabaseProfile(userId, fresh.profile);
        setUserProfile(merged);
        setSavedUserProfile(merged);
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
        isEmailVerified,
        firebaseUser,
        isFirebaseReady,
        login,
        register,
        loginWithGoogle,
        logout,
        resetPassword,
        resendEmailVerification,
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
