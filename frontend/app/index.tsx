import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, ScrollView, RefreshControl, Dimensions } from "react-native";
import { useRouter } from "expo-router";
import { getUserProfile, getUserStats, getScanHistory, UserProfile, UserStatsResponse, ScanHistoryItem } from "../lib/api";
import { useTheme } from "../lib/ThemeContext";
import { ScoreRing } from "../components/ScoreRing";
import { WeeklyChart } from "../components/WeeklyChart";
import { BottomNav } from "../components/BottomNav";

const HEALTHY_SUGGESTIONS = [
  { id: "s1", name: "Raw Organic Almonds", score: 98, tag: "100% Natural", reason: "High in magnesium, clean healthy plant fats." },
  { id: "s2", name: "Wild Blueberries", score: 99, tag: "Whole Food", reason: "Potent anthocyanins with zero added sugars." },
  { id: "s3", name: "Sprouted Pumpkin Seeds", score: 95, tag: "Raw & Clean", reason: "Clean bioavailable zinc and plant protein." },
  { id: "s4", name: "Unsweetened Coconut Water", score: 91, tag: "Electrolytes", reason: "Natural cellular electrolyte replenishment." }
];

export default function HomeScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserStatsResponse | null>(null);
  const [recentScans, setRecentScans] = useState<ScanHistoryItem[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadHomeData();
  }, []);

  const loadHomeData = async () => {
    try {
      const [prof, st, hist] = await Promise.all([
        getUserProfile("default_user").catch(() => null),
        getUserStats("default_user").catch(() => null),
        getScanHistory("default_user", 6).catch(() => [])
      ]);
      if (prof) setProfile(prof);
      if (st) setStats(st);
      if (hist) setRecentScans(hist);
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

  // Time-aware greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const avgHealthScore = recentScans.length > 0
    ? Math.round(recentScans.reduce((a, b) => a + b.health_score, 0) / recentScans.length)
    : 86;

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
          paddingBottom: 20,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <View>
            <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textMuted, textTransform: "uppercase", letterSpacing: 1 }}>
              {getGreeting()},
            </Text>
            <Text style={{ fontSize: 26, fontWeight: "900", color: colors.text, letterSpacing: -0.5 }}>
              Jishan Ahmed 👋
            </Text>
          </View>

          {/* Quick Streak & XP Pill */}
          <TouchableOpacity
            onPress={() => router.push("/profile" as any)}
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
                {stats?.current_streak || 14}d Streak
              </Text>
              <Text style={{ fontSize: 10, fontWeight: "700", color: colors.emerald }}>
                {stats?.xp || 450} XP
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Hero Health Status Card with Animated Score Ring */}
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
                <Text style={{ fontSize: 20, fontWeight: "900", color: colors.text, lineHeight: 26 }}>
                  {avgHealthScore >= 80 ? "Clean Whole Food Diet" : "Moderately Balanced"}
                </Text>
                <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4, lineHeight: 18 }}>
                  Based on your recent food scans and dietary preferences.
                </Text>

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
                  <Text style={{ color: "#FFF", fontSize: 13, fontWeight: "800" }}>📷 Scan Product</Text>
                </TouchableOpacity>
              </View>

              {/* Animated Health Score Ring */}
              <ScoreRing score={avgHealthScore} size={120} strokeWidth={9} label="SCORE" showGrade={true} />
            </View>

            {/* Daily Nutrient Progress Bars */}
            <View style={{ marginTop: 22, paddingTop: 18, borderTopWidth: 1, borderTopColor: colors.border, gap: 12 }}>
              <Text style={{ fontSize: 12, fontWeight: "800", color: colors.textMuted, textTransform: "uppercase" }}>
                Daily Nutritional Limits & Goals
              </Text>

              {/* Added Sugar Progress */}
              <View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: colors.text }}>Added Sugar Limit</Text>
                  <Text style={{ fontSize: 12, fontWeight: "800", color: colors.amber }}>65% (16g / 25g)</Text>
                </View>
                <View style={{ height: 6, backgroundColor: colors.cardAlt, borderRadius: 3, overflow: "hidden" }}>
                  <View style={{ width: "65%", height: "100%", backgroundColor: colors.amber, borderRadius: 3 }} />
                </View>
              </View>

              {/* Sodium Progress */}
              <View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: colors.text }}>Sodium Ceiling</Text>
                  <Text style={{ fontSize: 12, fontWeight: "800", color: colors.emerald }}>42% (980mg / 2300mg)</Text>
                </View>
                <View style={{ height: 6, backgroundColor: colors.cardAlt, borderRadius: 3, overflow: "hidden" }}>
                  <View style={{ width: "42%", height: "100%", backgroundColor: colors.emerald, borderRadius: 3 }} />
                </View>
              </View>

              {/* Clean Plant Protein Goal */}
              <View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: colors.text }}>Clean Protein Target</Text>
                  <Text style={{ fontSize: 12, fontWeight: "800", color: colors.blue }}>88% (52g / 60g)</Text>
                </View>
                <View style={{ height: 6, backgroundColor: colors.cardAlt, borderRadius: 3, overflow: "hidden" }}>
                  <View style={{ width: "88%", height: "100%", backgroundColor: colors.blue, borderRadius: 3 }} />
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Weekly Health Score Chart Widget */}
        <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
          <WeeklyChart />
        </View>

        {/* Recent Scans Carousel */}
        <View style={{ marginBottom: 24 }}>
          <View style={{ paddingHorizontal: 20, flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <View>
              <Text style={{ fontSize: 18, fontWeight: "900", color: colors.text }}>Recent Food Scans</Text>
              <Text style={{ fontSize: 12, color: colors.textMuted }}>Tap any product to view full intelligence</Text>
            </View>
            <TouchableOpacity onPress={() => router.push("/history")}>
              <Text style={{ fontSize: 13, fontWeight: "800", color: colors.emerald }}>View All →</Text>
            </TouchableOpacity>
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
                padding: 20,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: colors.border
              }}>
                <Text style={{ color: colors.textMuted, fontSize: 13 }}>No scans yet. Tap scan below to start!</Text>
              </View>
            )}
          </ScrollView>
        </View>

        {/* Healthy Product Recommendations */}
        <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <View>
              <Text style={{ fontSize: 18, fontWeight: "900", color: colors.text }}>Healthy Swaps & Superfoods</Text>
              <Text style={{ fontSize: 12, color: colors.textMuted }}>Clean-label verified whole foods</Text>
            </View>
          </View>

          <View style={{ gap: 10 }}>
            {HEALTHY_SUGGESTIONS.map((item) => (
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
        </View>
      </ScrollView>

      {/* Global Floating Bottom Navigation */}
      <BottomNav />
    </View>
  );
}
