import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "../lib/ThemeContext";
import { WeeklyChart } from "../components/WeeklyChart";
import { BottomNav } from "../components/BottomNav";

const CLEAN_BRANDS = [
  { name: "Organic Valley", score: 96, label: "Zero Artificial Preservatives", icon: "🌱" },
  { name: "Simple Mills", score: 93, label: "Almond & Coconut Flour Whole Snacks", icon: "🌾" },
  { name: "Artisana Organics", score: 91, label: "Raw Single-Ingredient Nut Butters", icon: "🥜" },
  { name: "Purely Elizabeth", score: 89, label: "Ancient Grain Chia Granola", icon: "🥣" }
];

const WATCHLIST_BRANDS = [
  { name: "MegaSnack Chips", score: 24, label: "Contains E621, E102, Refined Palm Oil", icon: "🍟" },
  { name: "UltraCola Refresh", score: 18, label: "High Fructose Corn Syrup & Phosphoric Acid", icon: "🥤" },
  { name: "SweetCrave Frosting", score: 22, label: "Hydrogenated Trans-Fats & Titanium Dioxide", icon: "🧁" }
];

export default function InsightsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [timeRange, setTimeRange] = useState<"week" | "month" | "all">("week");

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
            Longitudinal dietary purity analytics
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

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 20 }}>
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
              78%
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
              22%
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
              84<Text style={{ fontSize: 14, color: colors.textDim }}>/100</Text>
            </Text>
            <Text style={{ fontSize: 12, fontWeight: "800", color: colors.text, marginTop: 2 }}>
              Avg Purity Score
            </Text>
            <Text style={{ fontSize: 11, color: colors.emerald, fontWeight: "700", marginTop: 2 }}>
              +6 pts vs last week
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
              14
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
        <WeeklyChart />

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
              Recommended daily allowances calibrated for your profile
            </Text>
          </View>

          {/* Sugar Limit */}
          <View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: colors.text }}>Refined Added Sugars</Text>
              <Text style={{ fontSize: 12, fontWeight: "800", color: colors.amber }}>64% (16g / 25g)</Text>
            </View>
            <View style={{ height: 8, backgroundColor: colors.cardAlt, borderRadius: 4, overflow: "hidden" }}>
              <View style={{ width: "64%", height: "100%", backgroundColor: colors.amber, borderRadius: 4 }} />
            </View>
          </View>

          {/* Sodium Ceiling */}
          <View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: colors.text }}>Sodium Exposure</Text>
              <Text style={{ fontSize: 12, fontWeight: "800", color: colors.emerald }}>42% (980mg / 2300mg)</Text>
            </View>
            <View style={{ height: 8, backgroundColor: colors.cardAlt, borderRadius: 4, overflow: "hidden" }}>
              <View style={{ width: "42%", height: "100%", backgroundColor: colors.emerald, borderRadius: 4 }} />
            </View>
          </View>

          {/* Saturated Fats */}
          <View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: colors.text }}>Saturated Fats</Text>
              <Text style={{ fontSize: 12, fontWeight: "800", color: colors.blue }}>55% (11g / 20g)</Text>
            </View>
            <View style={{ height: 8, backgroundColor: colors.cardAlt, borderRadius: 4, overflow: "hidden" }}>
              <View style={{ width: "55%", height: "100%", backgroundColor: colors.blue, borderRadius: 4 }} />
            </View>
          </View>

          {/* Dietary Fiber Target */}
          <View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: colors.text }}>Dietary Prebiotic Fiber</Text>
              <Text style={{ fontSize: 12, fontWeight: "800", color: colors.emerald }}>93% (28g / 30g)</Text>
            </View>
            <View style={{ height: 8, backgroundColor: colors.cardAlt, borderRadius: 4, overflow: "hidden" }}>
              <View style={{ width: "93%", height: "100%", backgroundColor: colors.emerald, borderRadius: 4 }} />
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

          <View style={{ gap: 10 }}>
            {CLEAN_BRANDS.map((b, idx) => (
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

          <View style={{ gap: 10 }}>
            {WATCHLIST_BRANDS.map((b) => (
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
        </View>
      </ScrollView>

      {/* Global Bottom Navigation */}
      <BottomNav />
    </View>
  );
}
