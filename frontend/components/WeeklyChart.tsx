import React from "react";
import { View, Text } from "react-native";
import { useTheme } from "../lib/ThemeContext";

export interface DayData {
  day: string;
  score: number;
  scans: number;
}

export const DEFAULT_DAYS: DayData[] = [
  { day: "Mon", score: 82, scans: 3 },
  { day: "Tue", score: 74, scans: 2 },
  { day: "Wed", score: 91, scans: 4 },
  { day: "Thu", score: 68, scans: 3 },
  { day: "Fri", score: 85, scans: 5 },
  { day: "Sat", score: 94, scans: 2 },
  { day: "Sun", score: 88, scans: 3 },
];

const EMPTY_DAYS: DayData[] = [
  { day: "Mon", score: 0, scans: 0 },
  { day: "Tue", score: 0, scans: 0 },
  { day: "Wed", score: 0, scans: 0 },
  { day: "Thu", score: 0, scans: 0 },
  { day: "Fri", score: 0, scans: 0 },
  { day: "Sat", score: 0, scans: 0 },
  { day: "Sun", score: 0, scans: 0 },
];

interface WeeklyChartProps {
  data?: DayData[];
  isDemo?: boolean;
  isEmpty?: boolean;
  emptyMessage?: string;
  avgScore?: number | null;
}

export const WeeklyChart: React.FC<WeeklyChartProps> = ({
  data,
  isDemo = false,
  isEmpty = false,
  emptyMessage = "Your weekly report will appear after your first scan.",
  avgScore = null
}) => {
  const { colors } = useTheme();

  // If in demo mode and no custom data passed, use exact demo days
  const effectiveData = isDemo
    ? (data && data.length > 0 ? data : DEFAULT_DAYS)
    : (isEmpty ? EMPTY_DAYS : (data && data.length > 0 ? data : EMPTY_DAYS));

  const hasAnyData = isDemo || (!isEmpty && effectiveData.some((d) => d.scans > 0 || d.score > 0));

  const calculatedAvg = avgScore !== null && avgScore !== undefined
    ? Math.round(avgScore)
    : (hasAnyData
        ? Math.round(
            effectiveData
              .filter((d) => isDemo || d.scans > 0)
              .reduce((acc, d, _, arr) => acc + d.score / (arr.length || 1), 0)
          )
        : null);

  const getBarColor = (score: number, hasScans: boolean) => {
    if (!hasScans && !isDemo) return colors.border;
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
          <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
            {hasAnyData ? "7-day nutritional purity trend" : "Awaiting scan data"}
          </Text>
        </View>
        <View style={{
          backgroundColor: hasAnyData ? `${colors.emerald}20` : colors.cardAlt,
          borderColor: hasAnyData ? `${colors.emerald}50` : colors.border,
          borderWidth: 1,
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 20
        }}>
          <Text style={{
            fontSize: 12,
            fontWeight: "800",
            color: hasAnyData ? colors.emerald : colors.textMuted
          }}>
            {hasAnyData && calculatedAvg !== null ? `Avg: ${calculatedAvg}/100` : "Avg: —"}
          </Text>
        </View>
      </View>

      {/* Empty State Banner (if real user with no scans) */}
      {!hasAnyData && (
        <View style={{
          backgroundColor: `${colors.cardAlt}B0`,
          borderColor: colors.border,
          borderWidth: 1,
          borderStyle: "dashed",
          borderRadius: 14,
          paddingVertical: 10,
          paddingHorizontal: 14,
          marginBottom: 12,
          alignItems: "center"
        }}>
          <Text style={{ fontSize: 12, color: colors.textMuted, textAlign: "center", fontWeight: "600" }}>
            📊 {emptyMessage}
          </Text>
        </View>
      )}

      {/* Bars Container */}
      <View style={{
        flexDirection: "row",
        alignItems: "flex-end",
        justifyContent: "space-between",
        height: 120,
        paddingTop: 10,
        paddingBottom: 4
      }}>
        {effectiveData.map((item, idx) => {
          const hasDayScans = isDemo || item.scans > 0;
          const barHeight = hasDayScans
            ? Math.max(16, (item.score / 100) * 90)
            : 6;
          const barColor = getBarColor(item.score, hasDayScans);
          const isToday = idx === effectiveData.length - 1;

          return (
            <View key={item.day} style={{ alignItems: "center", flex: 1 }}>
              {/* Score Value Tag */}
              <Text style={{
                fontSize: 10,
                fontWeight: "700",
                color: hasDayScans
                  ? (isToday ? colors.text : colors.textDim)
                  : colors.textDim,
                marginBottom: 4,
                opacity: hasDayScans ? 1 : 0.4
              }}>
                {hasDayScans ? item.score : "—"}
              </Text>

              {/* Bar Track & Fill */}
              <View style={{
                width: 18,
                height: 90,
                backgroundColor: colors.cardAlt,
                borderRadius: 9,
                justifyContent: "flex-end",
                overflow: "hidden",
                borderWidth: hasDayScans ? 0 : 1,
                borderColor: colors.border
              }}>
                <View style={{
                  width: "100%",
                  height: barHeight,
                  backgroundColor: barColor,
                  borderRadius: 9,
                  opacity: hasDayScans ? 1 : 0.3,
                  shadowColor: barColor,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: hasDayScans && isToday ? 0.8 : (hasDayScans ? 0.3 : 0),
                  shadowRadius: 6,
                  elevation: hasDayScans ? 2 : 0
                }} />
              </View>

              {/* Day Label */}
              <Text style={{
                fontSize: 11,
                fontWeight: isToday ? "800" : "600",
                color: hasDayScans && isToday
                  ? colors.emerald
                  : (isToday ? colors.text : colors.textMuted),
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
