import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, ScrollView, Switch, ActivityIndicator, TextInput, Alert, Platform } from "react-native";
import { useRouter } from "expo-router";
import {
  getUserProfile,
  getUserStats,
  UserProfile,
  UserStatsResponse
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
  const {
    userProfile: authProfile,
    userId,
    logout,
    updateProfile,
    updatePassword,
    isAuthenticated
  } = useAuth();

  const [profile, setProfile] = useState<UserProfile>(
    authProfile || {
      user_id: userId || "",
      email: "",
      full_name: "",
      age: null,
      health_conditions: [],
      dietary_preferences: [],
      allergies: [],
      health_goals: []
    }
  );

  const [stats, setStats] = useState<UserStatsResponse | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Age state
  const [ageInput, setAgeInput] = useState<string>(
    authProfile?.age !== undefined && authProfile?.age !== null ? String(authProfile.age) : ""
  );
  const [ageSaving, setAgeSaving] = useState(false);
  const [ageSuccess, setAgeSuccess] = useState(false);
  const [ageError, setAgeError] = useState<string | null>(null);

  // Password Change state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [showPasswordSection, setShowPasswordSection] = useState(false);

  // Custom condition state
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [customConditionInput, setCustomConditionInput] = useState("");

  // Custom preference state
  const [showAddPref, setShowAddPref] = useState(false);
  const [customPrefInput, setCustomPrefInput] = useState("");

  // Custom allergy state
  const [showAddAllergy, setShowAddAllergy] = useState(false);
  const [customAllergyInput, setCustomAllergyInput] = useState("");

  // Custom goal state
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [customGoalInput, setCustomGoalInput] = useState("");

  useEffect(() => {
    if (authProfile) {
      setProfile(authProfile);
      if (authProfile.age !== undefined && authProfile.age !== null) {
        setAgeInput(String(authProfile.age));
      }
    }
  }, [authProfile]);

  useEffect(() => {
    if (userId) {
      getUserStats(userId).then(setStats).catch(() => {});
    }
  }, [userId]);

  const handleLogout = async () => {
    try {
      await logout();
      router.replace("/login");
    } catch (e) {
      console.warn("Error logging out:", e);
    }
  };

  const persistProfile = async (updatedProfile: UserProfile) => {
    setIsSaving(true);
    try {
      await updateProfile(updatedProfile);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2200);
    } catch (e) {
      console.warn("Notice saving profile:", e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAge = async () => {
    setAgeError(null);
    const parsed = ageInput.trim() ? parseInt(ageInput.trim(), 10) : null;
    if (parsed !== null && (isNaN(parsed) || parsed < 1 || parsed > 120)) {
      setAgeError("Please enter a valid age between 1 and 120.");
      return;
    }

    setAgeSaving(true);
    try {
      const updated = { ...profile, age: parsed };
      setProfile(updated);
      await updateProfile(updated);
      setAgeSuccess(true);
      setTimeout(() => setAgeSuccess(false), 2200);
    } catch (err: any) {
      setAgeError(err.message || "Failed to update age.");
    } finally {
      setAgeSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordError(null);
    if (!newPassword || newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }

    setPasswordLoading(true);
    try {
      await updatePassword(newPassword);
      setPasswordSuccess(true);
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (err: any) {
      setPasswordError(err.message || "Failed to update password.");
    } finally {
      setPasswordLoading(false);
    }
  };

  // Toggle Health Condition
  const toggleCondition = async (condId: string) => {
    const current = profile.health_conditions || [];
    const isAlreadySelected = current.includes(condId);
    const updatedConditions = isAlreadySelected
      ? current.filter((c) => c !== condId)
      : [...current, condId];

    const updatedProfile = { ...profile, health_conditions: updatedConditions };
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
      setCustomConditionInput("");
      setShowAddCustom(false);
      await persistProfile(updatedProfile);
    } else {
      setCustomConditionInput("");
      setShowAddCustom(false);
    }
  };

  // Add Custom Preference
  const addCustomPreference = async () => {
    const trimmed = customPrefInput.trim();
    if (!trimmed) return;
    const current = profile.dietary_preferences || [];
    if (!current.includes(trimmed)) {
      const updatedProfile = { ...profile, dietary_preferences: [...current, trimmed] };
      setProfile(updatedProfile);
      setCustomPrefInput("");
      setShowAddPref(false);
      await persistProfile(updatedProfile);
    } else {
      setCustomPrefInput("");
      setShowAddPref(false);
    }
  };

  // Add Custom Allergy
  const addCustomAllergy = async () => {
    const trimmed = customAllergyInput.trim();
    if (!trimmed) return;
    const current = profile.allergies || [];
    if (!current.includes(trimmed)) {
      const updatedProfile = { ...profile, allergies: [...current, trimmed] };
      setProfile(updatedProfile);
      setCustomAllergyInput("");
      setShowAddAllergy(false);
      await persistProfile(updatedProfile);
    } else {
      setCustomAllergyInput("");
      setShowAddAllergy(false);
    }
  };

  // Add Custom Goal
  const addCustomGoal = async () => {
    const trimmed = customGoalInput.trim();
    if (!trimmed) return;
    const current = profile.health_goals || [];
    if (!current.includes(trimmed)) {
      const updatedProfile = { ...profile, health_goals: [...current, trimmed] };
      setProfile(updatedProfile);
      setCustomGoalInput("");
      setShowAddGoal(false);
      await persistProfile(updatedProfile);
    } else {
      setCustomGoalInput("");
      setShowAddGoal(false);
    }
  };

  // Remove custom item from any profile category
  const removeCustomItem = async (
    category: "health_conditions" | "dietary_preferences" | "allergies" | "health_goals",
    item: string
  ) => {
    const current = profile[category] || [];
    const updated = current.filter((i) => i !== item);
    const updatedProfile = { ...profile, [category]: updated };
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

  const selectedConditions = profile.health_conditions || [];
  const coreIds = CORE_CONDITIONS.map((c) => c.id);
  const customConditions = selectedConditions.filter((c) => !coreIds.includes(c));

  const allPrefs = Array.from(new Set([...ALL_PREFERENCES, ...(profile.dietary_preferences || [])]));
  const allAllergies = Array.from(new Set([...ALL_ALLERGIES, ...(profile.allergies || [])]));
  const allGoals = Array.from(new Set([...ALL_GOALS, ...(profile.health_goals || [])]));

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
          User Account & Profile
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
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14, flex: 1 }}>
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
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 19, fontWeight: "900", color: colors.text }} numberOfLines={1}>
                  {profile.full_name || "NutriLens Member"}
                </Text>
                <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }} numberOfLines={1}>
                  {profile.email || "Authenticated Account"}
                </Text>
                {userId ? (
                  <View style={{
                    backgroundColor: `${colors.emerald}15`,
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 6,
                    alignSelf: "flex-start",
                    marginTop: 4
                  }}>
                    <Text style={{ fontSize: 10, fontWeight: "800", color: colors.emerald }} numberOfLines={1}>
                      UID: {userId.substring(0, 16)}...
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* Logout Button */}
            {isAuthenticated ? (
              <TouchableOpacity
                onPress={handleLogout}
                style={{
                  backgroundColor: `${colors.crimson}15`,
                  borderColor: `${colors.crimson}50`,
                  borderWidth: 1,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 14
                }}
              >
                <Text style={{ color: colors.crimson, fontSize: 12, fontWeight: "800" }}>
                  Log Out 🚪
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => router.push("/login")}
                style={{
                  backgroundColor: colors.emerald,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 14
                }}
              >
                <Text style={{ color: "#FFF", fontSize: 12, fontWeight: "800" }}>
                  Sign In
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* SECTION: AGE & PERSONALIZATION */}
        <View style={{
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderWidth: 1.5,
          borderRadius: 24,
          padding: 20,
          gap: 14
        }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View>
              <Text style={{ fontSize: 17, fontWeight: "900", color: colors.text }}>
                User Age & Nutritional Context
              </Text>
              <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                Enables pediatric, adult, or senior clinical nutrition guidance
              </Text>
            </View>
            {ageSuccess && (
              <View style={{ backgroundColor: `${colors.emerald}20`, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                <Text style={{ fontSize: 11, fontWeight: "800", color: colors.emerald }}>✓ Updated</Text>
              </View>
            )}
          </View>

          {ageError && (
            <View style={{ backgroundColor: `${colors.crimson}18`, padding: 10, borderRadius: 12 }}>
              <Text style={{ color: colors.crimson, fontSize: 12, fontWeight: "700" }}>{ageError}</Text>
            </View>
          )}

          <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
            <TextInput
              value={ageInput}
              onChangeText={(val) => {
                setAgeInput(val.replace(/[^0-9]/g, ""));
                setAgeError(null);
              }}
              placeholder="e.g. 28"
              placeholderTextColor={colors.textDim}
              keyboardType="numeric"
              maxLength={3}
              style={{
                flex: 1,
                backgroundColor: colors.cardAlt,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: 14,
                paddingHorizontal: 16,
                paddingVertical: 12,
                color: colors.text,
                fontSize: 16,
                fontWeight: "700"
              }}
            />
            <TouchableOpacity
              onPress={handleSaveAge}
              disabled={ageSaving}
              style={{
                backgroundColor: colors.emerald,
                paddingHorizontal: 20,
                paddingVertical: 14,
                borderRadius: 14,
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              {ageSaving ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <Text style={{ color: "#FFF", fontWeight: "900", fontSize: 13 }}>Save Age</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={{
            backgroundColor: `${colors.emerald}10`,
            borderRadius: 14,
            padding: 12,
            borderLeftWidth: 3,
            borderLeftColor: colors.emerald
          }}>
            <Text style={{ fontSize: 11, color: colors.text, lineHeight: 16 }}>
              {profile.age !== null && profile.age !== undefined
                ? profile.age < 18
                  ? `👶 Pediatric Mode (${profile.age} yrs): Stricter 25g added sugar limits and artificial sweetener warnings active.`
                  : profile.age >= 65
                  ? `👴 Senior Nutrition Mode (${profile.age} yrs): Stricter sodium sensitivity (<1500mg daily) and muscle-preserving protein context active.`
                  : `🧑 Adult Nutrition Mode (${profile.age} yrs): Standard RDA macro targets and vascular protection context active.`
                : "Enter your age to personalize sugar, sodium, and macro evaluations to your life stage."}
            </Text>
          </View>
        </View>

        {/* SECTION: PASSWORD & SECURITY */}
        {isAuthenticated && (
          <View style={{
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 24,
            padding: 20,
            gap: 14
          }}>
            <TouchableOpacity
              onPress={() => setShowPasswordSection((p) => !p)}
              style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
            >
              <View>
                <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text }}>
                  Account Security & Password
                </Text>
                <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                  Update your account authentication credentials
                </Text>
              </View>
              <Text style={{ fontSize: 16, color: colors.emerald, fontWeight: "800" }}>
                {showPasswordSection ? "▲" : "▼"}
              </Text>
            </TouchableOpacity>

            {showPasswordSection && (
              <View style={{ gap: 12, marginTop: 4 }}>
                {passwordError && (
                  <View style={{ backgroundColor: `${colors.crimson}18`, padding: 10, borderRadius: 12 }}>
                    <Text style={{ color: colors.crimson, fontSize: 12, fontWeight: "700" }}>{passwordError}</Text>
                  </View>
                )}

                {passwordSuccess && (
                  <View style={{ backgroundColor: `${colors.emerald}18`, padding: 10, borderRadius: 12 }}>
                    <Text style={{ color: colors.emerald, fontSize: 12, fontWeight: "700" }}>
                      ✓ Password changed successfully!
                    </Text>
                  </View>
                )}

                <TextInput
                  value={newPassword}
                  onChangeText={(val) => {
                    setNewPassword(val);
                    setPasswordError(null);
                  }}
                  placeholder="New Password (min 6 chars)"
                  placeholderTextColor={colors.textDim}
                  secureTextEntry
                  style={{
                    backgroundColor: colors.cardAlt,
                    borderColor: colors.border,
                    borderWidth: 1,
                    borderRadius: 14,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    color: colors.text,
                    fontSize: 14
                  }}
                />

                <TextInput
                  value={confirmPassword}
                  onChangeText={(val) => {
                    setConfirmPassword(val);
                    setPasswordError(null);
                  }}
                  placeholder="Confirm New Password"
                  placeholderTextColor={colors.textDim}
                  secureTextEntry
                  style={{
                    backgroundColor: colors.cardAlt,
                    borderColor: colors.border,
                    borderWidth: 1,
                    borderRadius: 14,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    color: colors.text,
                    fontSize: 14
                  }}
                />

                <TouchableOpacity
                  onPress={handleChangePassword}
                  disabled={passwordLoading}
                  style={{
                    backgroundColor: colors.emerald,
                    paddingVertical: 12,
                    borderRadius: 14,
                    alignItems: "center"
                  }}
                >
                  {passwordLoading ? (
                    <ActivityIndicator color="#FFF" size="small" />
                  ) : (
                    <Text style={{ color: "#FFF", fontWeight: "900", fontSize: 13 }}>
                      Update Password
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* SECTION: HEALTH CONDITIONS */}
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
          shadowRadius: 10,
          elevation: 2
        }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={{ fontSize: 18, fontWeight: "900", color: colors.text }}>
                Health Conditions & Medical Context
              </Text>
              <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                NutriLens analyzes food items specifically against your profile
              </Text>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <TouchableOpacity
                onPress={() => setShowAddCustom((p) => !p)}
                style={{
                  backgroundColor: showAddCustom ? `${colors.emerald}30` : `${colors.emerald}18`,
                  borderColor: colors.emerald,
                  borderWidth: 1,
                  paddingHorizontal: 12,
                  paddingVertical: 5,
                  borderRadius: 14
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: "800", color: colors.emerald }}>
                  {showAddCustom ? "✕ Cancel" : "+ Add"}
                </Text>
              </TouchableOpacity>

              <View style={{
                backgroundColor: `${colors.emerald}20`,
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 14
              }}>
                <Text style={{ fontSize: 12, fontWeight: "900", color: colors.emerald }}>
                  {selectedConditions.length} Active
                </Text>
              </View>
            </View>
          </View>

          {/* Inline Add Custom Condition */}
          {showAddCustom && (
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
              <TextInput
                value={customConditionInput}
                onChangeText={setCustomConditionInput}
                placeholder="e.g. Thyroid, PCOS, Gout, Acid Reflux..."
                placeholderTextColor={colors.textDim}
                onSubmitEditing={addCustomCondition}
                style={{
                  flex: 1,
                  backgroundColor: colors.cardAlt,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: 14,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  color: colors.text,
                  fontSize: 13,
                  fontWeight: "600"
                }}
              />
              <TouchableOpacity
                onPress={addCustomCondition}
                style={{
                  backgroundColor: colors.emerald,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 14,
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <Text style={{ color: "#FFF", fontWeight: "900", fontSize: 12 }}>+ Add</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Condition Cards Grid */}
          <View style={{ gap: 10 }}>
            {CORE_CONDITIONS.map((cond) => {
              const isSelected = selectedConditions.includes(cond.id);
              return (
                <TouchableOpacity
                  key={cond.id}
                  activeOpacity={0.8}
                  onPress={() => toggleCondition(cond.id)}
                  style={{
                    backgroundColor: isSelected ? `${colors.emerald}15` : colors.cardAlt,
                    borderColor: isSelected ? colors.emerald : colors.border,
                    borderWidth: isSelected ? 2 : 1,
                    borderRadius: 20,
                    padding: 14,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between"
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
                    <Text style={{ fontSize: 26 }}>{cond.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{
                        fontSize: 15,
                        fontWeight: "900",
                        color: isSelected ? colors.emerald : colors.text
                      }}>
                        {cond.name}
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                        {cond.desc}
                      </Text>
                    </View>
                  </View>

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

            {/* Custom Conditions added by user */}
            {customConditions.map((cond) => (
              <View
                key={cond}
                style={{
                  backgroundColor: `${colors.emerald}15`,
                  borderColor: colors.emerald,
                  borderWidth: 2,
                  borderRadius: 20,
                  padding: 14,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between"
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
                  <Text style={{ fontSize: 26 }}>🩺</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: "900", color: colors.emerald }}>
                      {cond}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                      Custom condition monitored during food analysis
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => removeCustomItem("health_conditions", cond)}
                  style={{
                    backgroundColor: `${colors.crimson}20`,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: `${colors.crimson}50`
                  }}
                >
                  <Text style={{ color: colors.crimson, fontWeight: "900", fontSize: 11 }}>Remove ✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
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
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text }}>Dietary Preferences</Text>
              <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                Foods not aligning will receive score adjustments
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowAddPref((p) => !p)}
              style={{
                backgroundColor: showAddPref ? `${colors.emerald}30` : `${colors.emerald}18`,
                borderColor: colors.emerald,
                borderWidth: 1,
                paddingHorizontal: 12,
                paddingVertical: 5,
                borderRadius: 14
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: "800", color: colors.emerald }}>
                {showAddPref ? "✕ Cancel" : "+ Add"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Inline Add Custom Preference */}
          {showAddPref && (
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
              <TextInput
                value={customPrefInput}
                onChangeText={setCustomPrefInput}
                placeholder="e.g. Halal, Mediterranean, Low-FODMAP..."
                placeholderTextColor={colors.textDim}
                onSubmitEditing={addCustomPreference}
                style={{
                  flex: 1,
                  backgroundColor: colors.cardAlt,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: 14,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  color: colors.text,
                  fontSize: 13,
                  fontWeight: "600"
                }}
              />
              <TouchableOpacity
                onPress={addCustomPreference}
                style={{
                  backgroundColor: colors.emerald,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 14,
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <Text style={{ color: "#FFF", fontWeight: "900", fontSize: 12 }}>+ Add</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {allPrefs.map((pref) => {
              const isSelected = (profile.dietary_preferences || []).includes(pref);
              const isCustom = !ALL_PREFERENCES.includes(pref);
              return (
                <View
                  key={pref}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    borderRadius: 16,
                    backgroundColor: isSelected ? colors.emerald : colors.cardAlt,
                    borderWidth: 1,
                    borderColor: isSelected ? colors.emerald : colors.border,
                    paddingLeft: 12,
                    paddingRight: isCustom ? 6 : 12,
                    paddingVertical: 6,
                    gap: 6
                  }}
                >
                  <TouchableOpacity onPress={() => toggleItem("dietary_preferences", pref)}>
                    <Text style={{
                      fontSize: 12,
                      fontWeight: isSelected ? "800" : "600",
                      color: isSelected ? "#FFF" : colors.text
                    }}>
                      {isSelected ? "✓ " : ""}{pref}
                    </Text>
                  </TouchableOpacity>
                  {isCustom && (
                    <TouchableOpacity
                      onPress={() => removeCustomItem("dietary_preferences", pref)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={{
                        backgroundColor: isSelected ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.15)",
                        borderRadius: 10,
                        paddingHorizontal: 5,
                        paddingVertical: 1
                      }}
                    >
                      <Text style={{ fontSize: 10, fontWeight: "900", color: isSelected ? "#FFF" : colors.textMuted }}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>
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
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={{ fontSize: 16, fontWeight: "800", color: colors.crimson }}>
                Allergies & Allergen Triggers
              </Text>
              <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                Triggers instant high-priority warnings on detected products
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowAddAllergy((p) => !p)}
              style={{
                backgroundColor: showAddAllergy ? `${colors.crimson}30` : `${colors.crimson}18`,
                borderColor: colors.crimson,
                borderWidth: 1,
                paddingHorizontal: 12,
                paddingVertical: 5,
                borderRadius: 14
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: "800", color: colors.crimson }}>
                {showAddAllergy ? "✕ Cancel" : "+ Add"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Inline Add Custom Allergy */}
          {showAddAllergy && (
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
              <TextInput
                value={customAllergyInput}
                onChangeText={setCustomAllergyInput}
                placeholder="e.g. Sesame, Mustard, Sulfites, Fish..."
                placeholderTextColor={colors.textDim}
                onSubmitEditing={addCustomAllergy}
                style={{
                  flex: 1,
                  backgroundColor: colors.cardAlt,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: 14,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  color: colors.text,
                  fontSize: 13,
                  fontWeight: "600"
                }}
              />
              <TouchableOpacity
                onPress={addCustomAllergy}
                style={{
                  backgroundColor: colors.crimson,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 14,
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <Text style={{ color: "#FFF", fontWeight: "900", fontSize: 12 }}>+ Add</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {allAllergies.map((al) => {
              const isSelected = (profile.allergies || []).includes(al);
              const isCustom = !ALL_ALLERGIES.includes(al);
              return (
                <View
                  key={al}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    borderRadius: 16,
                    backgroundColor: isSelected ? colors.crimson : colors.cardAlt,
                    borderWidth: 1,
                    borderColor: isSelected ? colors.crimson : colors.border,
                    paddingLeft: 12,
                    paddingRight: isCustom ? 6 : 12,
                    paddingVertical: 6,
                    gap: 6
                  }}
                >
                  <TouchableOpacity onPress={() => toggleItem("allergies", al)}>
                    <Text style={{
                      fontSize: 12,
                      fontWeight: isSelected ? "800" : "600",
                      color: isSelected ? "#FFF" : colors.text
                    }}>
                      {isSelected ? "⚠️ " : ""}{al}
                    </Text>
                  </TouchableOpacity>
                  {isCustom && (
                    <TouchableOpacity
                      onPress={() => removeCustomItem("allergies", al)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={{
                        backgroundColor: isSelected ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.15)",
                        borderRadius: 10,
                        paddingHorizontal: 5,
                        paddingVertical: 1
                      }}
                    >
                      <Text style={{ fontSize: 10, fontWeight: "900", color: isSelected ? "#FFF" : colors.textMuted }}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>
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
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={{ fontSize: 16, fontWeight: "800", color: colors.blue }}>
                Nutritional Health Goals
              </Text>
              <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                Used by the AI engine to generate personalized verdicts
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowAddGoal((p) => !p)}
              style={{
                backgroundColor: showAddGoal ? `${colors.blue}30` : `${colors.blue}18`,
                borderColor: colors.blue,
                borderWidth: 1,
                paddingHorizontal: 12,
                paddingVertical: 5,
                borderRadius: 14
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: "800", color: colors.blue }}>
                {showAddGoal ? "✕ Cancel" : "+ Add"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Inline Add Custom Goal */}
          {showAddGoal && (
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
              <TextInput
                value={customGoalInput}
                onChangeText={setCustomGoalInput}
                placeholder="e.g. Gut Health, Lower Cholesterol, Longevity..."
                placeholderTextColor={colors.textDim}
                onSubmitEditing={addCustomGoal}
                style={{
                  flex: 1,
                  backgroundColor: colors.cardAlt,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: 14,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  color: colors.text,
                  fontSize: 13,
                  fontWeight: "600"
                }}
              />
              <TouchableOpacity
                onPress={addCustomGoal}
                style={{
                  backgroundColor: colors.blue,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 14,
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <Text style={{ color: "#FFF", fontWeight: "900", fontSize: 12 }}>+ Add</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {allGoals.map((goal) => {
              const isSelected = (profile.health_goals || []).includes(goal);
              const isCustom = !ALL_GOALS.includes(goal);
              return (
                <View
                  key={goal}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    borderRadius: 16,
                    backgroundColor: isSelected ? colors.blue : colors.cardAlt,
                    borderWidth: 1,
                    borderColor: isSelected ? colors.blue : colors.border,
                    paddingLeft: 12,
                    paddingRight: isCustom ? 6 : 12,
                    paddingVertical: 6,
                    gap: 6
                  }}
                >
                  <TouchableOpacity onPress={() => toggleItem("health_goals", goal)}>
                    <Text style={{
                      fontSize: 12,
                      fontWeight: isSelected ? "800" : "600",
                      color: isSelected ? "#FFF" : colors.text
                    }}>
                      {isSelected ? "🎯 " : ""}{goal}
                    </Text>
                  </TouchableOpacity>
                  {isCustom && (
                    <TouchableOpacity
                      onPress={() => removeCustomItem("health_goals", goal)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={{
                        backgroundColor: isSelected ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.15)",
                        borderRadius: 10,
                        paddingHorizontal: 5,
                        paddingVertical: 1
                      }}
                    >
                      <Text style={{ fontSize: 10, fontWeight: "900", color: isSelected ? "#FFF" : colors.textMuted }}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>
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

      {/* Global Bottom Navigation */}
      <BottomNav />
    </View>
  );
}
