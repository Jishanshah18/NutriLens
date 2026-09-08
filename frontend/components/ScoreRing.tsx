import React, { useEffect, useRef } from "react";
import { View, Text, Animated, StyleSheet, Platform } from "react-native";

interface ScoreRingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  showGrade?: boolean;
}

export const ScoreRing: React.FC<ScoreRingProps> = ({
  score,
  size = 130,
  strokeWidth = 10,
  label = "HEALTH SCORE",
  showGrade = true
}) => {
  const animatedScore = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animatedScore, {
      toValue: score,
      duration: 1200,
      useNativeDriver: false
    }).start();
  }, [score]);

  // Color determination
  const getColor = (val: number) => {
    if (val >= 80) return "#10B981"; // Emerald
    if (val >= 50) return "#F59E0B"; // Amber
    return "#EF4444"; // Crimson
  };

  const color = getColor(score);

  const getGrade = (val: number) => {
    if (val >= 90) return { grade: "A+", text: "Clean Whole Food" };
    if (val >= 80) return { grade: "A", text: "Healthy Choice" };
    if (val >= 65) return { grade: "B", text: "Moderately Processed" };
    if (val >= 45) return { grade: "C", text: "High In Additives" };
    return { grade: "D", text: "Ultra-Processed" };
  };

  const { grade, text: gradeText } = getGrade(score);

  // SVG-based circle on web for perfect circular gauge
  if (Platform.OS === "web") {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (score / 100) * circumference;

    return (
      <View style={{ width: size, alignItems: "center", justifyContent: "center" }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          {/* Background Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="rgba(255,255,255,0.1)"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Animated Glow Fill */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            style={{
              transition: "stroke-dashoffset 1.2s ease-out, stroke 0.5s ease",
              filter: `drop-shadow(0px 0px 8px ${color}88)`
            }}
          />
        </svg>

        {/* Center Content */}
        <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}>
          <Text style={{ fontSize: size * 0.28, fontWeight: "900", color: "#F8FAFC", letterSpacing: -1 }}>
            {score}
          </Text>
          <Text style={{ fontSize: size * 0.08, fontWeight: "700", color: color, textTransform: "uppercase", letterSpacing: 1 }}>
            {label}
          </Text>
          {showGrade && (
            <View style={{
              marginTop: 4,
              backgroundColor: `${color}25`,
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: `${color}66`
            }}>
              <Text style={{ fontSize: size * 0.09, fontWeight: "800", color: color }}>
                Grade {grade}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  }

  // Pure React Native fallback ring
  return (
    <View style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      borderWidth: strokeWidth,
      borderColor: color,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(0,0,0,0.2)"
    }}>
      <Text style={{ fontSize: size * 0.28, fontWeight: "900", color: "#F8FAFC" }}>
        {score}
      </Text>
      <Text style={{ fontSize: size * 0.08, fontWeight: "700", color: color, textTransform: "uppercase" }}>
        {label}
      </Text>
    </View>
  );
};
