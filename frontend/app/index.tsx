import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, ScrollView, RefreshControl, Dimensions } from "react-native";
import { useRouter } from "expo-router";
import {
  getUserProfile,
  getUserStats,
  getScanHistory,
  getWeeklyReport,
  getNutritionInsights,
  getActiveUserId,
  getSavedUserProfile,
  UserProfile,
  UserStatsResponse,
  ScanHistoryItem,
  WeeklyReportResponse,
  NutritionInsightsResponse
} from "../lib/api";
import { useTheme } from "../lib/ThemeContext";
import { useAuth } from "../lib/AuthContext";
import { ScoreRing } from "../components/ScoreRing";
import { WeeklyChart } from "../components/WeeklyChart";
import { BottomNav } from "../components/BottomNav";

const DEMO_SUGGESTIONS = [
  { id: "s1", name: "Raw Organic Almonds", score: 98, tag: "100% Natural", reason: "High in magnesium, clean healthy plant fats." },
  { id: "s2", name: "Wild Blueberries", score: 99, tag: "Whole Food", reason: "Potent anthocyanins with zero added sugars." },
  { id: "s3", name: "Sprouted Pumpkin Seeds", score: 95, tag: "Raw & Clean", reason: "Clean bioavailable zinc and plant protein." },
  { id: "s4", name: "Unsweetened Coconut Water", score: 91, tag: "Electrolytes", reason: "Natural cellular electrolyte replenishment." }
];

export default function HomeScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { userProfile: authProfile, userId, isAuthenticated, isDemoMode, loginAsGuest, isLoading: authLoading } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(authProfile);
  const [stats, setStats] = useState<UserStatsResponse | null>(null);
  const [weeklyReport, setWeeklyReport] = useState<WeeklyReportResponse | null>(null);
  const [nutritionInsights, setNutritionInsights] = useState<NutritionInsightsResponse | null>(null);
  const [recentScans, setRecentScans] = useState<ScanHistoryItem[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isGuestLoggingIn, setIsGuestLoggingIn] = useState(false);

  useEffect(() => {
    if (authProfile) {
      setProfile(authProfile);
    }
  }, [authProfile]);

  useEffect(() => {
    if (userId || isDemoMode) {
      loadHomeData(userId);
    } else {
      setRecentScans([]);
      setProfile(null);
      setStats(null);
      setWeeklyReport(null);
      setNutritionInsights(null);
    }
  }, [userId, isDemoMode]);

  const loadHomeData = async (targetUid?: string) => {
    const activeId = targetUid || userId || getActiveUserId();
    const demo = isDemoMode || activeId === "demo_user";

    try {
      const saved = getSavedUserProfile(activeId);
      const [prof, st, hist, wk, ins] = await Promise.all([
        getUserProfile(activeId).catch(() => null),
        getUserStats(activeId, demo).catch(() => null),
        getScanHistory(activeId, 8).catch(() => []),
        getWeeklyReport(activeId, demo).catch(() => null),
        getNutritionInsights(activeId, demo).catch(() => null)
      ]);
      const currentProfile = authProfile || saved || prof;
      if (currentProfile) setProfile(currentProfile);
      if (st) setStats(st);
      if (hist) setRecentScans(hist);
      if (wk) setWeeklyReport(wk);
      if (ins) setNutritionInsights(ins);
    } catch (e) {
      console.log("Error loading home data", e);
    } finally {
      setIsRefreshing(false);
    }
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    loadHomeData();
  };

  const handleExploreDemo = async () => {
    try {
      setIsGuestLoggingIn(true);
      await loginAsGuest();
    } catch (e) {
      console.warn("Could not start demo:", e);
    } finally {
      setIsGuestLoggingIn(false);
    }
  };

  // Time-aware greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  // =========================================================================
  // AUTH GATEWAY SCREEN: If visitor opens the app without active authentication
  // =========================================================================
  if (!isAuthenticated && !isDemoMode && !authLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            paddingHorizontal: 24,
            paddingVertical: 48
          }}
        >
          {/* Brand Header */}
          <View style={{ alignItems: "center", marginBottom: 32 }}>
            <View style={{
              width: 80,
              height: 80,
              borderRadius: 24,
              backgroundColor: `${colors.emerald}20`,
              borderWidth: 2,
              borderColor: colors.emerald,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
              shadowColor: colors.emerald,
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.35,
              shadowRadius: 16
            }}>
              <Text style={{ fontSize: 40 }}>🥑</Text>
            </View>

            <Text style={{
              fontSize: 34,
              fontWeight: "900",
              color: colors.text,
              letterSpacing: -1,
              textAlign: "center"
            }}>
              NutriLens
            </Text>

            <Text style={{
              fontSize: 14,
              color: colors.textMuted,
              marginTop: 6,
              textAlign: "center",
              lineHeight: 20,
              maxWidth: 320
            }}>
              Precision Food Intelligence, NOVA Processing Analysis & Personalized Clinical Health Audits
            </Text>
          </View>

          {/* Feature Highlights Card */}
          <View style={{
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 24,
            padding: 20,
            marginBottom: 28,
            gap: 14,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.12,
            shadowRadius: 12,
            elevation: 3
          }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Text style={{ fontSize: 24 }}>🔍</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: "800", color: colors.text }}>
                  Instant Ingredient Safety Scan
                </Text>
                <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 1 }}>
                  Flags toxic additives, E-numbers & UPFs with optical AI
                </Text>
              </View>
            </View>

            <View style={{ height: 1, backgroundColor: colors.border }} />

            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Text style={{ fontSize: 24 }}>🛡️</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: "800", color: colors.text }}>
                  Clinical Health Condition Audits
                </Text>
                <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 1 }}>
                  Calibrated warnings for Diabetes, BP, Cholesterol, Allergies
                </Text>
              </View>
            </View>

            <View style={{ height: 1, backgroundColor: colors.border }} />

            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Text style={{ fontSize: 24 }}>🌿</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: "800", color: colors.text }}>
                  Whole Food Swaps
                </Text>
                <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 1 }}>
                  Category-matched healthier whole foods for every scan
                </Text>
              </View>
            </View>
          </View>

          {/* Three Primary Gateway Actions */}
          <View style={{ gap: 12 }}>
            {/* 1. Explore Demo Account */}
            <TouchableOpacity
              onPress={handleExploreDemo}
              disabled={isGuestLoggingIn}
              activeOpacity={0.85}
              style={{
                backgroundColor: `${colors.emerald}18`,
                borderColor: colors.emerald,
                borderWidth: 2,
                borderRadius: 20,
                paddingVertical: 16,
                paddingHorizontal: 20,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between"
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
                <Text style={{ fontSize: 24 }}>⚡</Text>
                <View>
                  <Text style={{ fontSize: 16, fontWeight: "900", color: colors.emerald }}>
                    Explore Demo Account
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 1 }}>
                    Instant sample data • 14d streak • No sign in required
                  </Text>
                </View>
              </View>
              <Text style={{ fontSize: 16, fontWeight: "900", color: colors.emerald }}>→</Text>
            </TouchableOpacity>

            {/* 2. Sign In to Your Account */}
            <TouchableOpacity
              onPress={() => router.push("/login")}
              activeOpacity={0.85}
              style={{
                backgroundColor: colors.emerald,
                borderRadius: 20,
                paddingVertical: 16,
                paddingHorizontal: 20,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                shadowColor: colors.emerald,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.35,
                shadowRadius: 10
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
                <Text style={{ fontSize: 22 }}>👤</Text>
                <View>
                  <Text style={{ fontSize: 16, fontWeight: "900", color: "#FFFFFF" }}>
                    Sign In to Your Account
                  </Text>
                  <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.85)", marginTop: 1 }}>
                    Access your personal scans & genuine health data
                  </Text>
                </View>
              </View>
              <Text style={{ fontSize: 16, fontWeight: "900", color: "#FFFFFF" }}>→</Text>
            </TouchableOpacity>

            {/* 3. Create Free Account */}
            <TouchableOpacity
              onPress={() => router.push("/signup")}
              activeOpacity={0.85}
              style={{
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderWidth: 1.5,
                borderRadius: 20,
                paddingVertical: 15,
                paddingHorizontal: 20,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between"
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
                <Text style={{ fontSize: 22 }}>✨</Text>
                <View>
                  <Text style={{ fontSize: 15, fontWeight: "900", color: colors.text }}>
                    Create Free Account
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 1 }}>
                    Personalize dietary goals, allergies & track genuine scans
                  </Text>
                </View>
              </View>
              <Text style={{ fontSize: 15, fontWeight: "900", color: colors.textMuted }}>→</Text>
            </TouchableOpacity>
          </View>

          {/* Privacy Footnote */}
          <View style={{ marginTop: 24, alignItems: "center" }}>
            <Text style={{ fontSize: 11, color: colors.textDim, textAlign: "center" }}>
              🔒 Clean food data privacy pledge • Your medical profile is never sold
            </Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  // =========================================================================
  // MAIN DASHBOARD: Separates Demo Mode from Real User Mode
  // =========================================================================

  // Metrics computation
  const isDemo = Boolean(isDemoMode || userId === "demo_user");
  const realScansCount = recentScans.length;
  const isRealUserFirstLogin = !isDemo && realScansCount === 0 && (stats?.total_scans ?? 0) === 0;

  // Streak values:
  // - Demo: exactly 14d Streak, 450 XP
  // - Real user: genuine database calculated streak & XP
  const displayStreak = isDemo ? 14 : (stats?.current_streak ?? 0);
  const displayXP = isDemo ? 450 : (stats?.xp ?? 0);

  // Health Score calculation:
  // - Demo: existing 86
  // - Real user with scans: average of genuine scans
  // - Real user first login (0 scans): null / no data
  const realAvgScore = realScansCount > 0
    ? Math.round(recentScans.reduce((a, b) => a + b.health_score, 0) / realScansCount)
    : null;
  const avgHealthScore = isDemo ? 86 : (realAvgScore ?? 0);

  // Daily nutrient amounts
  const sugarG = isDemo ? 16 : (nutritionInsights?.sugar_today_g ?? 0);
  const sugarPct = Math.min(100, Math.round((sugarG / 25) * 100));

  const sodiumMg = isDemo ? 980 : (nutritionInsights?.sodium_today_mg ?? 0);
  const sodiumPct = Math.min(100, Math.round((sodiumMg / 2300) * 100));

  const proteinG = isDemo ? 52 : (nutritionInsights?.protein_today_g ?? 0);
  const proteinPct = Math.min(100, Math.round((proteinG / 60) * 100));

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 30 }}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.emerald} />
        }
      >
        {/* Top Header & Greeting */}
        <View style={{
          paddingHorizontal: 20,
          paddingTop: 44,
          paddingBottom: 12,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start"
        }}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textMuted, textTransform: "uppercase", letterSpacing: 1 }}>
              {getGreeting()},
            </Text>
            <Text style={{ fontSize: 24, fontWeight: "900", color: colors.text, letterSpacing: -0.5, marginTop: 2 }}>
              {isDemo
                ? "Demo Health Seeker 👋"
                : (profile?.full_name || authProfile?.full_name || "Health Seeker") + " 👋"}
            </Text>

            {/* Active Conditions Pill Strip */}
            {profile?.health_conditions && profile.health_conditions.length > 0 ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                {profile.health_conditions.map((cond) => (
                  <TouchableOpacity
                    key={cond}
                    onPress={() => router.push("/profile" as any)}
                    style={{
                      backgroundColor: `${colors.emerald}15`,
                      borderColor: `${colors.emerald}50`,
                      borderWidth: 1,
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 10
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: "800", color: colors.emerald }}>
                      🛡️ {cond}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => router.push("/profile" as any)}
                style={{ marginTop: 6 }}
              >
                <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: "600" }}>
                  + Add health conditions in profile
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Quick Streak, XP & Auth Account Bar */}
          <View style={{ alignItems: "flex-end", gap: 8 }}>
            <TouchableOpacity
              onPress={() => {
                if (isRealUserFirstLogin) {
                  router.push("/scanner");
                } else {
                  router.push("/profile" as any);
                }
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: 24,
                paddingHorizontal: 12,
                paddingVertical: 6,
                gap: 8
              }}
            >
              <Text style={{ fontSize: 16 }}>🔥</Text>
              <View>
                <Text style={{ fontSize: 12, fontWeight: "800", color: colors.text }}>
                  {displayStreak}d Streak
                </Text>
                <Text style={{ fontSize: 10, fontWeight: "700", color: colors.emerald }}>
                  {displayXP} XP
                </Text>
              </View>
            </TouchableOpacity>

            <View style={{ flexDirection: "row", gap: 6 }}>
              {isDemo ? (
                <TouchableOpacity
                  onPress={() => router.push("/signup")}
                  style={{
                    backgroundColor: `${colors.amber}20`,
                    borderColor: `${colors.amber}50`,
                    borderWidth: 1,
                    borderRadius: 12,
                    paddingHorizontal: 10,
                    paddingVertical: 4
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: "900", color: colors.amber }}>
                    ⚡ Demo
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => router.push("/profile")}
                  style={{
                    backgroundColor: `${colors.emerald}15`,
                    borderColor: `${colors.emerald}50`,
                    borderWidth: 1,
                    borderRadius: 12,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4
                  }}
                >
                  <Text style={{ fontSize: 12 }}>👤</Text>
                  <Text style={{ fontSize: 11, fontWeight: "800", color: colors.emerald }}>
                    Profile
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* DEMO MODE INDICATOR BANNER (Only visible in Demo Mode) */}
        {isDemo && (
          <View style={{
            marginHorizontal: 20,
            marginBottom: 16,
            backgroundColor: `${colors.amber}18`,
            borderColor: `${colors.amber}40`,
            borderWidth: 1,
            borderRadius: 16,
            paddingHorizontal: 14,
            paddingVertical: 10,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between"
          }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
              <Text style={{ fontSize: 18 }}>⚡</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: "900", color: colors.amber }}>
                  DEMO MODE ACTIVE
                </Text>
                <Text style={{ fontSize: 11, color: colors.textMuted }}>
                  Showing sample food scans & simulated intelligence
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => router.push("/signup")}
              style={{
                backgroundColor: colors.emerald,
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 10
              }}
            >
              <Text style={{ color: "#FFF", fontSize: 11, fontWeight: "800" }}>
                Sign Up
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Real User First Login Streak Helper */}
        {isRealUserFirstLogin && (
          <View style={{
            marginHorizontal: 20,
            marginBottom: 16,
            backgroundColor: `${colors.cardAlt}C0`,
            borderColor: colors.border,
            borderWidth: 1,
            borderStyle: "dashed",
            borderRadius: 16,
            paddingHorizontal: 14,
            paddingVertical: 10,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between"
          }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
              <Text style={{ fontSize: 18 }}>🔥</Text>
              <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textMuted, flex: 1 }}>
                Start your streak by scanning your first food item.
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push("/scanner")}
              style={{
                backgroundColor: colors.emerald,
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 8
              }}
            >
              <Text style={{ color: "#FFF", fontSize: 11, fontWeight: "800" }}>
                Scan Now
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Hero Health Status Card */}
        <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
          <View style={{
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 28,
            padding: 22,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.15,
            shadowRadius: 14,
            elevation: 4
          }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flex: 1, paddingRight: 16 }}>
                <View style={{
                  backgroundColor: `${colors.emerald}20`,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 12,
                  alignSelf: "flex-start",
                  marginBottom: 8
                }}>
                  <Text style={{ fontSize: 11, fontWeight: "800", color: colors.emerald }}>
                    NUTRITION PURITY
                  </Text>
                </View>

                {isRealUserFirstLogin ? (
                  <>
                    <Text style={{ fontSize: 20, fontWeight: "900", color: colors.text, lineHeight: 26 }}>
                      Awaiting First Food Scan
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4, lineHeight: 18 }}>
                      Complete food scans to generate your personal health report.
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={{ fontSize: 20, fontWeight: "900", color: colors.text, lineHeight: 26 }}>
                      {avgHealthScore >= 80 ? "Clean Whole Food Diet" : avgHealthScore >= 50 ? "Moderately Balanced Diet" : "High Processed Diet"}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4, lineHeight: 18 }}>
                      {isDemo
                        ? "Based on your sample food scans and dietary preferences."
                        : `Based on your ${realScansCount} genuine food scan${realScansCount === 1 ? "" : "s"}.`}
                    </Text>
                  </>
                )}

                {/* Quick Scan Action CTA */}
                <TouchableOpacity
                  onPress={() => router.push("/scanner")}
                  activeOpacity={0.85}
                  style={{
                    backgroundColor: colors.emerald,
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 14,
                    alignSelf: "flex-start",
                    marginTop: 14,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    shadowColor: colors.emerald,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.4,
                    shadowRadius: 8
                  }}
                >
                  <Text style={{ color: "#FFF", fontSize: 13, fontWeight: "800" }}>
                    📷 {isRealUserFirstLogin ? "Scan First Product" : "Scan Product"}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Health Score Ring (or clean empty state ring for first login) */}
              {isRealUserFirstLogin ? (
                <View style={{
                  width: 120,
                  height: 120,
                  borderRadius: 60,
                  borderWidth: 4,
                  borderColor: colors.border,
                  borderStyle: "dashed",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.cardAlt
                }}>
                  <Text style={{ fontSize: 24, fontWeight: "900", color: colors.textDim }}>—</Text>
                  <Text style={{ fontSize: 9, fontWeight: "800", color: colors.textMuted, marginTop: 2 }}>
                    NO DATA
                  </Text>
                </View>
              ) : (
                <ScoreRing score={avgHealthScore} size={120} strokeWidth={9} label="SCORE" showGrade={true} />
              )}
            </View>

            {/* Daily Nutrient Progress Bars */}
            <View style={{ marginTop: 22, paddingTop: 18, borderTopWidth: 1, borderTopColor: colors.border, gap: 12 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontSize: 12, fontWeight: "800", color: colors.textMuted, textTransform: "uppercase" }}>
                  Daily Nutritional Limits & Goals
                </Text>
                {isRealUserFirstLogin && (
                  <Text style={{ fontSize: 10, color: colors.textDim, fontWeight: "600" }}>
                    Limits calibrated for your profile
                  </Text>
                )}
              </View>

              {/* Added Sugar Progress */}
              <View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: colors.text }}>Added Sugar Limit</Text>
                  <Text style={{ fontSize: 12, fontWeight: "800", color: isRealUserFirstLogin ? colors.textDim : colors.amber }}>
                    {sugarPct}% ({sugarG}g / 25g)
                  </Text>
                </View>
                <View style={{ height: 6, backgroundColor: colors.cardAlt, borderRadius: 3, overflow: "hidden" }}>
                  <View style={{ width: `${sugarPct}%`, height: "100%", backgroundColor: colors.amber, borderRadius: 3 }} />
                </View>
              </View>

              {/* Sodium Progress */}
              <View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: colors.text }}>Sodium Ceiling</Text>
                  <Text style={{ fontSize: 12, fontWeight: "800", color: isRealUserFirstLogin ? colors.textDim : colors.emerald }}>
                    {sodiumPct}% ({sodiumMg}mg / 2300mg)
                  </Text>
                </View>
                <View style={{ height: 6, backgroundColor: colors.cardAlt, borderRadius: 3, overflow: "hidden" }}>
                  <View style={{ width: `${sodiumPct}%`, height: "100%", backgroundColor: colors.emerald, borderRadius: 3 }} />
                </View>
              </View>

              {/* Clean Plant Protein Goal */}
              <View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: colors.text }}>Clean Protein Target</Text>
                  <Text style={{ fontSize: 12, fontWeight: "800", color: isRealUserFirstLogin ? colors.textDim : colors.blue }}>
                    {proteinPct}% ({proteinG}g / 60g)
                  </Text>
                </View>
                <View style={{ height: 6, backgroundColor: colors.cardAlt, borderRadius: 3, overflow: "hidden" }}>
                  <View style={{ width: `${proteinPct}%`, height: "100%", backgroundColor: colors.blue, borderRadius: 3 }} />
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Weekly Health Score Chart Widget */}
        <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
          {isDemo ? (
            <WeeklyChart isDemo={true} />
          ) : (
            <WeeklyChart
              isDemo={false}
              isEmpty={isRealUserFirstLogin || !weeklyReport?.has_data}
              emptyMessage="Your weekly report will appear after your first scan."
              data={weeklyReport?.days}
              avgScore={weeklyReport?.weekly_avg}
            />
          )}
        </View>

        {/* Recent Scans Carousel */}
        <View style={{ marginBottom: 24 }}>
          <View style={{ paddingHorizontal: 20, flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <View>
              <Text style={{ fontSize: 18, fontWeight: "900", color: colors.text }}>Recent Food Scans</Text>
              <Text style={{ fontSize: 12, color: colors.textMuted }}>
                {isRealUserFirstLogin ? "Your analyzed foods will show here" : "Tap any product to view full intelligence"}
              </Text>
            </View>
            {recentScans.length > 0 && (
              <TouchableOpacity onPress={() => router.push("/history")}>
                <Text style={{ fontSize: 13, fontWeight: "800", color: colors.emerald }}>View All →</Text>
              </TouchableOpacity>
            )}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
          >
            {recentScans.length > 0 ? (
              recentScans.map((scan) => {
                const isClean = scan.health_score >= 80;
                const scoreColor = isClean ? colors.emerald : scan.health_score >= 50 ? colors.amber : colors.crimson;

                return (
                  <TouchableOpacity
                    key={scan.id}
                    onPress={() => {
                      router.push({
                        pathname: "/results",
                        params: {
                          data: JSON.stringify({
                            product_name: scan.product_name,
                            health_score: scan.health_score,
                            nova_group: scan.health_score >= 80 ? 1 : scan.health_score >= 50 ? 3 : 4,
                            allergen_flags: scan.allergen_flags,
                            ingredient_risks: scan.health_score < 60 ? ["High glycemic load or industrial additives"] : [],
                            personalized_verdict: scan.verdict_summary,
                            positive_attributes: scan.health_score >= 80 ? ["Clean whole food ingredients"] : [],
                            additives: []
                          })
                        }
                      });
                    }}
                    style={{
                      width: 170,
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                      borderWidth: 1,
                      borderRadius: 20,
                      padding: 14,
                      justifyContent: "space-between"
                    }}
                  >
                    <View>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <Text style={{ fontSize: 24 }}>{isClean ? "🥑" : "🍪"}</Text>
                        <View style={{
                          backgroundColor: `${scoreColor}20`,
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                          borderRadius: 10,
                          borderWidth: 1,
                          borderColor: `${scoreColor}40`
                        }}>
                          <Text style={{ fontSize: 11, fontWeight: "800", color: scoreColor }}>
                            {scan.health_score}/100
                          </Text>
                        </View>
                      </View>
                      <Text style={{ fontSize: 14, fontWeight: "800", color: colors.text }} numberOfLines={2}>
                        {scan.product_name}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 8 }} numberOfLines={2}>
                      {scan.verdict_summary}
                    </Text>
                  </TouchableOpacity>
                );
              })
            ) : (
              <View style={{
                backgroundColor: colors.card,
                padding: 24,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: colors.border,
                width: Dimensions.get("window").width - 40,
                alignItems: "center"
              }}>
                <Text style={{ fontSize: 32, marginBottom: 8 }}>🥑</Text>
                <Text style={{ color: colors.text, fontSize: 15, fontWeight: "800", textAlign: "center" }}>
                  Your scanned foods will appear here.
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4, textAlign: "center", lineHeight: 18, maxWidth: 300 }}>
                  Scan a package barcode or ingredient list to view your personalized nutritional verdict.
                </Text>
                <TouchableOpacity
                  onPress={() => router.push("/scanner")}
                  style={{
                    backgroundColor: colors.emerald,
                    paddingHorizontal: 16,
                    paddingVertical: 9,
                    borderRadius: 12,
                    marginTop: 14
                  }}
                >
                  <Text style={{ color: "#FFF", fontSize: 12, fontWeight: "800" }}>
                    📷 Scan First Item
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>

        {/* Healthy Product Recommendations / Swaps */}
        <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <View>
              <Text style={{ fontSize: 18, fontWeight: "900", color: colors.text }}>Healthy Swaps & Superfoods</Text>
              <Text style={{ fontSize: 12, color: colors.textMuted }}>
                {isDemo
                  ? "Clean-label verified whole foods"
                  : (isRealUserFirstLogin
                      ? "Personalized nutrition alternatives"
                      : "Evidence-based swaps for your diet")}
              </Text>
            </View>
          </View>

          {isDemo ? (
            <View style={{ gap: 10 }}>
              {DEMO_SUGGESTIONS.map((item) => (
                <View
                  key={item.id}
                  style={{
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    borderWidth: 1,
                    borderRadius: 18,
                    padding: 14,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between"
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
                    <View style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      backgroundColor: `${colors.emerald}18`,
                      alignItems: "center",
                      justifyContent: "center"
                    }}>
                      <Text style={{ fontSize: 22 }}>🌿</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: "800", color: colors.text }}>
                        {item.name}
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }} numberOfLines={1}>
                        {item.reason}
                      </Text>
                    </View>
                  </View>

                  <View style={{ alignItems: "flex-end", marginLeft: 10 }}>
                    <View style={{
                      backgroundColor: `${colors.emerald}20`,
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 10
                    }}>
                      <Text style={{ fontSize: 11, fontWeight: "800", color: colors.emerald }}>
                        {item.score}/100
                      </Text>
                    </View>
                    <Text style={{ fontSize: 10, color: colors.textDim, marginTop: 3 }}>
                      {item.tag}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : isRealUserFirstLogin ? (
            <View style={{
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 20,
              padding: 22,
              alignItems: "center"
            }}>
              <Text style={{ fontSize: 28, marginBottom: 8 }}>🌿</Text>
              <Text style={{ fontSize: 14, fontWeight: "800", color: colors.text, textAlign: "center" }}>
                Scan a food item to discover personalized nutrition insights.
              </Text>
              <Text style={{ fontSize: 12, color: colors.textMuted, textAlign: "center", marginTop: 4, lineHeight: 18, maxWidth: 320 }}>
                When you scan foods with industrial additives, high sodium or added sugars, NutriLens will generate healthy whole-food alternatives.
              </Text>
              <TouchableOpacity
                onPress={() => router.push("/scanner")}
                style={{
                  backgroundColor: `${colors.emerald}18`,
                  borderColor: colors.emerald,
                  borderWidth: 1,
                  borderRadius: 14,
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  marginTop: 14
                }}
              >
                <Text style={{ color: colors.emerald, fontSize: 12, fontWeight: "800" }}>
                  Find Healthier Swaps →
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {DEMO_SUGGESTIONS.slice(0, 2).map((item) => (
                <View
                  key={item.id}
                  style={{
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    borderWidth: 1,
                    borderRadius: 18,
                    padding: 14,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between"
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
                    <View style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      backgroundColor: `${colors.emerald}18`,
                      alignItems: "center",
                      justifyContent: "center"
                    }}>
                      <Text style={{ fontSize: 22 }}>🌿</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: "800", color: colors.text }}>
                        {item.name}
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }} numberOfLines={1}>
                        {item.reason}
                      </Text>
                    </View>
                  </View>

                  <View style={{ alignItems: "flex-end", marginLeft: 10 }}>
                    <View style={{
                      backgroundColor: `${colors.emerald}20`,
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 10
                    }}>
                      <Text style={{ fontSize: 11, fontWeight: "800", color: colors.emerald }}>
                        {item.score}/100
                      </Text>
                    </View>
                    <Text style={{ fontSize: 10, color: colors.textDim, marginTop: 3 }}>
                      {item.tag}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Global Floating Bottom Navigation */}
      <BottomNav />
    </View>
  );
}
