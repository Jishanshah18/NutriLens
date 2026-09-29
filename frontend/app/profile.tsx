import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, ScrollView, Switch, ActivityIndicator, TextInput, Modal, Alert } from "react-native";
import { useRouter } from "expo-router";
import {
  getUserProfile,
  updateUserProfile,
  getUserStats,
  getActiveUserId,
  setActiveUserId,
  getUserList,
  loginUser,
  registerUser,
  UserProfile,
  UserStatsResponse,
  UserAccountInfo
} from "../lib/api";
import { useTheme } from "../lib/ThemeContext";
import { useAuth } from "../lib/AuthContext";
import { BottomNav } from "../components/BottomNav";

const CORE_CONDITIONS = [
  { id: "Diabetes", name: "Diabetes", icon: "🩺", desc: "Monitors sugars, glycemic index, and refined carbs" },
  { id: "High Blood Pressure", name: "High Blood Pressure", icon: "🩸", desc: "Flags sodium, salt, and arterial tension factors" },
  { id: "High Cholesterol", name: "High Cholesterol", icon: "🧈", desc: "Flags saturated fats, palm oils, and lipid risks" },
  { id: "Obesity", name: "Obesity", icon: "⚖️", desc: "Monitors caloric density, empty sugars, and satiety index" },
  { id: "Heart-related conditions", name: "Heart-related conditions", icon: "🫀", desc: "Flags high sodium, trans fats, and ultra-processed additives" },
  { id: "Kidney-related conditions", name: "Kidney-related conditions", icon: "🫘", desc: "Monitors sodium, phosphates, and excessive protein" },
  { id: "Gluten intolerance", name: "Gluten intolerance", icon: "🌾", desc: "Flags wheat, barley, rye, and malt derivatives" },
  { id: "Lactose intolerance", name: "Lactose intolerance", icon: "🥛", desc: "Flags dairy, whey, cheese, and milk proteins" },
];

const EXTENDED_CONDITIONS = [
  "Celiac Disease",
  "Gout",
  "Acid Reflux / GERD",
  "Fatty Liver Disease"
];

const ALL_PREFERENCES = ["Vegan", "Keto", "Gluten-Free", "Low-Sodium", "Diabetic-Friendly", "Low Sugar", "Whole Food"];
const ALL_ALLERGIES = ["Peanuts", "Lactose Intolerant", "Gluten", "Soy", "Tree Nuts", "Shellfish", "Eggs"];
const ALL_GOALS = ["Weight Loss", "Muscle Gain", "Heart Health", "Diabetic Care", "Low Sugar", "Clean Purity"];

export default function ProfileScreen() {
  const router = useRouter();
  const { colors, isDark, toggleTheme } = useTheme();
  const { userProfile: authProfile, userId: authUserId, logout, isAuthenticated } = useAuth();

  const [activeId, setActiveId] = useState<string>(authUserId || "default_user");
  const [profile, setProfile] = useState<UserProfile>(
    authProfile || {
      user_id: "default_user",
      email: "jishan@nutrilens.ai",
      full_name: "Jishan Ahmed",
      health_conditions: ["Diabetes", "High Blood Pressure"],
      dietary_preferences: ["Low Sugar", "Diabetic-Friendly"],
      allergies: ["Peanuts", "Lactose Intolerant"],
      health_goals: ["Weight Loss", "Heart Health"]
    }
  );

  const [stats, setStats] = useState<UserStatsResponse | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Account switching / Auth Modal state
  const [userList, setUserList] = useState<UserAccountInfo[]>([]);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<"switch" | "login" | "register">("switch");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authFullName, setAuthFullName] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Custom condition state
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [customConditionInput, setCustomConditionInput] = useState("");

  useEffect(() => {
    if (authProfile) {
      setProfile(authProfile);
      setActiveId(authProfile.user_id || "default_user");
    }
  }, [authProfile]);

  useEffect(() => {
    const currentUid = getActiveUserId();
    setActiveId(currentUid);
    loadProfileAndStats(currentUid);
    getUserList().then(setUserList).catch(() => {});
  }, []);

  const loadProfileAndStats = async (uid: string) => {
    try {
      const [prof, st] = await Promise.all([
        getUserProfile(uid),
        getUserStats(uid)
      ]);
      if (prof) setProfile(prof);
      if (st) setStats(st);
    } catch (e) {
      console.warn("Notice loading user profile:", e);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setActiveId("default_user");
      await loadProfileAndStats("default_user");
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (e) {
      console.warn("Error logging out:", e);
    }
  };

  const switchAccount = async (targetUid: string) => {
    setActiveId(targetUid);
    setActiveUserId(targetUid);
    setShowAuthModal(false);
    await loadProfileAndStats(targetUid);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleLoginSubmit = async () => {
    if (!authEmail.trim() || !authPassword.trim()) {
      setAuthError("Please enter both email and password.");
      return;
    }
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await loginUser(authEmail, authPassword);
      setActiveId(res.user_id);
      setProfile(res.profile);
      setShowAuthModal(false);
      setAuthEmail("");
      setAuthPassword("");
      await loadProfileAndStats(res.user_id);
      getUserList().then(setUserList).catch(() => {});
    } catch (err: any) {
      setAuthError(err.message || "Failed to log in.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegisterSubmit = async () => {
    if (!authEmail.trim() || !authPassword.trim() || !authFullName.trim()) {
      setAuthError("Please fill out all registration fields.");
      return;
    }
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await registerUser(authEmail, authPassword, authFullName, ["Diabetes"]);
      setActiveId(res.user_id);
      setProfile(res.profile);
      setShowAuthModal(false);
      setAuthEmail("");
      setAuthPassword("");
      setAuthFullName("");
      await loadProfileAndStats(res.user_id);
      getUserList().then(setUserList).catch(() => {});
    } catch (err: any) {
      setAuthError(err.message || "Failed to create account.");
    } finally {
      setAuthLoading(false);
    }
  };

  // Toggle Health Condition
  const toggleHealthCondition = async (conditionName: string) => {
    const current = profile.health_conditions || [];
    const updated = current.includes(conditionName)
      ? current.filter((c) => c !== conditionName)
      : [...current, conditionName];

    const updatedProfile = { ...profile, health_conditions: updated };
    setProfile(updatedProfile);
    await persistProfile(updatedProfile);
  };

  // Add Custom Condition
  const addCustomCondition = async () => {
    const trimmed = customConditionInput.trim();
    if (!trimmed) return;
    const current = profile.health_conditions || [];
    if (!current.includes(trimmed)) {
      const updatedProfile = { ...profile, health_conditions: [...current, trimmed] };
      setProfile(updatedProfile);
      await persistProfile(updatedProfile);
    }
    setCustomConditionInput("");
    setShowAddCustom(false);
  };

  // Remove Condition
  const removeCondition = async (condName: string) => {
    const current = profile.health_conditions || [];
    const updatedProfile = { ...profile, health_conditions: current.filter((c) => c !== condName) };
    setProfile(updatedProfile);
    await persistProfile(updatedProfile);
  };

  // Generic toggle for dietary preferences, allergies, goals
  const toggleItem = async (category: "dietary_preferences" | "allergies" | "health_goals", item: string) => {
    const currentList = profile[category] || [];
    const updated = currentList.includes(item)
      ? currentList.filter((i) => i !== item)
      : [...currentList, item];

    const updatedProfile = { ...profile, [category]: updated };
    setProfile(updatedProfile);
    await persistProfile(updatedProfile);
  };

  const persistProfile = async (updatedProfile: UserProfile) => {
    setIsSaving(true);
    try {
      await updateUserProfile(updatedProfile);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2200);
    } catch (e) {
      console.warn("Notice saving profile:", e);
    } finally {
      setIsSaving(false);
    }
  };

  const selectedConditions = profile.health_conditions || [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Top Header */}
      <View style={{
        paddingTop: 44,
        paddingBottom: 14,
        paddingHorizontal: 20,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        borderBottomWidth: 1,
        borderBottomColor: colors.border
      }}>
        <Text style={{ fontSize: 22, fontWeight: "900", color: colors.text }}>
          User Account & Health Profile
        </Text>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {isSaving ? (
            <ActivityIndicator size="small" color={colors.emerald} />
          ) : saveSuccess ? (
            <View style={{ backgroundColor: `${colors.emerald}20`, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }}>
              <Text style={{ fontSize: 12, fontWeight: "800", color: colors.emerald }}>✓ Saved</Text>
            </View>
          ) : null}
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 60, gap: 20 }}>
        {/* User Account Card */}
        <View style={{
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 28,
          padding: 22,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.12,
          shadowRadius: 10,
          elevation: 3
        }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <View style={{
                width: 60,
                height: 60,
                borderRadius: 30,
                backgroundColor: `${colors.emerald}20`,
                borderWidth: 2.5,
                borderColor: colors.emerald,
                alignItems: "center",
                justifyContent: "center"
              }}>
                <Text style={{ fontSize: 30 }}>🥑</Text>
              </View>
              <View>
                <Text style={{ fontSize: 19, fontWeight: "900", color: colors.text }}>
                  {profile.full_name || "Active Member"}
                </Text>
                <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                  {profile.email || `${profile.user_id}@nutrilens.ai`}
                </Text>
                <View style={{
                  backgroundColor: `${colors.emerald}15`,
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 6,
                  alignSelf: "flex-start",
                  marginTop: 4
                }}>
                  <Text style={{ fontSize: 10, fontWeight: "800", color: colors.emerald }}>
                    ID: {profile.user_id}
                  </Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => {
                setAuthMode("switch");
                setShowAuthModal(true);
              }}
              style={{
                backgroundColor: colors.cardAlt,
                borderColor: colors.border,
                borderWidth: 1,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 14
              }}
            >
              <Text style={{ color: colors.emerald, fontSize: 12, fontWeight: "800" }}>
                Switch User 👤
              </Text>
            </TouchableOpacity>
          </View>

          {/* Account Quick Action Buttons (Log In, Sign Up, Log Out) */}
          <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
            <TouchableOpacity
              onPress={() => router.push("/login")}
              style={{
                flex: 1,
                backgroundColor: colors.cardAlt,
                borderColor: colors.border,
                borderWidth: 1,
                paddingVertical: 10,
                borderRadius: 14,
                alignItems: "center"
              }}
            >
              <Text style={{ color: colors.emerald, fontSize: 12, fontWeight: "800" }}>
                🔑 Sign In
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push("/signup")}
              style={{
                flex: 1,
                backgroundColor: `${colors.emerald}18`,
                borderColor: `${colors.emerald}50`,
                borderWidth: 1,
                paddingVertical: 10,
                borderRadius: 14,
                alignItems: "center"
              }}
            >
              <Text style={{ color: colors.emerald, fontSize: 12, fontWeight: "800" }}>
                ✨ Create Account
              </Text>
            </TouchableOpacity>

            {isAuthenticated && (
              <TouchableOpacity
                onPress={handleLogout}
                style={{
                  backgroundColor: `${colors.crimson}15`,
                  borderColor: `${colors.crimson}50`,
                  borderWidth: 1,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderRadius: 14,
                  alignItems: "center"
                }}
              >
                <Text style={{ color: colors.crimson, fontSize: 12, fontWeight: "800" }}>
                  Log Out
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Quick Active Conditions Summary Bar */}
          <View style={{
            marginTop: 18,
            paddingTop: 14,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between"
          }}>
            <View>
              <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textMuted, textTransform: "uppercase" }}>
                Active Disease Profile
              </Text>
              <Text style={{ fontSize: 13, fontWeight: "800", color: selectedConditions.length > 0 ? colors.emerald : colors.textMuted, marginTop: 2 }}>
                {selectedConditions.length > 0 ? selectedConditions.join(" • ") : "No Conditions Selected (General Wellness)"}
              </Text>
            </View>
          </View>
        </View>

        {/* SECTION 2: MY HEALTH CONDITIONS (PROMINENT CORE FEATURE) */}
        <View style={{
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderWidth: 1.5,
          borderRadius: 28,
          padding: 20,
          gap: 16,
          shadowColor: colors.emerald,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.08,
          shadowRadius: 10
        }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ fontSize: 20 }}>🩺</Text>
                <Text style={{ fontSize: 18, fontWeight: "900", color: colors.text }}>
                  My Health Conditions
                </Text>
              </View>
              <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4, lineHeight: 16 }}>
                Select your conditions. The AI scanner analyzes ingredients and nutrition specifically for these conditions.
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => setShowAddCustom((prev) => !prev)}
              style={{
                backgroundColor: `${colors.emerald}18`,
                borderColor: colors.emerald,
                borderWidth: 1,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 14
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: "800", color: colors.emerald }}>
                + Add Condition
              </Text>
            </TouchableOpacity>
          </View>

          {/* Add Custom Condition Input Drawer */}
          {showAddCustom && (
            <View style={{
              backgroundColor: colors.cardAlt,
              borderColor: colors.emerald,
              borderWidth: 1,
              borderRadius: 18,
              padding: 14,
              gap: 10
            }}>
              <Text style={{ fontSize: 12, fontWeight: "800", color: colors.text }}>
                Enter Condition or Dietary Diagnosis:
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TextInput
                  value={customConditionInput}
                  onChangeText={setCustomConditionInput}
                  placeholder="e.g. Celiac disease, Gout, GERD..."
                  placeholderTextColor={colors.textMuted}
                  style={{
                    flex: 1,
                    backgroundColor: colors.bg,
                    borderColor: colors.border,
                    borderWidth: 1,
                    borderRadius: 12,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    color: colors.text,
                    fontSize: 13
                  }}
                />
                <TouchableOpacity
                  onPress={addCustomCondition}
                  style={{
                    backgroundColor: colors.emerald,
                    paddingHorizontal: 16,
                    borderRadius: 12,
                    justifyContent: "center"
                  }}
                >
                  <Text style={{ color: "#FFF", fontWeight: "800", fontSize: 13 }}>Add</Text>
                </TouchableOpacity>
              </View>

              {/* Quick suggestions */}
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                {EXTENDED_CONDITIONS.map((ext) => (
                  <TouchableOpacity
                    key={ext}
                    onPress={() => {
                      setCustomConditionInput(ext);
                    }}
                    style={{
                      backgroundColor: colors.bg,
                      borderColor: colors.border,
                      borderWidth: 1,
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 10
                    }}
                  >
                    <Text style={{ fontSize: 11, color: colors.textMuted }}>+ {ext}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Selected Conditions Visual Status Box */}
          <View style={{
            backgroundColor: colors.cardAlt,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 18,
            padding: 14
          }}>
            <Text style={{ fontSize: 12, fontWeight: "800", color: colors.textMuted, textTransform: "uppercase", marginBottom: 8 }}>
              Current Profile Status
            </Text>
            {selectedConditions.length === 0 ? (
              <Text style={{ fontSize: 13, color: colors.textMuted, fontStyle: "italic" }}>
                No health conditions currently active. Scans will evaluate for general nutritional wellness.
              </Text>
            ) : (
              <View style={{ gap: 6 }}>
                {selectedConditions.map((cond) => (
                  <View
                    key={cond}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingVertical: 4
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={{ color: colors.emerald, fontWeight: "900", fontSize: 15 }}>✓</Text>
                      <Text style={{ fontSize: 14, fontWeight: "800", color: colors.text }}>{cond}</Text>
                    </View>
                    <TouchableOpacity onPress={() => removeCondition(cond)}>
                      <Text style={{ color: colors.crimson, fontSize: 12, fontWeight: "700" }}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Interactive Core Conditions Grid */}
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 13, fontWeight: "800", color: colors.text }}>
              Tap to Select / Deselect Health Conditions:
            </Text>

            {CORE_CONDITIONS.map((cond) => {
              const isSelected = selectedConditions.includes(cond.name);
              return (
                <TouchableOpacity
                  key={cond.id}
                  onPress={() => toggleHealthCondition(cond.name)}
                  activeOpacity={0.8}
                  style={{
                    backgroundColor: isSelected ? `${colors.emerald}15` : colors.cardAlt,
                    borderColor: isSelected ? colors.emerald : colors.border,
                    borderWidth: isSelected ? 2 : 1,
                    borderRadius: 18,
                    padding: 14,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between"
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
                    <Text style={{ fontSize: 24 }}>{cond.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{
                        fontSize: 15,
                        fontWeight: "800",
                        color: isSelected ? colors.emerald : colors.text
                      }}>
                        {cond.name}
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                        {cond.desc}
                      </Text>
                    </View>
                  </View>

                  {/* Status Indicator Badge */}
                  <View style={{
                    backgroundColor: isSelected ? colors.emerald : `${colors.textMuted}20`,
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    alignItems: "center",
                    justifyContent: "center"
                  }}>
                    <Text style={{
                      color: isSelected ? "#FFF" : colors.textMuted,
                      fontWeight: "900",
                      fontSize: 14
                    }}>
                      {isSelected ? "✓" : "✗"}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Explicit Manual Save Button */}
          <TouchableOpacity
            onPress={() => persistProfile(profile)}
            disabled={isSaving}
            style={{
              backgroundColor: colors.emerald,
              paddingVertical: 14,
              borderRadius: 18,
              alignItems: "center",
              marginTop: 6,
              shadowColor: colors.emerald,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.25,
              shadowRadius: 8
            }}
          >
            {isSaving ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={{ color: "#FFF", fontSize: 14, fontWeight: "900" }}>
                ✓ Save Health Conditions to Account
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Dietary Preferences Selector */}
        <View style={{
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 24,
          padding: 18,
          gap: 12
        }}>
          <View>
            <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text }}>Dietary Preferences</Text>
            <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
              Foods not aligning will receive score adjustments
            </Text>
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {ALL_PREFERENCES.map((pref) => {
              const isSelected = profile.dietary_preferences.includes(pref);
              return (
                <TouchableOpacity
                  key={pref}
                  onPress={() => toggleItem("dietary_preferences", pref)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 16,
                    backgroundColor: isSelected ? colors.emerald : colors.cardAlt,
                    borderWidth: 1,
                    borderColor: isSelected ? colors.emerald : colors.border
                  }}
                >
                  <Text style={{
                    fontSize: 12,
                    fontWeight: isSelected ? "800" : "600",
                    color: isSelected ? "#FFF" : colors.text
                  }}>
                    {isSelected ? "✓ " : ""}{pref}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Allergies & Intolerances Selector */}
        <View style={{
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 24,
          padding: 18,
          gap: 12
        }}>
          <View>
            <Text style={{ fontSize: 16, fontWeight: "800", color: colors.crimson }}>
              Allergies & Allergen Triggers
            </Text>
            <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
              Triggers instant high-priority warnings on detected products
            </Text>
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {ALL_ALLERGIES.map((al) => {
              const isSelected = profile.allergies.includes(al);
              return (
                <TouchableOpacity
                  key={al}
                  onPress={() => toggleItem("allergies", al)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 16,
                    backgroundColor: isSelected ? colors.crimson : colors.cardAlt,
                    borderWidth: 1,
                    borderColor: isSelected ? colors.crimson : colors.border
                  }}
                >
                  <Text style={{
                    fontSize: 12,
                    fontWeight: isSelected ? "800" : "600",
                    color: isSelected ? "#FFF" : colors.text
                  }}>
                    {isSelected ? "⚠️ " : ""}{al}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Health Goals Selector */}
        <View style={{
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 24,
          padding: 18,
          gap: 12
        }}>
          <View>
            <Text style={{ fontSize: 16, fontWeight: "800", color: colors.blue }}>
              Nutritional Health Goals
            </Text>
            <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
              Used by the AI engine to generate personalized verdicts
            </Text>
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {ALL_GOALS.map((goal) => {
              const isSelected = profile.health_goals.includes(goal);
              return (
                <TouchableOpacity
                  key={goal}
                  onPress={() => toggleItem("health_goals", goal)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 16,
                    backgroundColor: isSelected ? colors.blue : colors.cardAlt,
                    borderWidth: 1,
                    borderColor: isSelected ? colors.blue : colors.border
                  }}
                >
                  <Text style={{
                    fontSize: 12,
                    fontWeight: isSelected ? "800" : "600",
                    color: isSelected ? "#FFF" : colors.text
                  }}>
                    {isSelected ? "🎯 " : ""}{goal}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Theme Settings Toggle Card */}
        <View style={{
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 24,
          padding: 18,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between"
        }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Text style={{ fontSize: 24 }}>{isDark ? "🌙" : "☀️"}</Text>
            <View>
              <Text style={{ fontSize: 15, fontWeight: "800", color: colors.text }}>Dark Mode Theme</Text>
              <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                {isDark ? "Deep Obsidian Active" : "Clean Crisp Light Active"}
              </Text>
            </View>
          </View>

          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            trackColor={{ false: "#CBD5E1", true: colors.emerald }}
            thumbColor="#FFFFFF"
          />
        </View>
      </ScrollView>

      {/* Account Switching & Auth Modal */}
      <Modal visible={showAuthModal} transparent animationType="slide">
        <View style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.75)",
          justifyContent: "flex-end"
        }}>
          <View style={{
            backgroundColor: colors.card,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            padding: 24,
            maxHeight: "85%",
            borderWidth: 1,
            borderColor: colors.border
          }}>
            {/* Modal Header */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: "900", color: colors.text }}>
                {authMode === "switch" ? "Switch User Profile" : authMode === "login" ? "Login to Account" : "Create New Account"}
              </Text>
              <TouchableOpacity onPress={() => setShowAuthModal(false)}>
                <Text style={{ fontSize: 18, color: colors.textMuted, padding: 4 }}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Mode Tabs */}
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 18 }}>
              <TouchableOpacity
                onPress={() => setAuthMode("switch")}
                style={{
                  flex: 1,
                  paddingVertical: 8,
                  borderRadius: 12,
                  backgroundColor: authMode === "switch" ? colors.emerald : colors.cardAlt,
                  alignItems: "center"
                }}
              >
                <Text style={{ color: authMode === "switch" ? "#FFF" : colors.textMuted, fontWeight: "800", fontSize: 12 }}>
                  Profiles
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setAuthMode("login")}
                style={{
                  flex: 1,
                  paddingVertical: 8,
                  borderRadius: 12,
                  backgroundColor: authMode === "login" ? colors.emerald : colors.cardAlt,
                  alignItems: "center"
                }}
              >
                <Text style={{ color: authMode === "login" ? "#FFF" : colors.textMuted, fontWeight: "800", fontSize: 12 }}>
                  Log In
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setAuthMode("register")}
                style={{
                  flex: 1,
                  paddingVertical: 8,
                  borderRadius: 12,
                  backgroundColor: authMode === "register" ? colors.emerald : colors.cardAlt,
                  alignItems: "center"
                }}
              >
                <Text style={{ color: authMode === "register" ? "#FFF" : colors.textMuted, fontWeight: "800", fontSize: 12 }}>
                  Register
                </Text>
              </TouchableOpacity>
            </View>

            {authError && (
              <View style={{ backgroundColor: `${colors.crimson}20`, padding: 10, borderRadius: 12, marginBottom: 14 }}>
                <Text style={{ color: colors.crimson, fontSize: 12, fontWeight: "700" }}>{authError}</Text>
              </View>
            )}

            {/* Mode 1: Quick Switch Accounts */}
            {authMode === "switch" && (
              <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={{ gap: 10 }}>
                <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: 4 }}>
                  Select an account to test condition-specific AI recommendations:
                </Text>

                {userList.map((u) => {
                  const isCurrent = u.id === activeId;
                  return (
                    <TouchableOpacity
                      key={u.id}
                      onPress={() => switchAccount(u.id)}
                      style={{
                        backgroundColor: isCurrent ? `${colors.emerald}15` : colors.cardAlt,
                        borderColor: isCurrent ? colors.emerald : colors.border,
                        borderWidth: isCurrent ? 2 : 1,
                        borderRadius: 16,
                        padding: 14,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between"
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontWeight: "800", color: isCurrent ? colors.emerald : colors.text }}>
                          {u.full_name || u.id}
                        </Text>
                        <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                          {u.email}
                        </Text>
                        <Text style={{ fontSize: 11, color: colors.emerald, fontWeight: "700", marginTop: 4 }}>
                          Conditions: {u.health_conditions?.length ? u.health_conditions.join(", ") : "None (General)"}
                        </Text>
                      </View>
                      {isCurrent && (
                        <View style={{ backgroundColor: colors.emerald, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                          <Text style={{ color: "#FFF", fontSize: 11, fontWeight: "900" }}>Active</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {/* Mode 2: Log In */}
            {authMode === "login" && (
              <View style={{ gap: 12 }}>
                <TextInput
                  value={authEmail}
                  onChangeText={setAuthEmail}
                  placeholder="Email or user_id (e.g. jishan@nutrilens.ai)"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  style={{
                    backgroundColor: colors.cardAlt,
                    borderColor: colors.border,
                    borderWidth: 1,
                    borderRadius: 14,
                    padding: 12,
                    color: colors.text
                  }}
                />
                <TextInput
                  value={authPassword}
                  onChangeText={setAuthPassword}
                  placeholder="Password"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry
                  style={{
                    backgroundColor: colors.cardAlt,
                    borderColor: colors.border,
                    borderWidth: 1,
                    borderRadius: 14,
                    padding: 12,
                    color: colors.text
                  }}
                />
                <TouchableOpacity
                  onPress={handleLoginSubmit}
                  disabled={authLoading}
                  style={{
                    backgroundColor: colors.emerald,
                    paddingVertical: 14,
                    borderRadius: 16,
                    alignItems: "center",
                    marginTop: 6
                  }}
                >
                  {authLoading ? <ActivityIndicator color="#FFF" /> : (
                    <Text style={{ color: "#FFF", fontWeight: "900", fontSize: 14 }}>Log In</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* Mode 3: Register */}
            {authMode === "register" && (
              <View style={{ gap: 12 }}>
                <TextInput
                  value={authFullName}
                  onChangeText={setAuthFullName}
                  placeholder="Full Name (e.g. Alex Morgan)"
                  placeholderTextColor={colors.textMuted}
                  style={{
                    backgroundColor: colors.cardAlt,
                    borderColor: colors.border,
                    borderWidth: 1,
                    borderRadius: 14,
                    padding: 12,
                    color: colors.text
                  }}
                />
                <TextInput
                  value={authEmail}
                  onChangeText={setAuthEmail}
                  placeholder="Email address"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={{
                    backgroundColor: colors.cardAlt,
                    borderColor: colors.border,
                    borderWidth: 1,
                    borderRadius: 14,
                    padding: 12,
                    color: colors.text
                  }}
                />
                <TextInput
                  value={authPassword}
                  onChangeText={setAuthPassword}
                  placeholder="Create Password"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry
                  style={{
                    backgroundColor: colors.cardAlt,
                    borderColor: colors.border,
                    borderWidth: 1,
                    borderRadius: 14,
                    padding: 12,
                    color: colors.text
                  }}
                />
                <TouchableOpacity
                  onPress={handleRegisterSubmit}
                  disabled={authLoading}
                  style={{
                    backgroundColor: colors.emerald,
                    paddingVertical: 14,
                    borderRadius: 16,
                    alignItems: "center",
                    marginTop: 6
                  }}
                >
                  {authLoading ? <ActivityIndicator color="#FFF" /> : (
                    <Text style={{ color: "#FFF", fontWeight: "900", fontSize: 14 }}>Create Account</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Global Bottom Navigation */}
      <BottomNav />
    </View>
  );
}

