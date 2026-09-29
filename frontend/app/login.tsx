import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView
} from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "../lib/ThemeContext";
import { useAuth } from "../lib/AuthContext";

export default function LoginScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { login, switchUser, isLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const DEMO_USERS = [
    {
      id: "default_user",
      name: "Jishan Ahmed",
      email: "jishan@nutrilens.ai",
      conditions: "Diabetes & High Blood Pressure",
      icon: "🥑"
    },
    {
      id: "user_diabetes",
      name: "Sarah Connor",
      email: "sarah.diabetes@nutrilens.ai",
      conditions: "Type 2 Diabetes (Sugar Radar)",
      icon: "🩺"
    },
    {
      id: "user_hypertension",
      name: "Marcus Vance",
      email: "marcus.bp@nutrilens.ai",
      conditions: "High Blood Pressure (Sodium Radar)",
      icon: "🩸"
    },
    {
      id: "user_clean",
      name: "Elena Gomez",
      email: "elena.wellness@nutrilens.ai",
      conditions: "Clean Eating & Whole Foods",
      icon: "🌿"
    }
  ];

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setErrorMessage("Please enter both email and password.");
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      await login(email.trim(), password.trim());
      router.replace("/");
    } catch (err: any) {
      setErrorMessage(err.message || "Invalid credentials. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickDemoLogin = async (demoEmail: string, demoUid: string) => {
    setEmail(demoEmail);
    setPassword("password123");
    setSubmitting(true);
    setErrorMessage(null);

    try {
      // Direct login with pre-seeded demo credentials
      await login(demoEmail, "password123");
      router.replace("/");
    } catch (err: any) {
      // Fallback switch profile if offline or local SQLite fallback
      try {
        await switchUser(demoUid);
        router.replace("/");
      } catch (innerErr: any) {
        setErrorMessage(innerErr.message || "Demo login failed.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: 24,
            paddingTop: Platform.OS === "web" ? 32 : 16,
            paddingBottom: 50,
            maxWidth: 520,
            width: "100%",
            alignSelf: "center"
          }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Top Bar Navigation */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <TouchableOpacity
              onPress={() => router.replace("/")}
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: colors.cardAlt,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border
              }}
            >
              <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: "700" }}>← Home</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.replace("/")}
              style={{ padding: 4 }}
            >
              <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: "600" }}>Skip as Guest</Text>
            </TouchableOpacity>
          </View>

          {/* Brand & Welcome Hero */}
          <View style={{ alignItems: "center", marginBottom: 28 }}>
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                backgroundColor: `${colors.emerald}18`,
                borderWidth: 2,
                borderColor: colors.emerald,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 14,
                shadowColor: colors.emerald,
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.35,
                shadowRadius: 14,
                elevation: 6
              }}
            >
              <Text style={{ fontSize: 36 }}>🥑</Text>
            </View>

            <Text
              style={{
                fontSize: 26,
                fontWeight: "900",
                color: colors.text,
                letterSpacing: -0.5,
                textAlign: "center"
              }}
            >
              Welcome to NutriLens
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: colors.textMuted,
                marginTop: 6,
                textAlign: "center",
                lineHeight: 20
              }}
            >
              Sign in to scan foods with your personalized health radar for diabetes, hypertension & allergens.
            </Text>
          </View>

          {/* Form Card */}
          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: 24,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 22,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.12,
              shadowRadius: 12,
              elevation: 4,
              gap: 16
            }}
          >
            {/* Error Notification Banner */}
            {errorMessage && (
              <View
                style={{
                  backgroundColor: `${colors.crimson}18`,
                  borderColor: `${colors.crimson}50`,
                  borderWidth: 1,
                  borderRadius: 14,
                  padding: 12,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8
                }}
              >
                <Text style={{ fontSize: 16 }}>⚠️</Text>
                <Text
                  style={{
                    color: colors.crimson,
                    fontSize: 12,
                    fontWeight: "700",
                    flex: 1
                  }}
                >
                  {errorMessage}
                </Text>
              </View>
            )}

            {/* Email Field */}
            <View>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "800",
                  color: colors.text,
                  marginBottom: 6,
                  textTransform: "uppercase",
                  letterSpacing: 0.5
                }}
              >
                Email Address or User ID
              </Text>
              <TextInput
                value={email}
                onChangeText={(val) => {
                  setEmail(val);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="e.g. jishan@nutrilens.ai"
                placeholderTextColor={colors.textDim}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                style={{
                  backgroundColor: colors.cardAlt,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: 14,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  color: colors.text,
                  fontSize: 15
                }}
              />
            </View>

            {/* Password Field */}
            <View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "800",
                    color: colors.text,
                    textTransform: "uppercase",
                    letterSpacing: 0.5
                  }}
                >
                  Password
                </Text>
                <TouchableOpacity onPress={() => setShowPassword((prev) => !prev)}>
                  <Text style={{ fontSize: 12, color: colors.emerald, fontWeight: "700" }}>
                    {showPassword ? "Hide" : "Show"}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={{ position: "relative" }}>
                <TextInput
                  value={password}
                  onChangeText={(val) => {
                    setPassword(val);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="Enter your password"
                  placeholderTextColor={colors.textDim}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  style={{
                    backgroundColor: colors.cardAlt,
                    borderColor: colors.border,
                    borderWidth: 1,
                    borderRadius: 14,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    paddingRight: 48,
                    color: colors.text,
                    fontSize: 15
                  }}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword((prev) => !prev)}
                  style={{
                    position: "absolute",
                    right: 14,
                    top: 12,
                    padding: 4
                  }}
                >
                  <Text style={{ fontSize: 16 }}>{showPassword ? "👁️" : "🙈"}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Log In Button */}
            <TouchableOpacity
              onPress={handleLogin}
              disabled={submitting || isLoading}
              activeOpacity={0.85}
              style={{
                backgroundColor: colors.emerald,
                paddingVertical: 14,
                borderRadius: 16,
                alignItems: "center",
                justifyContent: "center",
                marginTop: 4,
                shadowColor: colors.emerald,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.4,
                shadowRadius: 10,
                elevation: 4
              }}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text
                  style={{
                    color: "#FFFFFF",
                    fontSize: 15,
                    fontWeight: "900",
                    letterSpacing: 0.3
                  }}
                >
                  Sign In
                </Text>
              )}
            </TouchableOpacity>

            {/* Switch to Sign Up */}
            <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 4 }}>
              <Text style={{ fontSize: 13, color: colors.textMuted }}>
                Don't have an account yet?{" "}
              </Text>
              <TouchableOpacity onPress={() => router.push("/signup")}>
                <Text style={{ fontSize: 13, fontWeight: "900", color: colors.emerald }}>
                  Sign Up
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Quick Demo Accounts Selection */}
          <View style={{ marginTop: 28 }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12, gap: 8 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "800",
                  color: colors.textDim,
                  textTransform: "uppercase",
                  letterSpacing: 1
                }}
              >
                Instant 1-Tap Demo Testing
              </Text>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
            </View>

            <View style={{ gap: 8 }}>
              {DEMO_USERS.map((demo) => (
                <TouchableOpacity
                  key={demo.id}
                  onPress={() => handleQuickDemoLogin(demo.email, demo.id)}
                  disabled={submitting}
                  activeOpacity={0.75}
                  style={{
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    borderWidth: 1,
                    borderRadius: 16,
                    padding: 12,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between"
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: `${colors.emerald}15`,
                        alignItems: "center",
                        justifyContent: "center"
                      }}
                    >
                      <Text style={{ fontSize: 20 }}>{demo.icon}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: "800", color: colors.text }}>
                        {demo.name}
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 1 }}>
                        {demo.conditions}
                      </Text>
                    </View>
                  </View>

                  <View
                    style={{
                      backgroundColor: `${colors.emerald}15`,
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: 10
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: "800", color: colors.emerald }}>
                      Use Profile →
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
