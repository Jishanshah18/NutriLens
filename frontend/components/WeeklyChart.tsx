import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useTheme } from "../lib/ThemeContext";

interface DayData {
  day: string;
  score: number;
  scans: number;
}

const DEFAULT_DAYS: DayData[] = [
  { day: "Mon", score: 82, scans: 3 },
  { day: "Tue", score: 74, scans: 2 },
  { day: "Wed", score: 91, scans: 4 },
  { day: "Thu", score: 68, scans: 3 },
  { day: "Fri", score: 85, scans: 5 },
  { day: "Sat", score: 94, scans: 2 },
  { day: "Sun", score: 88, scans: 3 },
];

export const WeeklyChart: React.FC<{ data?: DayData[] }> = ({ data = DEFAULT_DAYS }) => {
  const { colors } = useTheme();
  const maxScore = 100;
  const avgScore = Math.round(data.reduce((acc, d) => acc + d.score, 0) / data.length);

  const getBarColor = (score: number) => {
    if (score >= 80) return colors.emerald;
    if (score >= 55) return colors.amber;
    return colors.crimson;
  };

  return (
    <View style={{
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 24,
      padding: 18,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 10,
      elevation: 3
    }}>
      {/* Chart Header */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <View>
          <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text }}>Weekly Health Score</Text>
          <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>7-day nutritional purity trend</Text>
        </View>
        <View style={{
          backgroundColor: `${colors.emerald}20`,
          borderColor: `${colors.emerald}50`,
          borderWidth: 1,
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 20
        }}>
          <Text style={{ fontSize: 12, fontWeight: "800", color: colors.emerald }}>
            Avg: {avgScore}/100
          </Text>
        </View>
      </View>

      {/* Bars Container */}
      <View style={{
        flexDirection: "row",
        alignItems: "flex-end",
        justifyContent: "space-between",
        height: 120,
        paddingTop: 10,
        paddingBottom: 4
      }}>
        {data.map((item, idx) => {
          const barHeight = Math.max(16, (item.score / maxScore) * 90);
          const barColor = getBarColor(item.score);
          const isToday = idx === data.length - 1;

          return (
            <View key={item.day} style={{ alignItems: "center", flex: 1 }}>
              {/* Score Value Tag */}
              <Text style={{
                fontSize: 10,
                fontWeight: "700",
                color: isToday ? colors.text : colors.textDim,
                marginBottom: 4
              }}>
                {item.score}
              </Text>

              {/* Bar Track & Fill */}
              <View style={{
                width: 18,
                height: 90,
                backgroundColor: colors.cardAlt,
                borderRadius: 9,
                justifyContent: "flex-end",
                overflow: "hidden"
              }}>
                <View style={{
                  width: "100%",
                  height: barHeight,
                  backgroundColor: barColor,
                  borderRadius: 9,
                  shadowColor: barColor,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: isToday ? 0.8 : 0.3,
                  shadowRadius: 6,
                  elevation: 2
                }} />
              </View>

              {/* Day Label */}
              <Text style={{
                fontSize: 11,
                fontWeight: isToday ? "800" : "600",
                color: isToday ? colors.emerald : colors.textMuted,
                marginTop: 8
              }}>
                {item.day}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Chart Footer Indicator */}
      <View style={{
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        gap: 16,
        marginTop: 14,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: colors.border
      }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.emerald }} />
          <Text style={{ fontSize: 11, color: colors.textMuted }}>Clean (80+)</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.amber }} />
          <Text style={{ fontSize: 11, color: colors.textMuted }}>Moderate (55-79)</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.crimson }} />
          <Text style={{ fontSize: 11, color: colors.textMuted }}>Processed (&lt;55)</Text>
        </View>
      </View>
    </View>
  );
};
