import "../global.css";
import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Stack, ErrorBoundaryProps } from "expo-router";
import { ThemeProvider } from "../lib/ThemeContext";
import { AuthProvider } from "../lib/AuthContext";

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={{ flex: 1, backgroundColor: "#070B14", justifyContent: "center", alignItems: "center", padding: 24 }}>
      <Text style={{ fontSize: 36, marginBottom: 12 }}>🥑</Text>
      <Text style={{ fontSize: 22, fontWeight: "900", color: "#F1F5F9", marginBottom: 8, textAlign: "center" }}>
        NutriLens
      </Text>
      <Text style={{ fontSize: 13, color: "#94A3B8", textAlign: "center", marginBottom: 20 }}>
        {error?.message || "App encountered a temporary issue."}
      </Text>
      <TouchableOpacity
        onPress={retry}
        style={{ backgroundColor: "#10B981", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 16 }}
      >
        <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 14 }}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );
}

import { useEffect } from "react";
import { warmupCloudBackend } from "../lib/api";

export default function Layout() {
  useEffect(() => {
    warmupCloudBackend();
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="login" />
          <Stack.Screen name="signup" />
          <Stack.Screen name="scanner" />
          <Stack.Screen name="results" />
          <Stack.Screen name="chat" />
          <Stack.Screen name="insights" />
          <Stack.Screen name="history" />
          <Stack.Screen name="profile" />
          <Stack.Screen name="engagement" />
        </Stack>
      </AuthProvider>
    </ThemeProvider>
  );
}
