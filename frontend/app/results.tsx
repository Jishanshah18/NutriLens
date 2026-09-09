import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, ScrollView, Share, Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AnalyzeResponse } from "../lib/api";
import { useTheme } from "../lib/ThemeContext";
import { ScoreRing } from "../components/ScoreRing";
import { BottomNav } from "../components/BottomNav";

type TabType = "nutrition" | "ingredients" | "insights";

function formatMacro(val: number | null | undefined, unit: string): string {
  if (val === null || val === undefined || isNaN(val)) {
    return "--";
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

  // --- NON-FOOD / UNRECOGNIZED FOREIGN OBJECT SCREEN ---
  if (data.is_food === false) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        {/* Header */}
        <View style={{
          paddingTop: 44,
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
            Scan Audit Result
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
          {/* Warning Icon Badge */}
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
            marginBottom: 16,
            shadowColor: colors.crimson,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 12
          }}>
            <Text style={{ fontSize: 42 }}>🛑</Text>
          </View>

          {/* Main Title */}
          <Text style={{ fontSize: 22, fontWeight: "900", color: colors.text, textAlign: "center", marginBottom: 6 }}>
            Non-Food / Unrecognized Item
          </Text>

          <View style={{
            backgroundColor: `${colors.crimson}20`,
            borderColor: `${colors.crimson}60`,
            borderWidth: 1,
            paddingHorizontal: 12,
            paddingVertical: 4,
            borderRadius: 12,
            marginBottom: 20
          }}>
            <Text style={{ color: colors.crimson, fontSize: 12, fontWeight: "800", textTransform: "uppercase" }}>
              Database Match Status: No Food Match
            </Text>
          </View>

          {/* Rejection Details Card */}
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
              ⚠️ Why Was This Scanned Item Rejected?
            </Text>
            <Text style={{ fontSize: 14, color: colors.text, lineHeight: 20 }}>
              {data.rejection_reason || data.personalized_verdict}
            </Text>

            {data.barcode && (
              <View style={{ backgroundColor: colors.cardAlt, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textMuted }}>SCANNED BARCODE / GTIN:</Text>
                <Text style={{ fontSize: 15, fontWeight: "900", color: colors.text, marginTop: 2 }}>{data.barcode}</Text>
                <Text style={{ fontSize: 11, color: colors.amber, marginTop: 4 }}>
                  Not found in the global OpenFoodFacts registry or local food catalog.
                </Text>
              </View>
            )}

            {data.ocr_text && !data.barcode && (
              <View style={{ backgroundColor: colors.cardAlt, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textMuted }}>EXTRACTED SCANNED TEXT:</Text>
                <Text style={{ fontSize: 12, color: colors.text, marginTop: 4, lineHeight: 18 }} numberOfLines={5}>
                  {data.ocr_text}
                </Text>
              </View>
            )}
          </View>

          {/* Info Card explaining NutriLens purpose */}
          <View style={{
            width: "100%",
            backgroundColor: `${colors.emerald}10`,
            borderColor: `${colors.emerald}40`,
            borderWidth: 1,
            borderRadius: 20,
            padding: 16,
            marginBottom: 24,
            flexDirection: "row",
            gap: 12,
            alignItems: "flex-start"
          }}>
            <Text style={{ fontSize: 22 }}>💡</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.emerald, fontSize: 13, fontWeight: "800", marginBottom: 2 }}>
                What can NutriLens scan?
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 12, lineHeight: 18 }}>
                NutriLens analyzes packaged foods, beverages, snacks, and nutrition facts labels. Non-food items (electronics, hardware, apparel, receipts) or unlisted barcodes cannot be evaluated for health or nutrition.
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={{ width: "100%", gap: 12 }}>
            <TouchableOpacity
              onPress={() => router.push("/scanner")}
              style={{
                backgroundColor: colors.emerald,
                borderRadius: 18,
                paddingVertical: 14,
                alignItems: "center",
                justifyContent: "center",
                shadowColor: colors.emerald,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8
              }}
            >
              <Text style={{ color: "#FFF", fontSize: 15, fontWeight: "900" }}>
                📸 Scan a Food Item or Label
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push("/")}
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
                🏠 Back to Dashboard
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
        <BottomNav />
      </View>
    );
  }

  // --- VERIFIED FOOD PRODUCT SCREEN ---
  const isClean = data.health_score >= 80;
  const isModerate = data.health_score >= 50 && data.health_score < 80;
  const scoreColor = isClean ? colors.emerald : isModerate ? colors.amber : colors.crimson;

  // Food processing classification details
  const getProcessingBadge = (group: number = 3) => {
    switch (group) {
      case 1:
        return { label: "Whole & Natural Food", color: colors.emerald, bg: `${colors.emerald}20` };
      case 2:
        return { label: "Culinary Ingredient", color: colors.blue, bg: `${colors.blue}20` };
      case 3:
        return { label: "Moderately Processed", color: colors.amber, bg: `${colors.amber}20` };
      case 4:
      default:
        return { label: "Ultra-Processed Food", color: colors.crimson, bg: `${colors.crimson}20` };
    }
  };

  const processingBadge = getProcessingBadge(data.nova_group);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `NutriLens Intelligence Report for ${data.product_name || "Food Product"}: Health Score ${data.health_score}/100, ${processingBadge.label}. Verdict: ${data.personalized_verdict}`
      });
    } catch (e) {}
  };

  const handleAskAI = () => {
    router.push({
      pathname: "/chat" as any,
      params: {
        initialMessage: `Can you analyze the health effects and ingredients of ${data.product_name || "this product"}?`,
        productContext: JSON.stringify({
          name: data.product_name,
          score: data.health_score,
          processing_level: data.nova_group,
          additives: data.additives?.map((a) => a.code)
        })
      }
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Top Header Bar */}
      <View style={{
        paddingTop: 44,
        paddingBottom: 12,
        paddingHorizontal: 18,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        borderBottomWidth: 1,
        borderBottomColor: colors.border
      }}>
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
          <Text style={{ fontSize: 16, color: colors.text }}>←</Text>
        </TouchableOpacity>

        <Text style={{ fontSize: 16, fontWeight: "900", color: colors.text }}>
          Intelligence Report
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
        {/* Hero Product Card */}
        <View style={{
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 28,
          padding: 22,
          marginBottom: 16,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
          elevation: 4
        }}>
          {/* Top category & food icon */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <View style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: `${scoreColor}18`,
              alignItems: "center",
              justifyContent: "center"
            }}>
              <Text style={{ fontSize: 30 }}>{isClean ? "🥗" : isModerate ? "🥪" : "🥫"}</Text>
            </View>

            {/* Processing Grade Chip */}
            <View style={{
              backgroundColor: processingBadge.bg,
              borderColor: `${processingBadge.color}60`,
              borderWidth: 1,
              paddingHorizontal: 12,
              paddingVertical: 5,
              borderRadius: 16
            }}>
              <Text style={{ color: processingBadge.color, fontSize: 11, fontWeight: "800" }}>
                {processingBadge.label}
              </Text>
            </View>
          </View>

          {/* Product Name */}
          <Text style={{ fontSize: 22, fontWeight: "900", color: colors.text, marginBottom: 8 }}>
            {data.product_name || "Scanned Food Product"}
          </Text>

          {/* Animated Score Gauge Row */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
            <View style={{ flex: 1, paddingRight: 16 }}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textMuted, textTransform: "uppercase" }}>
                Nutritional Integrity
              </Text>
              <Text style={{ fontSize: 16, fontWeight: "800", color: scoreColor, marginTop: 4 }}>
                {isClean ? "Excellent Purity Rating" : isModerate ? "Moderate Processing" : "High Processing Risk"}
              </Text>
              <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4, lineHeight: 18 }}>
                {data.personalized_verdict}
              </Text>
            </View>

            <ScoreRing score={data.health_score} size={110} strokeWidth={9} label="SCORE" showGrade={true} />
          </View>
        </View>

        {/* Personalized User Profile Match & Dietary Audit Card */}
        {data.preference_audit && (
          <View style={{
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 24,
            padding: 18,
            marginBottom: 16,
            gap: 12
          }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ fontSize: 20 }}>👤</Text>
                <Text style={{ fontSize: 15, fontWeight: "900", color: colors.text }}>
                  Personalized Profile Match
                </Text>
              </View>
              <View style={{
                backgroundColor: data.preference_audit.is_safe_for_user ? `${colors.emerald}20` : `${colors.crimson}20`,
                borderColor: data.preference_audit.is_safe_for_user ? colors.emerald : colors.crimson,
                borderWidth: 1,
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 12
              }}>
                <Text style={{
                  color: data.preference_audit.is_safe_for_user ? colors.emerald : colors.crimson,
                  fontSize: 11,
                  fontWeight: "900"
                }}>
                  {data.preference_audit.is_safe_for_user ? "✓ Profile Aligned" : "⚠️ Conflict Detected"}
                </Text>
              </View>
            </View>

            {/* Allergen Audit Details */}
            {data.preference_audit.allergen_conflicts && data.preference_audit.allergen_conflicts.length > 0 && (
              <View style={{
                backgroundColor: `${colors.crimson}15`,
                borderColor: colors.crimson,
                borderWidth: 1,
                borderRadius: 14,
                padding: 12,
                flexDirection: "row",
                gap: 10,
                alignItems: "center"
              }}>
                <Text style={{ fontSize: 20 }}>🚨</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.crimson, fontSize: 13, fontWeight: "800" }}>
                    Allergen Alert: Contains {data.preference_audit.allergen_conflicts.join(", ")}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 1 }}>
                    Directly conflicts with your saved allergy profile.
                  </Text>
                </View>
              </View>
            )}

            {data.preference_audit.allergen_safe_notes && data.preference_audit.allergen_safe_notes.length > 0 && (
              <View style={{
                backgroundColor: `${colors.emerald}10`,
                borderColor: `${colors.emerald}30`,
                borderWidth: 1,
                borderRadius: 14,
                padding: 10,
                flexDirection: "row",
                gap: 8,
                alignItems: "center"
              }}>
                <Text style={{ fontSize: 16 }}>🛡️</Text>
                <Text style={{ color: colors.emerald, fontSize: 12, fontWeight: "700", flex: 1 }}>
                  {data.preference_audit.allergen_safe_notes[0]}
                </Text>
              </View>
            )}

            {/* Dietary Preference Matches / Conflicts */}
            {(data.preference_audit.dietary_matches.length > 0 || data.preference_audit.dietary_conflicts.length > 0) && (
              <View style={{ gap: 6 }}>
                {data.preference_audit.dietary_matches.map((match, idx) => (
                  <View key={`match-${idx}`} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={{ color: colors.emerald, fontSize: 14 }}>✓</Text>
                    <Text style={{ color: colors.text, fontSize: 12, fontWeight: "600" }}>{match}</Text>
                  </View>
                ))}
                {data.preference_audit.dietary_conflicts.map((conf, idx) => (
                  <View key={`conf-${idx}`} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={{ color: colors.amber, fontSize: 14 }}>⚠️</Text>
                    <Text style={{ color: colors.amber, fontSize: 12, fontWeight: "700" }}>{conf}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Health Goals Alignments & Advisories */}
            {(data.preference_audit.goal_alignments.length > 0 || data.preference_audit.goal_warnings.length > 0) && (
              <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, gap: 6 }}>
                <Text style={{ fontSize: 11, fontWeight: "800", color: colors.textMuted, textTransform: "uppercase" }}>
                  Health Goals Evaluation
                </Text>
                {data.preference_audit.goal_alignments.map((goal, idx) => (
                  <View key={`goal-align-${idx}`} style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                    <Text style={{ color: colors.emerald, fontSize: 13 }}>🎯</Text>
                    <Text style={{ color: colors.text, fontSize: 12, flex: 1, lineHeight: 18 }}>{goal}</Text>
                  </View>
                ))}
                {data.preference_audit.goal_warnings.map((warn, idx) => (
                  <View key={`goal-warn-${idx}`} style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                    <Text style={{ color: colors.amber, fontSize: 13 }}>⚡</Text>
                    <Text style={{ color: colors.amber, fontSize: 12, flex: 1, lineHeight: 18 }}>{warn}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Critical Allergen Alert Banner */}
        {data.allergen_flags && data.allergen_flags.length > 0 && (
          <View style={{
            backgroundColor: `${colors.crimson}15`,
            borderColor: colors.crimson,
            borderWidth: 1.5,
            borderRadius: 20,
            padding: 16,
            marginBottom: 16,
            flexDirection: "row",
            alignItems: "center",
            gap: 12
          }}>
            <Text style={{ fontSize: 26 }}>⚠️</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.crimson, fontSize: 14, fontWeight: "900" }}>
                CRITICAL ALLERGEN WARNING
              </Text>
              <Text style={{ color: colors.text, fontSize: 12, marginTop: 2, fontWeight: "600" }}>
                Detected: {data.allergen_flags.join(", ")}. Direct conflict with sensitive allergy profile.
              </Text>
            </View>
          </View>
        )}

        {/* Additive Hazard Warnings */}
        {data.additives && data.additives.length > 0 && (
          <View style={{
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 20,
            padding: 16,
            marginBottom: 16
          }}>
            <Text style={{ fontSize: 14, fontWeight: "900", color: colors.text, marginBottom: 8 }}>
              Identified Food Additives ({data.additives.length})
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {data.additives.map((add) => {
                const isHigh = add.risk_level === "High";
                const isMod = add.risk_level === "Moderate";
                const tagColor = isHigh ? colors.crimson : isMod ? colors.amber : colors.emerald;

                return (
                  <View
                    key={add.code}
                    style={{
                      backgroundColor: `${tagColor}15`,
                      borderColor: tagColor,
                      borderWidth: 1,
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: 12
                    }}
                  >
                    <Text style={{ color: tagColor, fontSize: 11, fontWeight: "800" }}>
                      {add.code} • {add.name} ({add.risk_level})
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* 3-Tab Navigator Selector */}
        <View style={{
          flexDirection: "row",
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 16,
          padding: 4,
          marginBottom: 16
        }}>
          {(["nutrition", "ingredients", "insights"] as TabType[]).map((tab) => {
            const isSelected = activeTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                onPress={() => setActiveTab(tab)}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  alignItems: "center",
                  borderRadius: 12,
                  backgroundColor: isSelected ? colors.emerald : "transparent"
                }}
              >
                <Text style={{
                  color: isSelected ? "#FFF" : colors.textMuted,
                  fontSize: 12,
                  fontWeight: isSelected ? "800" : "600",
                  textTransform: "capitalize"
                }}>
                  {tab === "nutrition" ? "📊 Nutrition" : tab === "ingredients" ? "🔬 Ingredients" : "🧠 AI Swaps"}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* TAB 1: Nutrition Breakdown Panel */}
        {activeTab === "nutrition" && (
          <View style={{
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 24,
            padding: 18,
            gap: 14
          }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <View>
                <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text }}>
                  {data.nutrition_estimate?.is_estimated ? "Estimated Macronutrients" : "Nutrition Facts per Serving"}
                </Text>
                {data.nutrition_estimate?.serving_size ? (
                  <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: "600", marginTop: 2 }}>
                    Serving Size: {data.nutrition_estimate.serving_size}
                  </Text>
                ) : null}
              </View>

              <View style={{
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 8,
                backgroundColor: data.nutrition_estimate?.is_estimated ? "rgba(245, 158, 11, 0.12)" : "rgba(16, 185, 129, 0.12)",
                borderWidth: 1,
                borderColor: data.nutrition_estimate?.is_estimated ? colors.amber : colors.emerald,
              }}>
                <Text style={{
                  fontSize: 10,
                  fontWeight: "800",
                  color: data.nutrition_estimate?.is_estimated ? colors.amber : colors.emerald
                }}>
                  {data.nutrition_estimate?.is_estimated ? "⚠️ Calculated Estimate" : `✅ ${data.nutrition_estimate?.source || "Scanned Label"}`}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {[
                { label: "Calories", val: formatMacro(data.nutrition_estimate?.calories, "kcal"), color: colors.blue },
                { label: "Clean Protein", val: formatMacro(data.nutrition_estimate?.protein_g, "g"), color: colors.emerald },
                { label: "Carbohydrates", val: formatMacro(data.nutrition_estimate?.carbs_g, "g"), color: colors.amber },
                { label: "Total Fat", val: formatMacro(data.nutrition_estimate?.fat_g, "g"), color: colors.crimson },
                { label: "Sugars", val: formatMacro(data.nutrition_estimate?.sugar_g, "g"), color: colors.amber },
                { label: "Sodium", val: formatMacro(data.nutrition_estimate?.sodium_mg, "mg"), color: colors.blue }
              ].map((item) => (
                <View
                  key={item.label}
                  style={{
                    width: "48%",
                    backgroundColor: colors.cardAlt,
                    padding: 14,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: colors.border
                  }}
                >
                  <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: "700" }}>{item.label}</Text>
                  <Text style={{ fontSize: 18, fontWeight: "900", color: item.color, marginTop: 4 }}>{item.val}</Text>
                </View>
              ))}
            </View>

            {data.nutrition_estimate?.is_estimated ? (
              <View style={{
                backgroundColor: "rgba(245, 158, 11, 0.08)",
                borderColor: "rgba(245, 158, 11, 0.25)",
                borderWidth: 1,
                borderRadius: 12,
                padding: 10
              }}>
                <Text style={{ fontSize: 11, color: colors.textMuted, lineHeight: 16 }}>
                  ℹ️ <Text style={{ fontWeight: "700", color: colors.text }}>Ingredient-Derived Estimate:</Text> No printed nutrition facts table was detected on this packaging. These figures are calculated based on the listed ingredients.
                </Text>
              </View>
            ) : (
              <View style={{
                backgroundColor: "rgba(16, 185, 129, 0.08)",
                borderColor: "rgba(16, 185, 129, 0.25)",
                borderWidth: 1,
                borderRadius: 12,
                padding: 10
              }}>
                <Text style={{ fontSize: 11, color: colors.textMuted, lineHeight: 16 }}>
                  ✅ <Text style={{ fontWeight: "700", color: colors.text }}>Verified Product Data:</Text> Values extracted directly from the scanned product packaging label.
                </Text>
              </View>
            )}
          </View>
        )}

        {/* TAB 2: Ingredients & Additives Panel */}
        {activeTab === "ingredients" && (
          <View style={{
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 24,
            padding: 18,
            gap: 14
          }}>
            <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text }}>
              Ingredient Toxicology & Risk Audit
            </Text>

            {data.ocr_text && (
              <View style={{
                backgroundColor: colors.cardAlt,
                padding: 12,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.border
              }}>
                <Text style={{ fontSize: 11, fontWeight: "800", color: colors.emerald, textTransform: "uppercase" }}>
                  📷 Scanned Label Text
                </Text>
                <Text style={{ fontSize: 12, color: colors.text, marginTop: 4, lineHeight: 18 }}>
                  {data.ocr_text}
                </Text>
              </View>
            )}

            {data.ingredient_risks && data.ingredient_risks.length > 0 && (
              <View style={{ gap: 8 }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: colors.crimson, textTransform: "uppercase" }}>
                  Risk Flags Identified
                </Text>
                {data.ingredient_risks.map((risk, idx) => (
                  <View key={idx} style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
                    <Text style={{ color: colors.crimson, fontSize: 14 }}>•</Text>
                    <Text style={{ color: colors.text, fontSize: 12, flex: 1, lineHeight: 18 }}>{risk}</Text>
                  </View>
                ))}
              </View>
            )}

            {data.additives && data.additives.length > 0 && (
              <View style={{ gap: 10, marginTop: 8 }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textMuted, textTransform: "uppercase" }}>
                  Additive Profiles & Health Effects
                </Text>
                {data.additives.map((add) => (
                  <View
                    key={add.code}
                    style={{
                      backgroundColor: colors.cardAlt,
                      padding: 12,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: colors.border
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "800", color: colors.text }}>
                      {add.code} — {add.name}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 4, lineHeight: 16 }}>
                      {add.description}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* TAB 3: AI Insights & Clean Swaps Panel */}
        {activeTab === "insights" && (
          <View style={{
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 24,
            padding: 18,
            gap: 16
          }}>
            <View>
              <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text }}>Personalized Dietitians Advice</Text>
              <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 6, lineHeight: 20 }}>
                {data.personalized_verdict}
              </Text>
            </View>

            {data.healthier_alternatives && data.healthier_alternatives.length > 0 && (
              <View style={{ gap: 10 }}>
                <Text style={{ fontSize: 14, fontWeight: "900", color: colors.emerald, textTransform: "uppercase" }}>
                  Healthier Clean Alternatives
                </Text>
                {data.healthier_alternatives.map((alt, idx) => (
                  <View
                    key={idx}
                    style={{
                      backgroundColor: colors.cardAlt,
                      padding: 14,
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: `${colors.emerald}40`,
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
                      backgroundColor: `${colors.emerald}20`,
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
          </View>
        )}

        {/* Action Buttons */}
        <View style={{ marginTop: 20, gap: 10 }}>
          {/* Ask AI Nutritionist CTA */}
          <TouchableOpacity
            onPress={handleAskAI}
            style={{
              backgroundColor: colors.emerald,
              paddingVertical: 14,
              borderRadius: 18,
              alignItems: "center",
              shadowColor: colors.emerald,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8
            }}
          >
            <Text style={{ color: "#FFF", fontSize: 15, fontWeight: "800" }}>
              💬 Ask AI Nutritionist About This Product
            </Text>
          </TouchableOpacity>

          {/* Scan Another Product Button */}
          <TouchableOpacity
            onPress={() => router.push("/scanner")}
            style={{
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderWidth: 1,
              paddingVertical: 14,
              borderRadius: 18,
              alignItems: "center"
            }}
          >
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: "800" }}>
              📷 Scan Another Product
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Global Bottom Navigation */}
      <BottomNav />
    </View>
  );
}
