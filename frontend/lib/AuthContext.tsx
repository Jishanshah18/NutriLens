import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
  UserProfile,
  UserAuthResponse,
  UserAccountInfo,
  getActiveUserId,
  setActiveUserId,
  getSavedUserProfile,
  setSavedUserProfile,
  getAuthToken,
  setAuthToken,
  clearAuthSession,
  loginUser,
  registerUser,
  logoutUser,
  getUserProfile,
  updateUserProfile,
  getUserList,
  DEFAULT_USER_PROFILE
} from "./api";

export interface RegisterParams {
  email: string;
  password: string;
  fullName: string;
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
  userList: UserAccountInfo[];
  login: (email: string, password: string) => Promise<UserAuthResponse>;
  register: (params: RegisterParams) => Promise<UserAuthResponse>;
  logout: () => Promise<void>;
  switchUser: (targetUserId: string) => Promise<void>;
  updateProfile: (profile: UserProfile) => Promise<UserProfile>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  userProfile: null,
  userId: "default_user",
  token: null,
  isAuthenticated: false,
  isLoading: true,
  userList: [],
  login: async () => { throw new Error("AuthProvider not mounted"); },
  register: async () => { throw new Error("AuthProvider not mounted"); },
  logout: async () => {},
  switchUser: async () => {},
  updateProfile: async () => DEFAULT_USER_PROFILE,
  refreshProfile: async () => {}
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userId, setUserIdState] = useState<string>("default_user");
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [userList, setUserList] = useState<UserAccountInfo[]>([]);

  // Initialize session on mount
  const initializeAuth = useCallback(async () => {
    setIsLoading(true);
    try {
      const activeUid = getActiveUserId();
      const existingToken = getAuthToken();
      setUserIdState(activeUid);
      setTokenState(existingToken);

      // Load profile (first from cache, then sync from server)
      const cached = getSavedUserProfile(activeUid);
      if (cached) {
        setUserProfile(cached);
      }

      try {
        const liveProfile = await getUserProfile(activeUid);
        if (liveProfile) {
          setUserProfile(liveProfile);
          setSavedUserProfile(liveProfile);
        }
      } catch (err) {
        // Fallback to cached or default
        if (!cached) {
          setUserProfile({ ...DEFAULT_USER_PROFILE, user_id: activeUid });
        }
      }

      // Fetch user list for quick account switching
      try {
        const list = await getUserList();
        setUserList(list);
      } catch (e) {}
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  // Login handler
  const login = async (email: string, password: string): Promise<UserAuthResponse> => {
    setIsLoading(true);
    try {
      const res = await loginUser(email, password);
      setUserIdState(res.user_id);
      setUserProfile(res.profile);
      setTokenState(res.token || "nutrilens_session_active");
      setActiveUserId(res.user_id);
      setSavedUserProfile(res.profile);
      if (res.token) {
        setAuthToken(res.token);
      }
      // Refresh user list
      getUserList().then(setUserList).catch(() => {});
      return res;
    } finally {
      setIsLoading(false);
    }
  };

  // Register handler
  const register = async (params: RegisterParams): Promise<UserAuthResponse> => {
    setIsLoading(true);
    try {
      const res = await registerUser(
        params.email,
        params.password,
        params.fullName,
        params.healthConditions || [],
        params.dietaryPreferences || [],
        params.allergies || [],
        params.healthGoals || []
      );
      setUserIdState(res.user_id);
      setUserProfile(res.profile);
      setTokenState(res.token || "nutrilens_session_active");
      setActiveUserId(res.user_id);
      setSavedUserProfile(res.profile);
      if (res.token) {
        setAuthToken(res.token);
      }
      getUserList().then(setUserList).catch(() => {});
      return res;
    } finally {
      setIsLoading(false);
    }
  };

  // Logout handler
  const logout = async (): Promise<void> => {
    setIsLoading(true);
    try {
      await logoutUser();
      clearAuthSession();
      setTokenState(null);
      // Reset to default demo profile
      const defaultProf = { ...DEFAULT_USER_PROFILE, user_id: "default_user" };
      setUserIdState("default_user");
      setUserProfile(defaultProf);
      setActiveUserId("default_user");
      setSavedUserProfile(defaultProf);
    } finally {
      setIsLoading(false);
    }
  };

  // Switch between demo or existing accounts
  const switchUser = async (targetUserId: string): Promise<void> => {
    setIsLoading(true);
    try {
      setActiveUserId(targetUserId);
      setUserIdState(targetUserId);
      setAuthToken("nutrilens_session_active");
      setTokenState("nutrilens_session_active");

      const prof = await getUserProfile(targetUserId);
      setUserProfile(prof);
      setSavedUserProfile(prof);
    } finally {
      setIsLoading(false);
    }
  };

  // Update profile handler
  const updateProfile = async (updated: UserProfile): Promise<UserProfile> => {
    const res = await updateUserProfile(updated);
    setUserProfile(res);
    return res;
  };

  // Refresh profile
  const refreshProfile = async (): Promise<void> => {
    try {
      const prof = await getUserProfile(userId);
      setUserProfile(prof);
      setSavedUserProfile(prof);
    } catch (e) {
      console.warn("Could not refresh profile:", e);
    }
  };

  const isAuthenticated = Boolean(token && userId && userId !== "guest");

  return (
    <AuthContext.Provider
      value={{
        userProfile,
        userId,
        token,
        isAuthenticated,
        isLoading,
        userList,
        login,
        register,
        logout,
        switchUser,
        updateProfile,
        refreshProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
