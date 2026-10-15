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
  const {
    login,
    loginWithGoogle,
    loginAsGuest,
    resetPassword,
    resendEmailVerification,
    firebaseUser,
    isEmailVerified,
    isFirebaseReady,
    isLoading
  } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [guestSubmitting, setGuestSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Email verification resend state
  const [resendingVerification, setResendingVerification] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);

  // Forgot Password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);
  const [forgotError, setForgotError] = useState<string | null>(null);

  const validateEmail = (val: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
  };

  const handleGuestLogin = async () => {
    if (submitting || googleSubmitting || guestSubmitting) return;
    setGuestSubmitting(true);
    setErrorMessage(null);
    try {
      await loginAsGuest(["Diabetes", "High Blood Pressure"]);
      router.replace("/");
    } catch (err: any) {
      setErrorMessage(err.message || "Guest session could not be initialized.");
    } finally {
      setGuestSubmitting(false);
    }
  };

  const handleLogin = async () => {
    if (submitting || googleSubmitting || guestSubmitting) return;

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMessage("Please enter your email address.");
      return;
    }
    if (!validateEmail(cleanEmail)) {
      setErrorMessage("Please enter a valid email address (e.g. name@example.com).");
      return;
    }
    if (!password) {
      setErrorMessage("Please enter your password.");
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    setSuccessNotice(null);

    try {
      await login(cleanEmail, password);
      router.replace("/");
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to sign in. Please verify your credentials.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (submitting || googleSubmitting || guestSubmitting) return;

    setGoogleSubmitting(true);
    setErrorMessage(null);
    setSuccessNotice(null);

    try {
      await loginWithGoogle();
      router.replace("/");
    } catch (err: any) {
      setErrorMessage(err.message || "Google sign-in could not be completed.");
    } finally {
      setGoogleSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    const cleanForgotEmail = forgotEmail.trim();
    if (!cleanForgotEmail || !validateEmail(cleanForgotEmail)) {
      setForgotError("Please enter a valid email address.");
      return;
    }

    setForgotSubmitting(true);
    setForgotError(null);
    setForgotMessage(null);

    try {
      await resetPassword(cleanForgotEmail);
      setForgotMessage(`Password reset link sent to ${cleanForgotEmail}. Please check your inbox.`);
    } catch (err: any) {
      setForgotError(err.message || "Failed to send reset email. Please try again.");
    } finally {
      setForgotSubmitting(false);
    }
  };

  const handleResendVerification = async () => {
    if (resendingVerification) return;
    setResendingVerification(true);
    try {
      await resendEmailVerification();
      setVerificationSent(true);
      setTimeout(() => setVerificationSent(false), 5000);
    } catch (err: any) {
      setErrorMessage(err.message || "Could not resend verification email.");
    } finally {
      setResendingVerification(false);
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
            paddingHorizontal: 20,
            paddingTop: Platform.OS === "web" ? 36 : 16,
            paddingBottom: 48,
            maxWidth: 480,
            width: "100%",
            alignSelf: "center"
          }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Top Bar Navigation */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 20
            }}
          >
            <TouchableOpacity
              onPress={() => router.replace("/")}
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: colors.cardAlt,
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border
              }}
            >
              <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: "700" }}>← Home</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push("/signup")}
              style={{
                backgroundColor: `${colors.emerald}15`,
                borderColor: `${colors.emerald}40`,
                borderWidth: 1,
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 12
              }}
            >
              <Text style={{ color: colors.emerald, fontSize: 13, fontWeight: "800" }}>
                Create Account
              </Text>
            </TouchableOpacity>
          </View>

          {/* Hero Branding Header */}
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
              <Text style={{ fontSize: 34 }}>🥗</Text>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text
                style={{
                  fontSize: 28,
                  fontWeight: "900",
                  color: colors.text,
                  letterSpacing: -0.6
                }}
              >
                NutriLens
              </Text>
              <View
                style={{
                  backgroundColor: colors.emerald,
                  paddingHorizontal: 7,
                  paddingVertical: 2,
                  borderRadius: 6
                }}
              >
                <Text style={{ color: "#FFF", fontSize: 10, fontWeight: "900", letterSpacing: 0.5 }}>
                  AI
                </Text>
              </View>
            </View>

            <Text
              style={{
                fontSize: 14,
                fontWeight: "600",
                color: colors.emerald,
                marginTop: 6,
                textAlign: "center"
              }}
            >
              Your personal nutrition intelligence companion.
            </Text>

            <Text
              style={{
                fontSize: 12,
                color: colors.textMuted,
                marginTop: 4,
                textAlign: "center",
                lineHeight: 18
              }}
            >
              Sign in with Firebase to access ingredient scans, allergen warnings & clinical radars.
            </Text>
          </View>

          {/* Unverified Email Warning Banner (if user logged in but unverified) */}
          {firebaseUser && !isEmailVerified && (
            <View
              style={{
                backgroundColor: `${colors.amber}18`,
                borderColor: `${colors.amber}60`,
                borderWidth: 1,
                borderRadius: 16,
                padding: 14,
                marginBottom: 18,
                gap: 8
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ fontSize: 16 }}>✉️</Text>
                <Text style={{ color: colors.amber, fontSize: 13, fontWeight: "800", flex: 1 }}>
                  Email Verification Pending
                </Text>
              </View>
              <Text style={{ color: colors.textMuted, fontSize: 12, lineHeight: 17 }}>
                A verification link was sent to {firebaseUser.email}. Please verify your email to unlock all scanning features.
              </Text>
              <TouchableOpacity
                onPress={handleResendVerification}
                disabled={resendingVerification}
                style={{
                  alignSelf: "flex-start",
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderWidth: 1,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 10,
                  marginTop: 4
                }}
              >
                {resendingVerification ? (
                  <ActivityIndicator size="small" color={colors.amber} />
                ) : (
                  <Text style={{ color: colors.amber, fontSize: 12, fontWeight: "800" }}>
                    {verificationSent ? "✓ Link Sent!" : "Resend Verification Email"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Main Login Card */}
          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: 24,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 24,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: isDark ? 0.35 : 0.08,
              shadowRadius: 16,
              elevation: 4,
              gap: 18
            }}
          >
            {/* Error Message Box */}
            {errorMessage && (
              <View
                style={{
                  backgroundColor: `${colors.crimson}15`,
                  borderColor: `${colors.crimson}50`,
                  borderWidth: 1,
                  borderRadius: 14,
                  padding: 12,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10
                }}
              >
                <Text style={{ fontSize: 16 }}>⚠️</Text>
                <Text
                  style={{
                    color: colors.crimson,
                    fontSize: 13,
                    fontWeight: "700",
                    flex: 1,
                    lineHeight: 18
                  }}
                >
                  {errorMessage}
                </Text>
              </View>
            )}

            {/* Success Notice */}
            {successNotice && (
              <View
                style={{
                  backgroundColor: `${colors.emerald}15`,
                  borderColor: `${colors.emerald}50`,
                  borderWidth: 1,
                  borderRadius: 14,
                  padding: 12,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10
                }}
              >
                <Text style={{ fontSize: 16 }}>✓</Text>
                <Text style={{ color: colors.emerald, fontSize: 13, fontWeight: "700", flex: 1 }}>
                  {successNotice}
                </Text>
              </View>
            )}

            {/* INSTANT DEMO / GUEST ACCESS BUTTON */}
            <TouchableOpacity
              onPress={handleGuestLogin}
              disabled={submitting || googleSubmitting || guestSubmitting || isLoading}
              activeOpacity={0.85}
              style={{
                backgroundColor: `${colors.emerald}18`,
                borderColor: colors.emerald,
                borderWidth: 1.5,
                borderRadius: 16,
                paddingVertical: 13,
                paddingHorizontal: 16,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                shadowColor: colors.emerald,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.15,
                shadowRadius: 6,
                elevation: 2
              }}
            >
              {guestSubmitting ? (
                <ActivityIndicator size="small" color={colors.emerald} />
              ) : (
                <>
                  <Text style={{ fontSize: 16 }}>⚡</Text>
                  <Text
                    style={{
                      color: colors.emerald,
                      fontSize: 14,
                      fontWeight: "900",
                      letterSpacing: 0.2
                    }}
                  >
                    Instant Access / Continue as Guest
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* GOOGLE SIGN-IN BUTTON */}
            <TouchableOpacity
              onPress={handleGoogleLogin}
              disabled={submitting || googleSubmitting || guestSubmitting || isLoading}
              activeOpacity={0.85}
              style={{
                backgroundColor: colors.cardAlt,
                borderColor: colors.border,
                borderWidth: 1.5,
                borderRadius: 16,
                paddingVertical: 13,
                paddingHorizontal: 16,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 4,
                elevation: 1
              }}
            >
              {googleSubmitting ? (
                <ActivityIndicator size="small" color={colors.emerald} />
              ) : (
                <>
                  {/* Google 'G' stylized badge */}
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      backgroundColor: "#FFF",
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: 1,
                      borderColor: "#E2E8F0"
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "900", color: "#4285F4" }}>G</Text>
                  </View>
                  <Text
                    style={{
                      color: colors.text,
                      fontSize: 14,
                      fontWeight: "800",
                      letterSpacing: 0.2
                    }}
                  >
                    Continue with Google
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* OR DIVIDER */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 2 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
              <Text
                style={{
                  fontSize: 11,
                  color: colors.textDim,
                  fontWeight: "700",
                  textTransform: "uppercase",
                  letterSpacing: 0.8
                }}
              >
                or sign in with email
              </Text>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
            </View>

            {/* EMAIL INPUT */}
            <View>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "800",
                  color: colors.text,
                  marginBottom: 6,
                  textTransform: "uppercase",
                  letterSpacing: 0.6
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
                  fontSize: 14,
                  fontWeight: "500"
                }}
              />
            </View>

            {/* PASSWORD INPUT */}
            <View>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 6
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "800",
                    color: colors.text,
                    textTransform: "uppercase",
                    letterSpacing: 0.6
                  }}
                >
                  Password
                </Text>
                <TouchableOpacity
                  onPress={() => setShowPassword((prev) => !prev)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={{ fontSize: 11, color: colors.emerald, fontWeight: "700" }}>
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
                    fontSize: 14,
                    fontWeight: "500"
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
                  <Text style={{ fontSize: 15 }}>{showPassword ? "👁️" : "🙈"}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* FORGOT PASSWORD LINK */}
            <View style={{ alignItems: "flex-end", marginTop: -6 }}>
              <TouchableOpacity
                onPress={() => {
                  setForgotEmail(email);
                  setForgotMessage(null);
                  setForgotError(null);
                  setShowForgotModal(true);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={{ fontSize: 12, fontWeight: "800", color: colors.emerald }}>
                  Forgot Password?
                </Text>
              </TouchableOpacity>
            </View>

            {/* PROMINENT GREEN SIGN IN BUTTON */}
            <TouchableOpacity
              onPress={handleLogin}
              disabled={submitting || googleSubmitting || isLoading}
              activeOpacity={0.85}
              style={{
                backgroundColor: colors.emerald,
                paddingVertical: 14,
                borderRadius: 16,
                alignItems: "center",
                justifyContent: "center",
                marginTop: 2,
                shadowColor: colors.emerald,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.35,
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

            {/* SWITCH TO SIGN UP */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "center",
                alignItems: "center",
                marginTop: 4
              }}
            >
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

          {/* Security & Data Notice */}
          <Text
            style={{
              fontSize: 11,
              color: colors.textDim,
              textAlign: "center",
              marginTop: 24,
              lineHeight: 16
            }}
          >
            🔒 Protected with Firebase Authentication & encrypted session tokens.
            Scan history and health condition radar profiles are securely preserved.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* FORGOT PASSWORD MODAL */}
      <Modal
        visible={showForgotModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowForgotModal(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.65)",
            alignItems: "center",
            justifyContent: "center",
            padding: 20
          }}
        >
          <View
            style={{
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 24,
              padding: 24,
              maxWidth: 420,
              width: "100%",
              gap: 16,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.25,
              shadowRadius: 20,
              elevation: 8
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ fontSize: 20 }}>🔑</Text>
                <Text style={{ fontSize: 18, fontWeight: "900", color: colors.text }}>
                  Reset Password
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowForgotModal(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={{ fontSize: 18, color: colors.textMuted, fontWeight: "700" }}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 13, color: colors.textMuted, lineHeight: 19 }}>
              Enter the email address registered with NutriLens. Firebase will send a secure link to reset your password.
            </Text>

            {forgotError && (
              <View
                style={{
                  backgroundColor: `${colors.crimson}15`,
                  borderColor: `${colors.crimson}50`,
                  borderWidth: 1,
                  borderRadius: 12,
                  padding: 10
                }}
              >
                <Text style={{ color: colors.crimson, fontSize: 12, fontWeight: "700" }}>
                  {forgotError}
                </Text>
              </View>
            )}

            {forgotMessage && (
              <View
                style={{
                  backgroundColor: `${colors.emerald}15`,
                  borderColor: `${colors.emerald}50`,
                  borderWidth: 1,
                  borderRadius: 12,
                  padding: 10
                }}
              >
                <Text style={{ color: colors.emerald, fontSize: 12, fontWeight: "700" }}>
                  {forgotMessage}
                </Text>
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
                paddingVertical: 11,
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
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: "center"
                }}
              >
                <Text style={{ color: colors.textMuted, fontWeight: "700", fontSize: 13 }}>
                  Cancel
                </Text>
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
                  <Text style={{ color: "#FFF", fontWeight: "900", fontSize: 13 }}>
                    Send Reset Link
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
