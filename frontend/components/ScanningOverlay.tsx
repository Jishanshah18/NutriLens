import React, { useEffect, useState, useRef } from "react";
import { View, Text, Animated, StyleSheet, Easing } from "react-native";
import { useTheme } from "../lib/ThemeContext";

interface ScanningOverlayProps {
  onComplete?: () => void;
  productTitle?: string;
  healthConditions?: string[];
  activeStageIndex?: number;
}

export const STAGES = [
  { id: 1, key: "SCANNING", title: "Scanning Food Label", desc: "Detecting packaging, barcode, and typography..." },
  { id: 2, key: "PROCESSING", title: "Processing Nutrition Tokens", desc: "Extracting macros, calories, sodium, and ingredients..." },
  { id: 3, key: "ANALYZING", title: "Analyzing Health Conditions", desc: "Evaluating clinical thresholds against your personal profile..." },
  { id: 4, key: "EVALUATING", title: "Synthesizing AI Recommendation", desc: "Formulating condition-specific verdict & clean alternatives..." },
  { id: 5, key: "RESULT", title: "Intelligence Report Ready", desc: "Finalizing personalized nutrition breakdown..." }
];

export const ScanningOverlay: React.FC<ScanningOverlayProps> = ({ onComplete, productTitle, healthConditions, activeStageIndex }) => {
  const { colors } = useTheme();
  const [currentStage, setCurrentStage] = useState(activeStageIndex !== undefined ? activeStageIndex : 0);

  // Animation values
  const pulseRing1 = useRef(new Animated.Value(0.6)).current;
  const pulseRing2 = useRef(new Animated.Value(0.4)).current;
  const scanLine = useRef(new Animated.Value(0)).current;
  const progressVal = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (activeStageIndex !== undefined) {
      setCurrentStage(activeStageIndex);
      Animated.timing(progressVal, {
        toValue: (activeStageIndex + 1) / STAGES.length,
        duration: 350,
        useNativeDriver: false
      }).start();
    }
  }, [activeStageIndex]);

  useEffect(() => {
    // Pulse rings loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseRing1, { toValue: 1.2, duration: 1200, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseRing1, { toValue: 0.6, duration: 1000, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseRing2, { toValue: 1.35, duration: 1400, delay: 200, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseRing2, { toValue: 0.4, duration: 1100, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    // Scan line vertical loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanLine, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(scanLine, { toValue: 0, duration: 900, easing: Easing.linear, useNativeDriver: true }),
      ])
    ).start();

    // If activeStageIndex is not controlled externally, run the 5-stage simulation animation
    if (activeStageIndex === undefined) {
      Animated.timing(progressVal, {
        toValue: 1,
        duration: 2200,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: false
      }).start();

      const t1 = setTimeout(() => setCurrentStage(1), 450);
      const t2 = setTimeout(() => setCurrentStage(2), 900);
      const t3 = setTimeout(() => setCurrentStage(3), 1400);
      const t4 = setTimeout(() => setCurrentStage(4), 1900);
      const t5 = setTimeout(() => {
        if (onComplete) onComplete();
      }, 2300);

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
        clearTimeout(t4);
        clearTimeout(t5);
      };
    }
  }, []);

  const scanLineTranslate = scanLine.interpolate({
    inputRange: [0, 1],
    outputRange: [-60, 60]
  });

  const progressPercent = progressVal.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"]
  });

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(11, 15, 25, 0.95)", zIndex: 999, alignItems: "center", justifyContent: "center", padding: 24 }]}>
      {/* Central Holographic Pulse Scanner */}
      <View style={{ width: 180, height: 180, alignItems: "center", justifyContent: "center", marginBottom: 30 }}>
        {/* Outer Pulse Ring */}
        <Animated.View style={{
          position: "absolute",
          width: 170,
          height: 170,
          borderRadius: 85,
          borderWidth: 2,
          borderColor: "rgba(16, 185, 129, 0.25)",
          transform: [{ scale: pulseRing2 }],
          backgroundColor: "rgba(16, 185, 129, 0.05)"
        }} />

        {/* Inner Pulse Ring */}
        <Animated.View style={{
          position: "absolute",
          width: 130,
          height: 130,
          borderRadius: 65,
          borderWidth: 2,
          borderColor: "rgba(16, 185, 129, 0.6)",
          transform: [{ scale: pulseRing1 }],
          backgroundColor: "rgba(16, 185, 129, 0.12)"
        }} />

        {/* Center Scanner Core */}
        <View style={{
          width: 90,
          height: 90,
          borderRadius: 45,
          backgroundColor: "#131B2E",
          borderWidth: 3,
          borderColor: "#10B981",
          alignItems: "center",
          justifyContent: "center",
          shadowColor: "#10B981",
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.9,
          shadowRadius: 18,
          elevation: 10,
          overflow: "hidden"
        }}>
          <Text style={{ fontSize: 36 }}>🥗</Text>
          
          {/* Animated Laser Beam sweeping over center */}
          <Animated.View style={{
            position: "absolute",
            width: "120%",
            height: 3,
            backgroundColor: "#34D399",
            shadowColor: "#34D399",
            shadowRadius: 8,
            shadowOpacity: 1,
            transform: [{ translateY: scanLineTranslate }]
          }} />
        </View>
      </View>

      {/* Target Product Badge */}
      {productTitle && (
        <View style={{
          backgroundColor: "rgba(255,255,255,0.08)",
          paddingHorizontal: 14,
          paddingVertical: 6,
          borderRadius: 20,
          marginBottom: 16
        }}>
          <Text style={{ color: "#94A3B8", fontSize: 12, fontWeight: "600" }}>
            Analyzing: <Text style={{ color: "#F8FAFC", fontWeight: "800" }}>{productTitle.slice(0, 32)}</Text>
          </Text>
        </View>
      )}

      {/* Title & Stage Heading */}
      <Text style={{ color: "#F8FAFC", fontSize: 22, fontWeight: "900", textAlign: "center", letterSpacing: -0.5, marginBottom: 6 }}>
        AI Nutrition Intelligence
      </Text>
      <Text style={{ color: "#10B981", fontSize: 14, fontWeight: "700", textAlign: "center", marginBottom: 12 }}>
        {STAGES[currentStage]?.title || "Finalizing Intelligence Report..."}
      </Text>

      {/* Active Health Conditions Pill Strip */}
      {healthConditions && healthConditions.length > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6, marginBottom: 16, maxWidth: 320 }}>
          <Text style={{ color: "#94A3B8", fontSize: 11, fontWeight: "700", alignSelf: "center", marginRight: 4 }}>
            Evaluating:
          </Text>
          {healthConditions.map((cond) => (
            <View
              key={cond}
              style={{
                backgroundColor: "rgba(16, 185, 129, 0.15)",
                borderColor: "#10B981",
                borderWidth: 1,
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 10
              }}
            >
              <Text style={{ color: "#34D399", fontSize: 11, fontWeight: "800" }}>{cond}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Progress Bar */}
      <View style={{
        width: "85%",
        maxWidth: 320,
        height: 6,
        backgroundColor: "rgba(255,255,255,0.1)",
        borderRadius: 3,
        marginBottom: 24,
        overflow: "hidden"
      }}>
        <Animated.View style={{
          height: "100%",
          backgroundColor: "#10B981",
          borderRadius: 3,
          width: progressPercent
        }} />
      </View>

      {/* 4-Step Checkpoint List */}
      <View style={{ width: "90%", maxWidth: 330, gap: 10 }}>
        {STAGES.map((s, idx) => {
          const isDone = idx < currentStage;
          const isCurrent = idx === currentStage;
          const isPending = idx > currentStage;

          return (
            <View
              key={s.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: isCurrent ? "rgba(16, 185, 129, 0.15)" : "rgba(255,255,255,0.04)",
                borderColor: isCurrent ? "#10B981" : isDone ? "rgba(16, 185, 129, 0.4)" : "rgba(255,255,255,0.06)",
                borderWidth: 1,
                borderRadius: 14,
                padding: 10,
                paddingHorizontal: 14
              }}
            >
              {/* Status Dot / Icon */}
              <View style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                backgroundColor: isDone ? "#10B981" : isCurrent ? "#F59E0B" : "rgba(255,255,255,0.1)",
                alignItems: "center",
                justifyContent: "center",
                marginRight: 12
              }}>
                <Text style={{ color: "#FFF", fontSize: 11, fontWeight: "900" }}>
                  {isDone ? "✓" : isCurrent ? "●" : `${idx + 1}`}
                </Text>
              </View>

              {/* Step Info */}
              <View style={{ flex: 1 }}>
                <Text style={{
                  color: isCurrent ? "#F8FAFC" : isDone ? "#94A3B8" : "#64748B",
                  fontSize: 13,
                  fontWeight: isCurrent ? "800" : "600"
                }}>
                  {s.title}
                </Text>
                {isCurrent && (
                  <Text style={{ color: "#34D399", fontSize: 11, marginTop: 2 }}>
                    {s.desc}
                  </Text>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};
