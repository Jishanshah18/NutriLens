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
  SafeAreaView,
  Modal
} from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "../lib/ThemeContext";
import { useAuth } from "../lib/AuthContext";

export default function LoginScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { login, resetPassword, isLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Forgot Password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);
  const [forgotError, setForgotError] = useState<string | null>(null);

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

  const handleResetPassword = async () => {
    if (!forgotEmail.trim() || !forgotEmail.includes("@")) {
      setForgotError("Please enter a valid email address.");
      return;
    }

    setForgotSubmitting(true);
    setForgotError(null);
    setForgotMessage(null);

    try {
      await resetPassword(forgotEmail.trim());
      setForgotMessage("Password reset email sent! Check your inbox.");
    } catch (err: any) {
      setForgotError(err.message || "Failed to send reset email. Please try again.");
    } finally {
      setForgotSubmitting(false);
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
              onPress={() => router.push("/signup")}
              style={{ padding: 4 }}
            >
              <Text style={{ color: colors.emerald, fontSize: 13, fontWeight: "700" }}>Create Account</Text>
            </TouchableOpacity>
          </View>

          {/* Hero Branding */}
          <View style={{ alignItems: "center", marginBottom: 32 }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: `${colors.emerald}20`,
                borderWidth: 2,
                borderColor: colors.emerald,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
                shadowColor: colors.emerald,
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.35,
                shadowRadius: 12,
                elevation: 6
              }}
            >
              <Text style={{ fontSize: 30 }}>🔍</Text>
            </View>

            <Text
              style={{
                fontSize: 28,
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
              Sign in to access your personalized scans and nutritional radar.
            </Text>
          </View>

          {/* Login Form Container */}
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
              gap: 18
            }}
          >
            {/* Error Notification */}
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
                <Text style={{ color: colors.crimson, fontSize: 13, fontWeight: "700", flex: 1 }}>
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
                Email Address
              </Text>
              <TextInput
                value={email}
                onChangeText={(val) => {
                  setEmail(val);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="name@nutrilens.ai"
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

            {/* Forgot Password Link */}
            <View style={{ alignItems: "flex-end" }}>
              <TouchableOpacity onPress={() => {
                setForgotEmail(email);
                setForgotMessage(null);
                setForgotError(null);
                setShowForgotModal(true);
              }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: colors.emerald }}>
                  Forgot Password?
                </Text>
              </TouchableOpacity>
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
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Forgot Password Modal */}
      <Modal
        visible={showForgotModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowForgotModal(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.6)",
          alignItems: "center",
          justifyContent: "center",
          padding: 20
        }}>
          <View style={{
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 24,
            padding: 24,
            maxWidth: 420,
            width: "100%",
            gap: 16
          }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: 18, fontWeight: "900", color: colors.text }}>
                Reset Password
              </Text>
              <TouchableOpacity onPress={() => setShowForgotModal(false)}>
                <Text style={{ fontSize: 16, color: colors.textMuted }}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 13, color: colors.textMuted, lineHeight: 18 }}>
              Enter the email address associated with your NutriLens account. We will send a secure link to reset your password.
            </Text>

            {forgotError && (
              <View style={{
                backgroundColor: `${colors.crimson}18`,
                borderColor: `${colors.crimson}50`,
                borderWidth: 1,
                borderRadius: 12,
                padding: 10
              }}>
                <Text style={{ color: colors.crimson, fontSize: 12, fontWeight: "700" }}>{forgotError}</Text>
              </View>
            )}

            {forgotMessage && (
              <View style={{
                backgroundColor: `${colors.emerald}18`,
                borderColor: `${colors.emerald}50`,
                borderWidth: 1,
                borderRadius: 12,
                padding: 10
              }}>
                <Text style={{ color: colors.emerald, fontSize: 12, fontWeight: "700" }}>{forgotMessage}</Text>
              </View>
            )}

            <TextInput
              value={forgotEmail}
              onChangeText={setForgotEmail}
              placeholder="name@example.com"
              placeholderTextColor={colors.textDim}
              keyboardType="email-address"
              autoCapitalize="none"
              style={{
                backgroundColor: colors.cardAlt,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: 14,
                paddingHorizontal: 14,
                paddingVertical: 10,
                color: colors.text,
                fontSize: 14
              }}
            />

            <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
              <TouchableOpacity
                onPress={() => setShowForgotModal(false)}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 14,
                  backgroundColor: colors.cardAlt,
                  alignItems: "center"
                }}
              >
                <Text style={{ color: colors.textMuted, fontWeight: "700", fontSize: 13 }}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleResetPassword}
                disabled={forgotSubmitting}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 14,
                  backgroundColor: colors.emerald,
                  alignItems: "center"
                }}
              >
                {forgotSubmitting ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={{ color: "#FFF", fontWeight: "800", fontSize: 13 }}>Send Link</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
