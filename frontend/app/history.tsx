import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { getScanHistory, deleteScanItem, ScanHistoryItem } from "../lib/api";
import { useTheme } from "../lib/ThemeContext";
import { BottomNav } from "../components/BottomNav";

type FilterType = "all" | "clean" | "moderate" | "avoid" | "allergens";

export default function HistoryScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  const [history, setHistory] = useState<ScanHistoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const items = await getScanHistory("default_user", 50);
      setHistory(items);
    } catch (e) {
      console.error("Error loading scan history:", e);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    loadHistory();
  };

  const handleDelete = async (scanId: string) => {
    try {
      await deleteScanItem(scanId);
      setHistory((prev) => prev.filter((i) => i.id !== scanId));
    } catch (e) {
      console.error("Failed to delete scan item:", e);
    }
  };

  const filteredHistory = history.filter((item) => {
    // Search match
    const q = searchQuery.toLowerCase();
    const matchesSearch = item.product_name.toLowerCase().includes(q) || item.ocr_text.toLowerCase().includes(q);
    if (!matchesSearch) return false;

    // Filter chip match
    if (activeFilter === "clean") return item.health_score >= 80;
    if (activeFilter === "moderate") return item.health_score >= 50 && item.health_score < 80;
    if (activeFilter === "avoid") return item.health_score < 50;
    if (activeFilter === "allergens") return item.allergen_flags && item.allergen_flags.length > 0;
    return true;
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Top Header */}
      <View style={{
        paddingTop: 44,
        paddingBottom: 14,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: colors.border
      }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <Text style={{ fontSize: 16, color: colors.text }}>←</Text>
            </TouchableOpacity>

            <View>
              <Text style={{ fontSize: 20, fontWeight: "900", color: colors.text }}>
                Scan History
              </Text>
              <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 1 }}>
                {history.length} food products analyzed
              </Text>
            </View>
          </View>

          {/* Quick Rescan CTA */}
          <TouchableOpacity
            onPress={() => router.push("/scanner")}
            style={{
              backgroundColor: colors.emerald,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 14
            }}
          >
            <Text style={{ color: "#FFF", fontSize: 12, fontWeight: "800" }}>+ New Scan</Text>
          </TouchableOpacity>
        </View>

        {/* Live Search Input */}
        <View style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 18,
          paddingHorizontal: 14,
          paddingVertical: 8,
          gap: 10
        }}>
          <Text style={{ fontSize: 16 }}>🔍</Text>
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search scans by product or ingredient..."
            placeholderTextColor={colors.textDim}
            style={{ flex: 1, color: colors.text, fontSize: 13 }}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Text style={{ color: colors.textMuted, fontSize: 14 }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Chips Row */}
        <View style={{ marginTop: 12 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {[
              { key: "all", label: "All Items" },
              { key: "clean", label: "🥗 Clean (80+)" },
              { key: "moderate", label: "🥪 Moderate (50-79)" },
              { key: "avoid", label: "🚫 Ultra-Processed (<50)" },
              { key: "allergens", label: "⚠️ Allergen Alerts" }
            ].map((chip) => {
              const isSelected = activeFilter === chip.key;
              return (
                <TouchableOpacity
                  key={chip.key}
                  onPress={() => setActiveFilter(chip.key as FilterType)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 5,
                    borderRadius: 14,
                    backgroundColor: isSelected ? colors.emerald : colors.card,
                    borderWidth: 1,
                    borderColor: isSelected ? colors.emerald : colors.border
                  }}
                >
                  <Text style={{
                    fontSize: 11,
                    fontWeight: isSelected ? "800" : "600",
                    color: isSelected ? "#FFF" : colors.textMuted
                  }}>
                    {chip.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>

      {/* Timeline List */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 12 }}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.emerald} />}
      >
        {filteredHistory.length > 0 ? (
          filteredHistory.map((item) => {
            const isClean = item.health_score >= 80;
            const isMod = item.health_score >= 50 && item.health_score < 80;
            const scoreColor = isClean ? colors.emerald : isMod ? colors.amber : colors.crimson;
            const hasAllergens = item.allergen_flags && item.allergen_flags.length > 0;

            const dateStr = new Date(item.scanned_at).toLocaleDateString([], {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit"
            });

            return (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.8}
                onPress={() => {
                  router.push({
                    pathname: "/results",
                    params: {
                      data: JSON.stringify({
                        product_name: item.product_name,
                        health_score: item.health_score,
                        nova_group: isClean ? 1 : isMod ? 3 : 4,
                        allergen_flags: item.allergen_flags,
                        ingredient_risks: item.health_score < 60 ? ["Industrial additive formulation detected"] : [],
                        positive_attributes: isClean ? ["Clean nutrient dense whole food"] : [],
                        personalized_verdict: item.verdict_summary,
                        additives: []
                      })
                    }
                  });
                }}
                style={{
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: 22,
                  padding: 16,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.08,
                  shadowRadius: 6,
                  elevation: 2
                }}
              >
                {/* Header Row: Score & Date */}
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <View style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    backgroundColor: `${scoreColor}18`,
                    paddingHorizontal: 10,
                    paddingVertical: 3,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: `${scoreColor}30`
                  }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: scoreColor }} />
                    <Text style={{ fontSize: 12, fontWeight: "900", color: scoreColor }}>
                      {item.health_score}/100
                    </Text>
                  </View>

                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={{ fontSize: 11, color: colors.textDim }}>{dateStr}</Text>
                    {/* Delete Icon */}
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        handleDelete(item.id);
                      }}
                      style={{ padding: 4 }}
                    >
                      <Text style={{ color: colors.textDim, fontSize: 12 }}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Product Name */}
                <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text }}>
                  {item.product_name}
                </Text>

                {/* Summary text */}
                <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4, lineHeight: 18 }} numberOfLines={2}>
                  {item.verdict_summary}
                </Text>

                {/* Allergen Tag if present */}
                {hasAllergens && (
                  <View style={{
                    marginTop: 8,
                    alignSelf: "flex-start",
                    backgroundColor: `${colors.crimson}15`,
                    borderColor: colors.crimson,
                    borderWidth: 1,
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 8
                  }}>
                    <Text style={{ color: colors.crimson, fontSize: 10, fontWeight: "800" }}>
                      ⚠️ Contains: {item.allergen_flags.join(", ")}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        ) : (
          <View style={{
            backgroundColor: colors.card,
            padding: 30,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: "center"
          }}>
            <Text style={{ fontSize: 36, marginBottom: 10 }}>📦</Text>
            <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text }}>No Scans Match Filter</Text>
            <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4, textAlign: "center" }}>
              Try searching with a different term or clear active filter chips.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Global Bottom Navigation */}
      <BottomNav />
    </View>
  );
}
