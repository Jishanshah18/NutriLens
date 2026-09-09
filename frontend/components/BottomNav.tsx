import React from "react";
import { View, Text, TouchableOpacity, Platform, Image } from "react-native";
import { useRouter, usePathname } from "expo-router";
import { useTheme } from "../lib/ThemeContext";

interface TabItem {
  name: string;
  route: string;
  icon: string;
  label: string;
  isMain?: boolean;
}

const TABS: TabItem[] = [
  { name: "home", route: "/", icon: "🏠", label: "Home" },
  { name: "insights", route: "/insights", icon: "📊", label: "Insights" },
  { name: "scanner", route: "/scanner", icon: "📷", label: "Scan", isMain: true },
  { name: "chat", route: "/chat", icon: "💬", label: "AI Chat" },
  { name: "profile", route: "/profile", icon: "👤", label: "Profile" }
];

export const BottomNav: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { colors, isDark } = useTheme();

  return (
    <View style={{
      position: "relative",
      width: "100%",
      backgroundColor: isDark ? "#0E1524" : "#FFFFFF",
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 6,
      paddingBottom: Platform.OS === "ios" ? 22 : 10,
      paddingHorizontal: 6,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-end",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.18,
      shadowRadius: 12,
      elevation: 10,
      zIndex: 50
    }}>
      {TABS.map((tab) => {
        const isActive = (tab.route === "/" && (pathname === "/" || pathname === "/index")) ||
                         (tab.route !== "/" && pathname.startsWith(tab.route));

        // Center Elevated Prominent Scanner Button
        if (tab.isMain) {
          return (
            <View
              key={tab.name}
              style={{
                flex: 1.2,
                alignItems: "center",
                justifyContent: "flex-end",
                position: "relative"
              }}
            >
              <TouchableOpacity
                onPress={() => router.push(tab.route as any)}
                activeOpacity={0.85}
                style={{
                  top: -20,
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  backgroundColor: colors.emerald,
                  alignItems: "center",
                  justifyContent: "center",
                  shadowColor: colors.emerald,
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.75,
                  shadowRadius: 16,
                  elevation: 16,
                  borderWidth: 4,
                  borderColor: isDark ? "#070B14" : "#FFFFFF"
                }}
              >
                {/* Inner Optical Lens Ring */}
                <View style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: "rgba(255, 255, 255, 0.22)",
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: "rgba(255, 255, 255, 0.4)"
                }}>
                  <Image
                    source={require("../assets/camera-icon-white.png")}
                    style={{ width: 26, height: 26 }}
                    resizeMode="contain"
                  />
                </View>
              </TouchableOpacity>

              <Text style={{
                fontSize: 11,
                fontWeight: "900",
                color: colors.emerald,
                top: -14,
                letterSpacing: 0.2
              }}>
                Scan
              </Text>
            </View>
          );
        }

        // Side Standard Tabs
        return (
          <TouchableOpacity
            key={tab.name}
            onPress={() => router.push(tab.route as any)}
            activeOpacity={0.7}
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              paddingVertical: 6,
              paddingHorizontal: 4,
              borderRadius: 14,
              backgroundColor: isActive ? `${colors.emerald}16` : "transparent"
            }}
          >
            <Text style={{
              fontSize: 20,
              transform: [{ scale: isActive ? 1.15 : 1 }]
            }}>
              {tab.icon}
            </Text>
            <Text style={{
              fontSize: 10,
              fontWeight: isActive ? "800" : "600",
              color: isActive ? colors.emerald : colors.textMuted,
              marginTop: 3
            }}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};
