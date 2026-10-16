import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, ScrollView, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "../lib/ThemeContext";
import { useAuth } from "../lib/AuthContext";
import {
  getNutritionInsights,
  getWeeklyReport,
  NutritionInsightsResponse,
  WeeklyReportResponse
} from "../lib/api";
import { WeeklyChart } from "../components/WeeklyChart";
import { BottomNav } from "../components/BottomNav";

const DEMO_CLEAN_BRANDS = [
  { name: "Organic Valley", score: 96, label: "Zero Artificial Preservatives", icon: "🌱" },
  { name: "Simple Mills", score: 93, label: "Almond & Coconut Flour Whole Snacks", icon: "🌾" },
  { name: "Artisana Organics", score: 91, label: "Raw Single-Ingredient Nut Butters", icon: "🥜" },
  { name: "Purely Elizabeth", score: 89, label: "Ancient Grain Chia Granola", icon: "🥣" }
];

const DEMO_WATCHLIST_BRANDS = [
  { name: "MegaSnack Chips", score: 24, label: "Contains E621, E102, Refined Palm Oil", icon: "🍟" },
  { name: "UltraCola Refresh", score: 18, label: "High Fructose Corn Syrup & Phosphoric Acid", icon: "🥤" },
  { name: "SweetCrave Frosting", score: 22, label: "Hydrogenated Trans-Fats & Titanium Dioxide", icon: "🧁" }
];

export default function InsightsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { userId, isAuthenticated, isDemoMode, loginAsGuest } = useAuth();

  const [timeRange, setTimeRange] = useState<"week" | "month" | "all">("week");
  const [insights, setInsights] = useState<NutritionInsightsResponse | null>(null);
  const [weeklyReport, setWeeklyReport] = useState<WeeklyReportResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isDemo = Boolean(isDemoMode || userId === "demo_user");

  useEffect(() => {
    loadInsightsData();
  }, [userId, isDemoMode]);

  const loadInsightsData = async () => {
    try {
      const [ins, wk] = await Promise.all([
        getNutritionInsights(userId || "", isDemo).catch(() => null),
        getWeeklyReport(userId || "", isDemo).catch(() => null)
      ]);
      if (ins) setInsights(ins);
      if (wk) setWeeklyReport(wk);
    } catch (e) {
      console.warn("Notice loading insights data:", e);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    loadInsightsData();
  };

  // If user is unauthenticated and not in demo mode
  if (!isAuthenticated && !isDemo) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: 24
        }}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>📊</Text>
          <Text style={{ fontSize: 20, fontWeight: "900", color: colors.text, textAlign: "center" }}>
            Sign In to View Nutrition Insights
          </Text>
          <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 8, textAlign: "center", lineHeight: 18, maxWidth: 320 }}>
            NutriLens tracks longitudinal purity, ultra-processed food consumption, and harmful additive avoidance over time.
          </Text>

          <View style={{ width: "100%", gap: 12, marginTop: 24, maxWidth: 280 }}>
            <TouchableOpacity
              onPress={() => router.push("/login")}
              style={{
                backgroundColor: colors.emerald,
                borderRadius: 16,
                paddingVertical: 14,
                alignItems: "center"
              }}
            >
              <Text style={{ color: "#FFF", fontSize: 14, fontWeight: "800" }}>Sign In</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => loginAsGuest()}
              style={{
                backgroundColor: `${colors.emerald}15`,
                borderColor: colors.emerald,
                borderWidth: 1,
                borderRadius: 16,
                paddingVertical: 13,
                alignItems: "center"
              }}
            >
              <Text style={{ color: colors.emerald, fontSize: 13, fontWeight: "800" }}>
                ⚡ Explore Demo Insights
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        <BottomNav />
      </View>
    );
  }

  // Real user data vs Demo data
  const hasData = isDemo || Boolean(insights?.has_data);

  // Card 1: Clean Diet Ratio
  const cleanDietDisplay = isDemo
    ? "78%"
    : (hasData && insights?.clean_diet_ratio !== null ? `${insights?.clean_diet_ratio}%` : "—");

  // Card 2: UPF Ratio
  const upfDisplay = isDemo
    ? "22%"
    : (hasData && insights?.upf_ratio !== null ? `${insights?.upf_ratio}%` : "—");

  // Card 3: Avg Purity Score
  const avgPurityDisplay = isDemo
    ? "84"
    : (hasData && insights?.avg_purity_score !== null ? String(insights?.avg_purity_score) : "—");

  // Card 4: Hazards Avoided
  const hazardsDisplay = isDemo
    ? "14"
    : (hasData ? String(insights?.hazards_avoided_count ?? 0) : "0");

  // Nutrient calculations
  const sugarVal = isDemo ? 16 : (insights?.sugar_today_g ?? 0);
  const sugarPct = Math.min(100, Math.round((sugarVal / 25) * 100));

  const sodiumVal = isDemo ? 980 : (insights?.sodium_today_mg ?? 0);
  const sodiumPct = Math.min(100, Math.round((sodiumVal / 2300) * 100));

  const proteinVal = isDemo ? 52 : (insights?.protein_today_g ?? 0);
  const proteinPct = Math.min(100, Math.round((proteinVal / 60) * 100));

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
        <View>
          <Text style={{ fontSize: 22, fontWeight: "900", color: colors.text }}>
            Nutrition Insights
          </Text>
          <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
            {isDemo ? "Sample longitudinal dietary analytics" : "Personal dietary purity analytics"}
          </Text>
        </View>

        {/* Time Filter Chips */}
        <View style={{
          flexDirection: "row",
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 14,
          padding: 3
        }}>
          {(["week", "month", "all"] as const).map((r) => {
            const isSelected = timeRange === r;
            return (
              <TouchableOpacity
                key={r}
                onPress={() => setTimeRange(r)}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 10,
                  backgroundColor: isSelected ? colors.emerald : "transparent"
                }}
              >
                <Text style={{
                  fontSize: 11,
                  fontWeight: isSelected ? "800" : "600",
                  color: isSelected ? "#FFF" : colors.textMuted,
                  textTransform: "capitalize"
                }}>
                  {r === "all" ? "All" : `This ${r}`}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 20 }}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.emerald} />
        }
      >
        {/* DEMO INDICATOR BANNER */}
        {isDemo && (
          <View style={{
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
                  Displaying simulated nutrition intelligence
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => router.push("/signup")}
              style={{
                backgroundColor: colors.emerald,
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 8
              }}
            >
              <Text style={{ color: "#FFF", fontSize: 11, fontWeight: "800" }}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* REAL USER 0 SCANS HERO BANNER */}
        {!isDemo && !hasData && (
          <View style={{
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 22,
            padding: 20,
            alignItems: "center"
          }}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>🥑</Text>
            <Text style={{ fontSize: 16, fontWeight: "900", color: colors.text, textAlign: "center" }}>
              Scan a food item to discover personalized nutrition insights.
            </Text>
            <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4, textAlign: "center", lineHeight: 18, maxWidth: 320 }}>
              Complete food scans to generate your personal health report, clean diet ratio, and harmful additive tracking.
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/scanner")}
              style={{
                backgroundColor: colors.emerald,
                paddingHorizontal: 18,
                paddingVertical: 10,
                borderRadius: 14,
                marginTop: 14
              }}
            >
              <Text style={{ color: "#FFF", fontSize: 13, fontWeight: "800" }}>
                📷 Scan Product Now
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Summary Metric Cards 2x2 Grid */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {/* Card 1: Clean Diet Ratio */}
          <View style={{
            width: "48%",
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 22,
            padding: 16
          }}>
            <Text style={{ fontSize: 24 }}>🥗</Text>
            <Text style={{ fontSize: 24, fontWeight: "900", color: colors.emerald, marginTop: 8 }}>
              {cleanDietDisplay}
            </Text>
            <Text style={{ fontSize: 12, fontWeight: "800", color: colors.text, marginTop: 2 }}>
              Clean Diet Ratio
            </Text>
            <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
              Natural & whole foods
            </Text>
          </View>

          {/* Card 2: Ultra-Processed Rate */}
          <View style={{
            width: "48%",
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 22,
            padding: 16
          }}>
            <Text style={{ fontSize: 24 }}>⚠️</Text>
            <Text style={{ fontSize: 24, fontWeight: "900", color: colors.crimson, marginTop: 8 }}>
              {upfDisplay}
            </Text>
            <Text style={{ fontSize: 12, fontWeight: "800", color: colors.text, marginTop: 2 }}>
              Ultra-Processed (UPF)
            </Text>
            <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
              Industrial formulations
            </Text>
          </View>

          {/* Card 3: Average Purity Score */}
          <View style={{
            width: "48%",
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 22,
            padding: 16
          }}>
            <Text style={{ fontSize: 24 }}>📈</Text>
            <Text style={{ fontSize: 24, fontWeight: "900", color: colors.blue, marginTop: 8 }}>
              {avgPurityDisplay}
              {avgPurityDisplay !== "—" && (
                <Text style={{ fontSize: 14, color: colors.textDim }}>/100</Text>
              )}
            </Text>
            <Text style={{ fontSize: 12, fontWeight: "800", color: colors.text, marginTop: 2 }}>
              Avg Purity Score
            </Text>
            <Text style={{ fontSize: 11, color: hasData ? colors.emerald : colors.textMuted, fontWeight: "700", marginTop: 2 }}>
              {isDemo ? "+6 pts vs last week" : (hasData ? "Genuine scan average" : "Awaiting scans")}
            </Text>
          </View>

          {/* Card 4: Additives Avoided */}
          <View style={{
            width: "48%",
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 22,
            padding: 16
          }}>
            <Text style={{ fontSize: 24 }}>🛡️</Text>
            <Text style={{ fontSize: 24, fontWeight: "900", color: colors.amber, marginTop: 8 }}>
              {hazardsDisplay}
            </Text>
            <Text style={{ fontSize: 12, fontWeight: "800", color: colors.text, marginTop: 2 }}>
              Hazards Avoided
            </Text>
            <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
              Toxic E-codes bypassed
            </Text>
          </View>
        </View>

        {/* Weekly Trend Bar Chart */}
        <WeeklyChart
          isDemo={isDemo}
          isEmpty={!isDemo && !hasData}
          emptyMessage="Complete food scans to generate your personal health report."
          data={weeklyReport?.days}
          avgScore={weeklyReport?.weekly_avg}
        />

        {/* Daily Nutrient Progress Bars */}
        <View style={{
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 24,
          padding: 20,
          gap: 16
        }}>
          <View>
            <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text }}>
              Nutrient Intake vs Health Ceilings
            </Text>
            <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
              {hasData
                ? "Recommended daily allowances calibrated for your profile"
                : "Awaiting your first food scan to populate daily totals"}
            </Text>
          </View>

          {/* Sugar Limit */}
          <View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: colors.text }}>Refined Added Sugars</Text>
              <Text style={{ fontSize: 12, fontWeight: "800", color: colors.amber }}>
                {sugarPct}% ({sugarVal}g / 25g)
              </Text>
            </View>
            <View style={{ height: 8, backgroundColor: colors.cardAlt, borderRadius: 4, overflow: "hidden" }}>
              <View style={{ width: `${sugarPct}%`, height: "100%", backgroundColor: colors.amber, borderRadius: 4 }} />
            </View>
          </View>

          {/* Sodium Ceiling */}
          <View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: colors.text }}>Sodium Exposure</Text>
              <Text style={{ fontSize: 12, fontWeight: "800", color: colors.emerald }}>
                {sodiumPct}% ({sodiumVal}mg / 2300mg)
              </Text>
            </View>
            <View style={{ height: 8, backgroundColor: colors.cardAlt, borderRadius: 4, overflow: "hidden" }}>
              <View style={{ width: `${sodiumPct}%`, height: "100%", backgroundColor: colors.emerald, borderRadius: 4 }} />
            </View>
          </View>

          {/* Clean Plant Protein Goal */}
          <View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: colors.text }}>Clean Protein Target</Text>
              <Text style={{ fontSize: 12, fontWeight: "800", color: colors.blue }}>
                {proteinPct}% ({proteinVal}g / 60g)
              </Text>
            </View>
            <View style={{ height: 8, backgroundColor: colors.cardAlt, borderRadius: 4, overflow: "hidden" }}>
              <View style={{ width: `${proteinPct}%`, height: "100%", backgroundColor: colors.blue, borderRadius: 4 }} />
            </View>
          </View>
        </View>

        {/* Clean Brands Leaderboard */}
        <View style={{
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 24,
          padding: 20,
          gap: 14
        }}>
          <View>
            <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text }}>
              🏆 Cleanest Scanned Brands
            </Text>
            <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
              Brands verified with zero harmful industrial additives
            </Text>
          </View>

          {isDemo ? (
            <View style={{ gap: 10 }}>
              {DEMO_CLEAN_BRANDS.map((b) => (
                <View
                  key={b.name}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    backgroundColor: colors.cardAlt,
                    padding: 12,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: colors.border
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                    <Text style={{ fontSize: 20 }}>{b.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: "800", color: colors.text }}>{b.name}</Text>
                      <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 1 }}>{b.label}</Text>
                    </View>
                  </View>

                  <View style={{
                    backgroundColor: `${colors.emerald}20`,
                    paddingHorizontal: 10,
                    paddingVertical: 3,
                    borderRadius: 12
                  }}>
                    <Text style={{ fontSize: 12, fontWeight: "900", color: colors.emerald }}>
                      {b.score}/100
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : insights && insights.clean_brands && insights.clean_brands.length > 0 ? (
            <View style={{ gap: 10 }}>
              {insights.clean_brands.map((b) => (
                <View
                  key={b.name}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    backgroundColor: colors.cardAlt,
                    padding: 12,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: colors.border
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                    <Text style={{ fontSize: 20 }}>{b.icon || "🌱"}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: "800", color: colors.text }}>{b.name}</Text>
                      <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 1 }}>{b.label}</Text>
                    </View>
                  </View>

                  <View style={{
                    backgroundColor: `${colors.emerald}20`,
                    paddingHorizontal: 10,
                    paddingVertical: 3,
                    borderRadius: 12
                  }}>
                    <Text style={{ fontSize: 12, fontWeight: "900", color: colors.emerald }}>
                      {b.score}/100
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={{
              backgroundColor: colors.cardAlt,
              padding: 16,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: "center"
            }}>
              <Text style={{ fontSize: 12, color: colors.textMuted, textAlign: "center" }}>
                No scanned brands recorded yet. Your brand safety ratings will appear here as you scan.
              </Text>
            </View>
          )}
        </View>

        {/* Additive Heavy Brands Watchlist */}
        <View style={{
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 24,
          padding: 20,
          gap: 14
        }}>
          <View>
            <Text style={{ fontSize: 16, fontWeight: "800", color: colors.crimson }}>
              ⚠️ High Additive Watchlist
            </Text>
            <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
              Brands containing multiple high-risk E-codes & UPFs
            </Text>
          </View>

          {isDemo ? (
            <View style={{ gap: 10 }}>
              {DEMO_WATCHLIST_BRANDS.map((b) => (
                <View
                  key={b.name}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    backgroundColor: colors.cardAlt,
                    padding: 12,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: colors.border
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                    <Text style={{ fontSize: 20 }}>{b.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: "800", color: colors.text }}>{b.name}</Text>
                      <Text style={{ fontSize: 11, color: colors.crimson, marginTop: 1 }}>{b.label}</Text>
                    </View>
                  </View>

                  <View style={{
                    backgroundColor: `${colors.crimson}20`,
                    paddingHorizontal: 10,
                    paddingVertical: 3,
                    borderRadius: 12
                  }}>
                    <Text style={{ fontSize: 12, fontWeight: "900", color: colors.crimson }}>
                      {b.score}/100
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : insights && insights.watchlist_brands && insights.watchlist_brands.length > 0 ? (
            <View style={{ gap: 10 }}>
              {insights.watchlist_brands.map((b) => (
                <View
                  key={b.name}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    backgroundColor: colors.cardAlt,
                    padding: 12,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: colors.border
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                    <Text style={{ fontSize: 20 }}>{b.icon || "🍟"}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: "800", color: colors.text }}>{b.name}</Text>
                      <Text style={{ fontSize: 11, color: colors.crimson, marginTop: 1 }}>{b.label}</Text>
                    </View>
                  </View>

                  <View style={{
                    backgroundColor: `${colors.crimson}20`,
                    paddingHorizontal: 10,
                    paddingVertical: 3,
                    borderRadius: 12
                  }}>
                    <Text style={{ fontSize: 12, fontWeight: "900", color: colors.crimson }}>
                      {b.score}/100
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={{
              backgroundColor: colors.cardAlt,
              padding: 16,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: "center"
            }}>
              <Text style={{ fontSize: 12, color: colors.textMuted, textAlign: "center" }}>
                Zero high-risk additive products flagged in your scan history.
              </Text>
            </View>
          )}
        </View>

        {/* Non-Diagnostic Educational Medical Disclaimer */}
        <View style={{
          backgroundColor: `${colors.cardAlt}A0`,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 18,
          padding: 14,
          flexDirection: "row",
          alignItems: "flex-start",
          gap: 10
        }}>
          <Text style={{ fontSize: 18 }}>⚖️</Text>
          <Text style={{ color: colors.textMuted, fontSize: 11, flex: 1, lineHeight: 16 }}>
            NutriLens reports provide nutritional intelligence based on ingredient analysis and are not clinical medical diagnoses. Always consult a certified healthcare professional before altering a medical diet.
          </Text>
        </View>
      </ScrollView>

      {/* Global Bottom Navigation */}
      <BottomNav />
    </View>
  );
}
