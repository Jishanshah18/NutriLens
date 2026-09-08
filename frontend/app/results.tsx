import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, ScrollView, Share, Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AnalyzeResponse } from "../lib/api";
import { useTheme } from "../lib/ThemeContext";
import { ScoreRing } from "../components/ScoreRing";
import { BottomNav } from "../components/BottomNav";

type TabType = "nutrition" | "ingredients" | "insights";

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
        console.error("Error parsing results data params:", e);
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
            <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text }}>
              Estimated Macronutrients per Serving
            </Text>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {[
                { label: "Calories", val: `${data.nutrition_estimate?.calories || 180} kcal`, color: colors.blue },
                { label: "Clean Protein", val: `${data.nutrition_estimate?.protein_g || 4.2} g`, color: colors.emerald },
                { label: "Carbohydrates", val: `${data.nutrition_estimate?.carbs_g || 24} g`, color: colors.amber },
                { label: "Total Fat", val: `${data.nutrition_estimate?.fat_g || 7.5} g`, color: colors.crimson },
                { label: "Sugars", val: `${data.nutrition_estimate?.sugar_g || 11} g`, color: colors.amber },
                { label: "Sodium", val: `${data.nutrition_estimate?.sodium_mg || 340} mg`, color: colors.blue }
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
