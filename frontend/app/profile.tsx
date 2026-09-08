import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, ScrollView, Switch, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { getUserProfile, updateUserProfile, getUserStats, UserProfile, UserStatsResponse } from "../lib/api";
import { useTheme } from "../lib/ThemeContext";
import { BottomNav } from "../components/BottomNav";

const ALL_PREFERENCES = ["Vegan", "Keto", "Gluten-Free", "Low-Sodium", "Diabetic-Friendly", "Low Sugar"];
const ALL_ALLERGIES = ["Peanuts", "Lactose Intolerant", "Gluten", "Soy", "Tree Nuts", "Shellfish", "Eggs"];
const ALL_GOALS = ["Weight Loss", "Muscle Gain", "Heart Health", "Diabetic Care", "Low Sugar", "Clean Purity"];

export default function ProfileScreen() {
  const router = useRouter();
  const { colors, isDark, toggleTheme } = useTheme();

  const [profile, setProfile] = useState<UserProfile>({
    user_id: "default_user",
    dietary_preferences: ["Low Sugar", "Diabetic-Friendly"],
    allergies: ["Peanuts", "Lactose Intolerant"],
    health_goals: ["Weight Loss", "Heart Health"]
  });
  const [stats, setStats] = useState<UserStatsResponse | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    loadProfileAndStats();
  }, []);

  const loadProfileAndStats = async () => {
    try {
      const [prof, st] = await Promise.all([
        getUserProfile("default_user"),
        getUserStats("default_user")
      ]);
      if (prof) setProfile(prof);
      if (st) setStats(st);
    } catch (e) {
      console.error("Error loading user profile:", e);
    }
  };

  const toggleItem = async (category: "dietary_preferences" | "allergies" | "health_goals", item: string) => {
    const currentList = profile[category] || [];
    const updated = currentList.includes(item)
      ? currentList.filter((i) => i !== item)
      : [...currentList, item];

    const newProfile = { ...profile, [category]: updated };
    setProfile(newProfile);

    // Save automatically to Supabase & SQLite
    setIsSaving(true);
    try {
      await updateUserProfile(newProfile);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (e) {
      console.error("Failed to save profile:", e);
    } finally {
      setIsSaving(false);
    }
  };

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
          Account & Profile
        </Text>

        {isSaving ? (
          <ActivityIndicator size="small" color={colors.emerald} />
        ) : saveSuccess ? (
          <Text style={{ fontSize: 12, fontWeight: "800", color: colors.emerald }}>✓ Saved</Text>
        ) : null}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 20 }}>
        {/* User Avatar & Rank Card */}
        <View style={{
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 28,
          padding: 22,
          alignItems: "center",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.12,
          shadowRadius: 10,
          elevation: 3
        }}>
          {/* Avatar Icon */}
          <View style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: `${colors.emerald}20`,
            borderWidth: 3,
            borderColor: colors.emerald,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 12
          }}>
            <Text style={{ fontSize: 38 }}>🥑</Text>
          </View>

          <Text style={{ fontSize: 20, fontWeight: "900", color: colors.text }}>
            Jishan Ahmed
          </Text>
          <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
            user_id: default_user • Active Member
          </Text>

          {/* Level Rank Badge */}
          <View style={{
            backgroundColor: `${colors.emerald}18`,
            borderColor: colors.emerald,
            borderWidth: 1,
            paddingHorizontal: 14,
            paddingVertical: 4,
            borderRadius: 14,
            marginTop: 10
          }}>
            <Text style={{ fontSize: 12, fontWeight: "800", color: colors.emerald }}>
              Level {stats?.level || 3} • Nutrition Scout
            </Text>
          </View>

          {/* 3 Stats Columns */}
          <View style={{
            flexDirection: "row",
            justifyContent: "space-around",
            width: "100%",
            marginTop: 20,
            paddingTop: 16,
            borderTopWidth: 1,
            borderTopColor: colors.border
          }}>
            <View style={{ alignItems: "center" }}>
              <Text style={{ fontSize: 20, fontWeight: "900", color: colors.text }}>
                {stats?.current_streak || 14}
              </Text>
              <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>Day Streak 🔥</Text>
            </View>

            <TouchableOpacity
              onPress={() => router.push("/history" as any)}
              style={{ alignItems: "center" }}
            >
              <Text style={{ fontSize: 20, fontWeight: "900", color: colors.emerald }}>
                {stats?.total_scans || 28}
              </Text>
              <Text style={{ fontSize: 11, color: colors.emerald, fontWeight: "700", marginTop: 2 }}>Scans 📊 →</Text>
            </TouchableOpacity>

            <View style={{ alignItems: "center" }}>
              <Text style={{ fontSize: 20, fontWeight: "900", color: colors.emerald }}>
                {stats?.xp || 450}
              </Text>
              <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>Total XP ⚡</Text>
            </View>
          </View>
        </View>

        {/* Scan History Action Card */}
        <TouchableOpacity
          onPress={() => router.push("/history" as any)}
          activeOpacity={0.82}
          style={{
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 24,
            padding: 18,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 3
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14, flex: 1 }}>
            <View style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: `${colors.emerald}20`,
              borderWidth: 1,
              borderColor: `${colors.emerald}50`,
              alignItems: "center",
              justifyContent: "center"
            }}>
              <Text style={{ fontSize: 24 }}>📜</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: "900", color: colors.text }}>
                Scan History & Log
              </Text>
              <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                Review past food scans, purity scores & alerts
              </Text>
            </View>
          </View>

          <View style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            backgroundColor: colors.cardAlt,
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border
          }}>
            <Text style={{ fontSize: 12, fontWeight: "800", color: colors.emerald }}>
              View All
            </Text>
            <Text style={{ fontSize: 13, color: colors.textMuted }}>→</Text>
          </View>
        </TouchableOpacity>

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
              Allergies & Intolerances
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
      </ScrollView>

      {/* Global Bottom Navigation */}
      <BottomNav />
    </View>
  );
}
