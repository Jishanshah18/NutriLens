import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, ScrollView, Share, Platform, Image } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AnalyzeResponse, PersonalizedRecommendation } from "../lib/api";
import { useTheme } from "../lib/ThemeContext";
import { ScoreRing } from "../components/ScoreRing";
import { BottomNav } from "../components/BottomNav";

type TabType = "nutrition" | "ingredients" | "alternatives";

function formatMacro(val: number | null | undefined, unit: string): string {
  if (val === null || val === undefined || isNaN(val)) {
    return "Not listed";
  }
  const formatted = Number.isInteger(val) ? val.toString() : val.toFixed(1);
  return `${formatted} ${unit}`;
}

export default function ResultsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors, isDark } = useTheme();

  const [activeTab, setActiveTab] = useState<TabType>("nutrition");
  const [data, setData] = useState<AnalyzeResponse | null>(null);

  useEffect(() => {
    if (params.data && typeof params.data === "string") {
      try {
        setData(JSON.parse(params.data));
      } catch (e) {
        console.warn("Notice parsing results data params:", e);
      }
    }
  }, [params.data]);

  if (!data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", padding: 20 }}>
        <Text style={{ fontSize: 16, color: colors.textMuted }}>Loading Analysis Intelligence...</Text>
      </View>
    );
  }

  // --- REJECTED / NON-FOOD ITEM SCREEN ---
  if (data.is_food === false && !data.health_score) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        {/* Header */}
        <View style={{
          paddingTop: Platform.OS === "ios" ? 50 : 42,
          paddingBottom: 12,
          paddingHorizontal: 18,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottomWidth: 1,
          borderBottomColor: colors.border
        }}>
          <TouchableOpacity
            onPress={() => router.push("/scanner")}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <Text style={{ fontSize: 16, color: colors.text }}>←</Text>
          </TouchableOpacity>

          <Text style={{ fontSize: 16, fontWeight: "900", color: colors.text }}>
            Scan Result
          </Text>

          <TouchableOpacity
            onPress={() => router.push("/")}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <Text style={{ fontSize: 16 }}>🏠</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 40, alignItems: "center" }}>
          <View style={{
            width: 88,
            height: 88,
            borderRadius: 44,
            backgroundColor: `${colors.crimson}18`,
            borderWidth: 2,
            borderColor: colors.crimson,
            alignItems: "center",
            justifyContent: "center",
            marginTop: 20,
            marginBottom: 16
          }}>
            <Text style={{ fontSize: 42 }}>🛑</Text>
          </View>

          <Text style={{ fontSize: 22, fontWeight: "900", color: colors.text, textAlign: "center", marginBottom: 6 }}>
            Unrecognized Product or Label
          </Text>

          <View style={{
            width: "100%",
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 22,
            padding: 18,
            marginBottom: 18,
            gap: 12
          }}>
            <Text style={{ fontSize: 14, fontWeight: "800", color: colors.crimson, textTransform: "uppercase" }}>
              ⚠️ Label Analysis Notice
            </Text>
            <Text style={{ fontSize: 14, color: colors.text, lineHeight: 20 }}>
              {data.rejection_reason || "Unable to extract nutrition or ingredient facts from this scan. Please point camera directly at the nutrition table or ingredients panel."}
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={{ width: "100%", gap: 12, marginTop: 10 }}>
            <TouchableOpacity
              onPress={() => router.push("/scanner")}
              style={{
                backgroundColor: colors.emerald,
                borderRadius: 18,
                paddingVertical: 14,
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <Text style={{ color: "#FFF", fontSize: 15, fontWeight: "900" }}>
                📸 Try Scanning Again
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push("/profile" as any)}
              style={{
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: 18,
                paddingVertical: 14,
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: "800" }}>
                🛡️ View My Health Conditions
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
        <BottomNav />
      </View>
    );
  }

  // --- RECONSTRUCT PERSONALIZED RECOMMENDATION IF NEEDED ---
  const rec: PersonalizedRecommendation = data.personalized_recommendation || {
    status: data.health_score >= 75 ? "Good Choice" : data.health_score >= 50 ? "Moderately Suitable" : "Not Recommended",
    headline: data.health_score >= 75 ? "Suitable For Your Health Profile" : data.health_score >= 50 ? "Moderately Suitable" : "Not Recommended",
    health_conditions_considered: ["General Wellness"],
    reasons: [data.personalized_verdict || "Evaluated against general nutritional guidelines."],
    key_concerns: data.ingredient_risks || [],
    positive_notes: data.positive_attributes || ["Contains natural energy sources."],
    better_alternative: null,
    medical_disclaimer: "AI nutritional guidance only. Not a medical diagnosis. Consult a healthcare professional."
  };

  // Status Badge Configuration
  const getStatusConfig = (status: string) => {
    const s = (status || "").toLowerCase();
    if (s.includes("not recommended") || s.includes("harmful")) {
      return {
        label: "✕ Not Recommended",
        badgeColor: "#EF4444",
        badgeBg: "rgba(239, 68, 68, 0.15)",
        borderColor: "#EF4444",
        icon: "✕"
      };
    }
    if (s.includes("limit") || s.includes("moderate") || s.includes("caution")) {
      return {
        label: "⚠ Limit Consumption",
        badgeColor: "#F59E0B",
        badgeBg: "rgba(245, 158, 11, 0.15)",
        borderColor: "#F59E0B",
        icon: "⚠"
      };
    }
    return {
      label: "✓ Good Choice",
      badgeColor: "#10B981",
      badgeBg: "rgba(16, 185, 129, 0.15)",
      borderColor: "#10B981",
      icon: "✓"
    };
  };

  const statusConfig = getStatusConfig(rec.status);

  // Nutrient calculations & highlighting
  const macros = data.nutrition_estimate;
  const sugarVal = macros?.sugar_g;
  const sodiumVal = macros?.sodium_mg;
  const fiberVal = macros?.fiber_g;
  const proteinVal = macros?.protein_g;
  const fatVal = macros?.fat_g;
  const calVal = macros?.calories;

  const handleShare = async () => {
    try {
      await Share.share({
        message: `NutriLens Intelligence Report for ${data.product_name || "Food Product"}: AI Verdict: ${rec.status} (${rec.headline}). Health Score: ${data.health_score}/100.`
      });
    } catch (e) {}
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Top Header Bar */}
      <View style={{
        paddingTop: Platform.OS === "ios" ? 50 : 42,
        paddingBottom: 12,
        paddingHorizontal: 18,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        borderBottomWidth: 1,
        borderBottomColor: colors.border
      }}>
        <TouchableOpacity
          onPress={() => router.push("/scanner")}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <Text style={{ fontSize: 16, color: colors.text }}>←</Text>
        </TouchableOpacity>

        <Text style={{ fontSize: 16, fontWeight: "900", color: colors.text }}>
          AI Health Intelligence
        </Text>

        <TouchableOpacity
          onPress={handleShare}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <Text style={{ fontSize: 16 }}>📤</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
        {/* 1. PRODUCT INFORMATION HERO CARD */}
        <View style={{
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 28,
          padding: 20,
          marginBottom: 16,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.15,
          shadowRadius: 14,
          elevation: 4
        }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 14 }}>
            {/* Product Image or Icon */}
            {data.image_url ? (
              <Image
                source={{ uri: data.image_url }}
                style={{ width: 68, height: 68, borderRadius: 20, backgroundColor: colors.cardAlt }}
                resizeMode="cover"
              />
            ) : (
              <View style={{
                width: 68,
                height: 68,
                borderRadius: 20,
                backgroundColor: statusConfig.badgeBg,
                borderWidth: 1.5,
                borderColor: statusConfig.borderColor,
                alignItems: "center",
                justifyContent: "center"
              }}>
                <Text style={{ fontSize: 32 }}>🥗</Text>
              </View>
            )}

            <View style={{ flex: 1 }}>
              {/* Brand & Category */}
              {(data.brand || data.category) && (
                <Text style={{ fontSize: 11, fontWeight: "800", color: colors.emerald, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  {[data.brand, data.category].filter(Boolean).join(" • ")}
                </Text>
              )}
              {/* Product Name */}
              <Text style={{ fontSize: 20, fontWeight: "900", color: colors.text, marginTop: 2 }}>
                {data.product_name || "Scanned Food Product"}
              </Text>
            </View>
          </View>

          {/* Health Score Gauge & Nova Level Row */}
          <View style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 18,
            paddingTop: 16,
            borderTopWidth: 1,
            borderTopColor: colors.border
          }}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ fontSize: 11, fontWeight: "800", color: colors.textMuted, textTransform: "uppercase" }}>
                Nutritional Integrity
              </Text>
              <Text style={{ fontSize: 15, fontWeight: "800", color: statusConfig.badgeColor, marginTop: 2 }}>
                Score: {data.health_score}/100
              </Text>
              <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                {data.nova_group === 4
                  ? "Ultra-Processed Formulation (NOVA 4)"
                  : data.nova_group === 3
                  ? "Moderately Processed (NOVA 3)"
                  : "Minimally Processed / Whole Food"}
              </Text>
            </View>

            <ScoreRing score={data.health_score} size={88} strokeWidth={8} label="SCORE" showGrade={true} />
          </View>
        </View>

        {/* 2. PROMINENT AI RECOMMENDATION STATUS BADGE */}
        <View style={{
          backgroundColor: statusConfig.badgeBg,
          borderColor: statusConfig.borderColor,
          borderWidth: 2,
          borderRadius: 24,
          padding: 18,
          marginBottom: 16,
          gap: 10
        }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{
              backgroundColor: statusConfig.badgeColor,
              paddingHorizontal: 14,
              paddingVertical: 6,
              borderRadius: 20
            }}>
              <Text style={{ color: "#FFF", fontSize: 13, fontWeight: "900", letterSpacing: 0.3 }}>
                {statusConfig.label}
              </Text>
            </View>

            <Text style={{ fontSize: 11, fontWeight: "800", color: colors.textMuted }}>
              AI Clinically Evaluated
            </Text>
          </View>

          <Text style={{ fontSize: 17, fontWeight: "900", color: colors.text, marginTop: 2 }}>
            {rec.headline}
          </Text>

          {/* User's Considered Health Conditions Strip */}
          {rec.health_conditions_considered && rec.health_conditions_considered.length > 0 && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 4 }}>
              <Text style={{ fontSize: 11, fontWeight: "800", color: colors.textMuted }}>
                Evaluated for:
              </Text>
              {rec.health_conditions_considered.map((cond) => (
                <View
                  key={cond}
                  style={{
                    backgroundColor: colors.card,
                    borderColor: statusConfig.borderColor,
                    borderWidth: 1,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 10
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: "800", color: colors.text }}>
                    {cond}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>


        {/* ALLERGEN PACKAGING SAFETY WARNING */}
        <View style={{
          backgroundColor: "rgba(245, 158, 11, 0.1)",
          borderColor: "rgba(245, 158, 11, 0.4)",
          borderWidth: 1,
          borderRadius: 18,
          padding: 12,
          marginBottom: 16,
          flexDirection: "row",
          alignItems: "center",
          gap: 10
        }}>
          <Text style={{ fontSize: 20 }}>⚠️</Text>
          <Text style={{ color: colors.text, fontSize: 11, flex: 1, lineHeight: 16 }}>
            {rec.allergens_safety_note || "Always verify allergen and ingredient information on the physical product packaging, especially if you have a severe food allergy."}
          </Text>
        </View>

        {/* 3. PERSONALIZED EXPLANATION (CONDITION-SPECIFIC) */}
        <View style={{
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 24,
          padding: 18,
          marginBottom: 16,
          gap: 12
        }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ fontSize: 20 }}>🧠</Text>
            <Text style={{ fontSize: 15, fontWeight: "900", color: colors.text }}>
              Condition-Specific Explanation
            </Text>
          </View>

          {rec.reasons && rec.reasons.length > 0 ? (
            <View style={{ gap: 8 }}>
              {rec.reasons.map((reason, idx) => (
                <View key={idx} style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                  <Text style={{ color: statusConfig.badgeColor, fontSize: 14, marginTop: 1 }}>•</Text>
                  <Text style={{ fontSize: 13, color: colors.text, flex: 1, lineHeight: 19 }}>
                    {reason}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={{ fontSize: 13, color: colors.text, lineHeight: 19 }}>
              {data.personalized_verdict}
            </Text>
          )}

          {/* Positive Notes */}
          {rec.positive_notes && rec.positive_notes.length > 0 && (
            <View style={{
              backgroundColor: "rgba(16, 185, 129, 0.08)",
              borderColor: "rgba(16, 185, 129, 0.3)",
              borderWidth: 1,
              borderRadius: 14,
              padding: 12,
              marginTop: 4,
              gap: 4
            }}>
              <Text style={{ fontSize: 11, fontWeight: "800", color: colors.emerald, textTransform: "uppercase" }}>
                ✓ Positive Nutritional Highlights
              </Text>
              {rec.positive_notes.map((note, idx) => (
                <Text key={idx} style={{ fontSize: 12, color: colors.text, lineHeight: 17 }}>
                  • {note}
                </Text>
              ))}
            </View>
          )}
        </View>

        {/* 4. KEY CONCERNS CARD */}
        {rec.key_concerns && rec.key_concerns.length > 0 && (
          <View style={{
            backgroundColor: colors.card,
            borderColor: "rgba(239, 68, 68, 0.35)",
            borderWidth: 1,
            borderRadius: 24,
            padding: 18,
            marginBottom: 16,
            gap: 10
          }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ fontSize: 20 }}>⚠️</Text>
              <Text style={{ fontSize: 15, fontWeight: "900", color: colors.crimson }}>
                Key Health & Nutritional Concerns
              </Text>
            </View>

            <View style={{ gap: 8, marginTop: 4 }}>
              {rec.key_concerns.map((concern, idx) => (
                <View
                  key={idx}
                  style={{
                    backgroundColor: "rgba(239, 68, 68, 0.08)",
                    borderColor: "rgba(239, 68, 68, 0.2)",
                    borderWidth: 1,
                    borderRadius: 12,
                    padding: 10,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8
                  }}
                >
                  <Text style={{ color: colors.crimson, fontWeight: "900", fontSize: 14 }}>✕</Text>
                  <Text style={{ color: colors.text, fontSize: 13, fontWeight: "600", flex: 1 }}>
                    {concern}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* 5. 6 NUTRITION CARDS WITH HIGHLIGHT BADGES */}
        <View style={{
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 24,
          padding: 18,
          marginBottom: 16,
          gap: 14
        }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View>
              <Text style={{ fontSize: 16, fontWeight: "900", color: colors.text }}>
                Nutritional Breakdown
              </Text>
              <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                {macros?.serving_size ? `Per serving: ${macros.serving_size}` : "As stated on scanned packaging"}
              </Text>
            </View>

            <View style={{
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 10,
              backgroundColor: "rgba(16, 185, 129, 0.12)",
              borderWidth: 1,
              borderColor: colors.emerald
            }}>
              <Text style={{ fontSize: 10, fontWeight: "800", color: colors.emerald }}>
                Scanned Label
              </Text>
            </View>
          </View>

          {/* 6 Nutrition Cards Grid (Calories, Sugar, Protein, Fat, Sodium, Fiber) */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {/* Card 1: Calories */}
            <View style={{
              width: "48%",
              backgroundColor: colors.cardAlt,
              padding: 14,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: colors.border
            }}>
              <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: "700" }}>Calories</Text>
              <Text style={{ fontSize: 20, fontWeight: "900", color: colors.text, marginTop: 4 }}>
                {formatMacro(calVal, "kcal")}
              </Text>
              {calVal && calVal > 300 && (
                <View style={{ alignSelf: "flex-start", marginTop: 6, backgroundColor: "rgba(245, 158, 11, 0.15)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                  <Text style={{ color: colors.amber, fontSize: 9, fontWeight: "800" }}>High Calorie</Text>
                </View>
              )}
            </View>

            {/* Card 2: Sugar (Highlight for Diabetes) */}
            <View style={{
              width: "48%",
              backgroundColor: colors.cardAlt,
              padding: 14,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: sugarVal && sugarVal > 10 ? "rgba(239, 68, 68, 0.4)" : colors.border
            }}>
              <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: "700" }}>Sugars</Text>
              <Text style={{ fontSize: 20, fontWeight: "900", color: sugarVal && sugarVal > 10 ? colors.crimson : colors.text, marginTop: 4 }}>
                {formatMacro(sugarVal, "g")}
              </Text>
              {sugarVal !== null && sugarVal !== undefined && (
                <View style={{
                  alignSelf: "flex-start",
                  marginTop: 6,
                  backgroundColor: sugarVal > 10 ? "rgba(239, 68, 68, 0.15)" : "rgba(16, 185, 129, 0.15)",
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: 6
                }}>
                  <Text style={{ color: sugarVal > 10 ? colors.crimson : colors.emerald, fontSize: 9, fontWeight: "800" }}>
                    {sugarVal > 10 ? "High Sugar ⚠️" : "Low Sugar ✓"}
                  </Text>
                </View>
              )}
            </View>

            {/* Card 3: Protein */}
            <View style={{
              width: "48%",
              backgroundColor: colors.cardAlt,
              padding: 14,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: colors.border
            }}>
              <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: "700" }}>Protein</Text>
              <Text style={{ fontSize: 20, fontWeight: "900", color: colors.emerald, marginTop: 4 }}>
                {formatMacro(proteinVal, "g")}
              </Text>
              {proteinVal && proteinVal >= 8 && (
                <View style={{ alignSelf: "flex-start", marginTop: 6, backgroundColor: "rgba(16, 185, 129, 0.15)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                  <Text style={{ color: colors.emerald, fontSize: 9, fontWeight: "800" }}>Good Source ✓</Text>
                </View>
              )}
            </View>

            {/* Card 4: Total Fat */}
            <View style={{
              width: "48%",
              backgroundColor: colors.cardAlt,
              padding: 14,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: colors.border
            }}>
              <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: "700" }}>Total Fat</Text>
              <Text style={{ fontSize: 20, fontWeight: "900", color: colors.text, marginTop: 4 }}>
                {formatMacro(fatVal, "g")}
              </Text>
              {fatVal && fatVal > 15 && (
                <View style={{ alignSelf: "flex-start", marginTop: 6, backgroundColor: "rgba(245, 158, 11, 0.15)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                  <Text style={{ color: colors.amber, fontSize: 9, fontWeight: "800" }}>Elevated Fat</Text>
                </View>
              )}
            </View>

            {/* Card 5: Sodium (Highlight for High BP) */}
            <View style={{
              width: "48%",
              backgroundColor: colors.cardAlt,
              padding: 14,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: sodiumVal && sodiumVal > 400 ? "rgba(239, 68, 68, 0.4)" : colors.border
            }}>
              <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: "700" }}>Sodium</Text>
              <Text style={{ fontSize: 20, fontWeight: "900", color: sodiumVal && sodiumVal > 400 ? colors.crimson : colors.blue, marginTop: 4 }}>
                {formatMacro(sodiumVal, "mg")}
              </Text>
              {sodiumVal !== null && sodiumVal !== undefined && (
                <View style={{
                  alignSelf: "flex-start",
                  marginTop: 6,
                  backgroundColor: sodiumVal > 400 ? "rgba(239, 68, 68, 0.15)" : "rgba(16, 185, 129, 0.15)",
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: 6
                }}>
                  <Text style={{ color: sodiumVal > 400 ? colors.crimson : colors.emerald, fontSize: 9, fontWeight: "800" }}>
                    {sodiumVal > 400 ? "High Sodium ⚠️" : "Low Sodium ✓"}
                  </Text>
                </View>
              )}
            </View>

            {/* Card 6: Fiber (Highlight for Gut & Metabolic Health) */}
            <View style={{
              width: "48%",
              backgroundColor: colors.cardAlt,
              padding: 14,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: colors.border
            }}>
              <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: "700" }}>Dietary Fiber</Text>
              <Text style={{ fontSize: 20, fontWeight: "900", color: colors.emerald, marginTop: 4 }}>
                {formatMacro(fiberVal, "g")}
              </Text>
              {fiberVal && fiberVal >= 3 && (
                <View style={{ alignSelf: "flex-start", marginTop: 6, backgroundColor: "rgba(16, 185, 129, 0.15)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                  <Text style={{ color: colors.emerald, fontSize: 9, fontWeight: "800" }}>High Fiber ✓</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* 6. HEALTHIER ALTERNATIVE CARD */}
        {(rec.better_alternative || (data.healthier_alternatives && data.healthier_alternatives.length > 0)) && (
          <View style={{
            backgroundColor: colors.card,
            borderColor: "rgba(16, 185, 129, 0.35)",
            borderWidth: 1,
            borderRadius: 24,
            padding: 18,
            marginBottom: 16,
            gap: 12
          }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ fontSize: 20 }}>🌿</Text>
              <Text style={{ fontSize: 15, fontWeight: "900", color: colors.emerald }}>
                Healthier Alternative Advice
              </Text>
            </View>

            {rec.better_alternative && (
              <View style={{
                backgroundColor: "rgba(16, 185, 129, 0.08)",
                borderColor: "rgba(16, 185, 129, 0.25)",
                borderWidth: 1,
                borderRadius: 14,
                padding: 12
              }}>
                <Text style={{ fontSize: 12, fontWeight: "800", color: colors.emerald }}>
                  AI Nutritionist Suggestion:
                </Text>
                <Text style={{ fontSize: 13, color: colors.text, marginTop: 4, lineHeight: 18 }}>
                  {rec.better_alternative}
                </Text>
              </View>
            )}

            {data.healthier_alternatives && data.healthier_alternatives.map((alt, idx) => (
              <View
                key={idx}
                style={{
                  backgroundColor: colors.cardAlt,
                  padding: 14,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: colors.border,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}
              >
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={{ fontSize: 14, fontWeight: "800", color: colors.text }}>{alt.name}</Text>
                  <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>{alt.reason}</Text>
                </View>
                <View style={{
                  backgroundColor: "rgba(16, 185, 129, 0.15)",
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 12
                }}>
                  <Text style={{ color: colors.emerald, fontSize: 12, fontWeight: "900" }}>
                    {alt.estimated_health_score}/100
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* 7. MEDICAL DISCLAIMER CARD */}
        <View style={{
          backgroundColor: "rgba(255,255,255,0.04)",
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 18,
          padding: 14,
          marginBottom: 20,
          flexDirection: "row",
          alignItems: "flex-start",
          gap: 10
        }}>
          <Text style={{ fontSize: 18 }}>⚖️</Text>
          <Text style={{ color: colors.textMuted, fontSize: 11, flex: 1, lineHeight: 16 }}>
            {rec.medical_disclaimer || "AI nutritional guidance only. Not a medical diagnosis. Consult a healthcare professional before altering your medical diet."}
          </Text>
        </View>

        {/* 8. NAVIGATION ACTIONS */}
        <View style={{ gap: 12 }}>
          {/* Scan Another Product */}
          <TouchableOpacity
            onPress={() => router.push("/scanner")}
            style={{
              backgroundColor: colors.emerald,
              borderRadius: 20,
              paddingVertical: 15,
              alignItems: "center",
              justifyContent: "center",
              shadowColor: colors.emerald,
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.35,
              shadowRadius: 10
            }}
          >
            <Text style={{ color: "#FFF", fontSize: 15, fontWeight: "900" }}>
              📷 Scan Another Product
            </Text>
          </TouchableOpacity>

          {/* Edit Health Conditions */}
          <TouchableOpacity
            onPress={() => router.push("/profile" as any)}
            style={{
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderWidth: 1.5,
              borderRadius: 20,
              paddingVertical: 14,
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: "800" }}>
              🛡️ Edit Health Conditions & Profile
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Global Bottom Navigation */}
      <BottomNav />
    </View>
  );
}
