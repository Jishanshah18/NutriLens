import React, { useState, useMemo } from "react";
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

const HEALTH_CONDITIONS = [
  { id: "Diabetes", name: "Diabetes", icon: "🩺", desc: "Flags sugars, high GI & maltodextrins" },
  { id: "High Blood Pressure", name: "High Blood Pressure", icon: "🩸", desc: "Flags high sodium & arterial tension" },
  { id: "High Cholesterol", name: "High Cholesterol", icon: "🧈", desc: "Flags saturated fats & palm oil" },
  { id: "Obesity", name: "Obesity", icon: "⚖️", desc: "Flags empty calories & low satiety" },
  { id: "Heart-related conditions", name: "Heart Conditions", icon: "🫀", desc: "Flags trans fats & harmful additives" },
  { id: "Kidney-related conditions", name: "Kidney Conditions", icon: "🫘", desc: "Monitors sodium & inorganic phosphates" },
  { id: "Gluten intolerance", name: "Gluten Intolerance", icon: "🌾", desc: "Flags wheat, barley, rye & malt" },
  { id: "Lactose intolerance", name: "Lactose Intolerance", icon: "🥛", desc: "Flags dairy, milk powders & whey" }
];

const POPULAR_GOALS = [
  "Low Sugar",
  "Heart Health",
  "Weight Loss",
  "Clean Purity",
  "Diabetic-Friendly",
  "Keto",
  "Vegan"
];

export default function SignUpScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { register, loginWithGoogle, isLoading } = useAuth();

  // Form Fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [age, setAge] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Health Factors
  const [selectedConditions, setSelectedConditions] = useState<string[]>(["Diabetes"]);
  const [selectedGoals, setSelectedGoals] = useState<string[]>(["Low Sugar", "Heart Health"]);

  // Agreement
  const [agreedToTerms, setAgreedToTerms] = useState(true);
  const [showTermsModal, setShowTermsModal] = useState(false);

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [signupSuccess, setSignupSuccess] = useState(false);

  // Dynamic Password Strength Calculation
  const passwordStrength = useMemo(() => {
    if (!password) return { score: 0, label: "", color: colors.border };
    if (password.length < 6) return { score: 1, label: "Too short (min 6 chars)", color: colors.crimson };

    let score = 1;
    if (password.length >= 8) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    if (score <= 2) return { score: 2, label: "Weak — add numbers or symbols", color: colors.crimson };
    if (score === 3 || score === 4) return { score: 3, label: "Good password", color: colors.amber };
    return { score: 4, label: "Strong & secure", color: colors.emerald };
  }, [password, colors]);

  const toggleCondition = (cond: string) => {
    setSelectedConditions((prev) =>
      prev.includes(cond) ? prev.filter((c) => c !== cond) : [...prev, cond]
    );
  };

  const toggleGoal = (goal: string) => {
    setSelectedGoals((prev) =>
      prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal]
    );
  };

  const handleRegister = async () => {
    if (submitting || googleSubmitting) return;

    const cleanName = fullName.trim();
    const cleanEmail = email.trim();

    if (!cleanName) {
      setErrorMessage("Please enter your full name.");
      return;
    }
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMessage("Please enter a valid email address (e.g. name@example.com).");
      return;
    }
    const parsedAge = age.trim() ? parseInt(age.trim(), 10) : null;
    if (parsedAge !== null && (isNaN(parsedAge) || parsedAge < 1 || parsedAge > 120)) {
      setErrorMessage("Please enter a valid age between 1 and 120.");
      return;
    }
    if (!password || password.length < 6) {
      setErrorMessage("Password must be at least 6 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match. Please re-enter.");
      return;
    }
    if (!agreedToTerms) {
      setErrorMessage("Please accept the Terms of Service & Health Privacy Policy.");
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      await register({
        fullName: cleanName,
        email: cleanEmail,
        age: parsedAge,
        password,
        healthConditions: selectedConditions,
        healthGoals: selectedGoals,
        dietaryPreferences: selectedGoals
      });
      setSignupSuccess(true);
      // Wait briefly so user sees email verification notice, then enter app
      setTimeout(() => {
        router.replace("/");
      }, 2400);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to create account. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignup = async () => {
    if (submitting || googleSubmitting) return;
    setGoogleSubmitting(true);
    setErrorMessage(null);
    try {
      await loginWithGoogle();
      router.replace("/");
    } catch (err: any) {
      setErrorMessage(err.message || "Google registration failed.");
    } finally {
      setGoogleSubmitting(false);
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
            paddingBottom: 60,
            maxWidth: 520,
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
              onPress={() => router.push("/login")}
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
              <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: "700" }}>
                ← Back to Log In
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.replace("/")}
              style={{ paddingHorizontal: 8, paddingVertical: 4 }}
            >
              <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: "600" }}>
                Skip as Guest
              </Text>
            </TouchableOpacity>
          </View>

          {/* Hero Branding Header */}
          <View style={{ alignItems: "center", marginBottom: 24 }}>
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
                marginBottom: 12,
                shadowColor: colors.emerald,
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.35,
                shadowRadius: 14,
                elevation: 6
              }}
            >
              <Text style={{ fontSize: 34 }}>🌿</Text>
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
              Create Your Health Lens
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: colors.textMuted,
                marginTop: 4,
                textAlign: "center",
                lineHeight: 19
              }}
            >
              Secure Firebase Authentication with personal allergen radar & nutritional intelligence.
            </Text>
          </View>

          {/* Verification Success Toast */}
          {signupSuccess && (
            <View
              style={{
                backgroundColor: `${colors.emerald}20`,
                borderColor: colors.emerald,
                borderWidth: 1.5,
                borderRadius: 16,
                padding: 16,
                marginBottom: 20,
                alignItems: "center",
                gap: 8
              }}
            >
              <Text style={{ fontSize: 24 }}>✉️</Text>
              <Text style={{ color: colors.emerald, fontSize: 15, fontWeight: "900", textAlign: "center" }}>
                Account Created Successfully!
              </Text>
              <Text style={{ color: colors.text, fontSize: 12, textAlign: "center", lineHeight: 18 }}>
                A verification link has been sent to your email. You are now being redirected to your dashboard...
              </Text>
            </View>
          )}

          {/* Main Registration Card */}
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
              gap: 20
            }}
          >
            {/* Quick Google Sign-Up Button */}
            <TouchableOpacity
              onPress={handleGoogleSignup}
              disabled={submitting || googleSubmitting || isLoading}
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
                gap: 12
              }}
            >
              {googleSubmitting ? (
                <ActivityIndicator size="small" color={colors.emerald} />
              ) : (
                <>
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
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: "800" }}>
                    Sign up with Google
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
              <Text style={{ fontSize: 11, color: colors.textDim, fontWeight: "700", textTransform: "uppercase" }}>
                or create email account
              </Text>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
            </View>

            {/* Error Notification */}
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
                <Text style={{ color: colors.crimson, fontSize: 12, fontWeight: "700", flex: 1, lineHeight: 17 }}>
                  {errorMessage}
                </Text>
              </View>
            )}

            {/* SECTION 1: CREDENTIALS */}
            <View style={{ gap: 14 }}>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "900",
                  color: colors.emerald,
                  textTransform: "uppercase",
                  letterSpacing: 1
                }}
              >
                1. Account Information
              </Text>

              {/* Full Name */}
              <View>
                <Text style={{ fontSize: 11, fontWeight: "800", color: colors.text, marginBottom: 4, textTransform: "uppercase" }}>
                  Full Name
                </Text>
                <TextInput
                  value={fullName}
                  onChangeText={(val) => {
                    setFullName(val);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="e.g. Alex Morgan"
                  placeholderTextColor={colors.textDim}
                  style={{
                    backgroundColor: colors.cardAlt,
                    borderColor: colors.border,
                    borderWidth: 1,
                    borderRadius: 14,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    color: colors.text,
                    fontSize: 14
                  }}
                />
              </View>

              {/* Email */}
              <View>
                <Text style={{ fontSize: 11, fontWeight: "800", color: colors.text, marginBottom: 4, textTransform: "uppercase" }}>
                  Email Address (Verification Sent Here)
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
                    fontSize: 14
                  }}
                />
              </View>

              {/* Age */}
              <View>
                <Text style={{ fontSize: 11, fontWeight: "800", color: colors.text, marginBottom: 4, textTransform: "uppercase" }}>
                  Age (Optional — Powers clinical guidance)
                </Text>
                <TextInput
                  value={age}
                  onChangeText={(val) => {
                    setAge(val.replace(/[^0-9]/g, ""));
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="e.g. 28"
                  placeholderTextColor={colors.textDim}
                  keyboardType="numeric"
                  maxLength={3}
                  style={{
                    backgroundColor: colors.cardAlt,
                    borderColor: colors.border,
                    borderWidth: 1,
                    borderRadius: 14,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    color: colors.text,
                    fontSize: 14
                  }}
                />
              </View>

              {/* Password */}
              <View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <Text style={{ fontSize: 11, fontWeight: "800", color: colors.text, textTransform: "uppercase" }}>
                    Password (min 6 characters)
                  </Text>
                  <TouchableOpacity onPress={() => setShowPassword((p) => !p)}>
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
                    placeholder="Create a strong password"
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
                      fontSize: 14
                    }}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword((p) => !p)}
                    style={{ position: "absolute", right: 14, top: 12, padding: 4 }}
                  >
                    <Text style={{ fontSize: 15 }}>{showPassword ? "👁️" : "🙈"}</Text>
                  </TouchableOpacity>
                </View>

                {/* Password Strength Feedback */}
                {password.length > 0 && (
                  <View style={{ marginTop: 8, gap: 4 }}>
                    <View style={{ flexDirection: "row", gap: 4 }}>
                      {[1, 2, 3, 4].map((step) => (
                        <View
                          key={step}
                          style={{
                            flex: 1,
                            height: 4,
                            borderRadius: 2,
                            backgroundColor:
                              passwordStrength.score >= step
                                ? passwordStrength.color
                                : colors.border
                          }}
                        />
                      ))}
                    </View>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: passwordStrength.color }}>
                      {passwordStrength.label}
                    </Text>
                  </View>
                )}
              </View>

              {/* Confirm Password */}
              <View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <Text style={{ fontSize: 11, fontWeight: "800", color: colors.text, textTransform: "uppercase" }}>
                    Confirm Password
                  </Text>
                  <TouchableOpacity onPress={() => setShowConfirmPassword((p) => !p)}>
                    <Text style={{ fontSize: 11, color: colors.emerald, fontWeight: "700" }}>
                      {showConfirmPassword ? "Hide" : "Show"}
                    </Text>
                  </TouchableOpacity>
                </View>

                <TextInput
                  value={confirmPassword}
                  onChangeText={(val) => {
                    setConfirmPassword(val);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="Repeat your password"
                  placeholderTextColor={colors.textDim}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  style={{
                    backgroundColor: colors.cardAlt,
                    borderColor:
                      confirmPassword && password !== confirmPassword
                        ? colors.crimson
                        : confirmPassword && password === confirmPassword
                        ? colors.emerald
                        : colors.border,
                    borderWidth: 1,
                    borderRadius: 14,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    color: colors.text,
                    fontSize: 14
                  }}
                />
                {confirmPassword && password !== confirmPassword ? (
                  <Text style={{ fontSize: 11, color: colors.crimson, marginTop: 4, fontWeight: "700" }}>
                    ⚠️ Passwords do not match
                  </Text>
                ) : confirmPassword && password === confirmPassword ? (
                  <Text style={{ fontSize: 11, color: colors.emerald, marginTop: 4, fontWeight: "800" }}>
                    ✓ Passwords match
                  </Text>
                ) : null}
              </View>
            </View>

            {/* SECTION 2: HEALTH CONDITIONS RADAR */}
            <View style={{ gap: 10 }}>
              <View>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "900",
                    color: colors.emerald,
                    textTransform: "uppercase",
                    letterSpacing: 1
                  }}
                >
                  2. Personal Health Radar
                </Text>
                <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                  NutriLens cross-checks ingredients against flagged conditions in real-time.
                </Text>
              </View>

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {HEALTH_CONDITIONS.map((cond) => {
                  const isSelected = selectedConditions.includes(cond.id);
                  return (
                    <TouchableOpacity
                      key={cond.id}
                      onPress={() => toggleCondition(cond.id)}
                      activeOpacity={0.7}
                      style={{
                        backgroundColor: isSelected ? `${colors.emerald}20` : colors.cardAlt,
                        borderColor: isSelected ? colors.emerald : colors.border,
                        borderWidth: isSelected ? 1.5 : 1,
                        borderRadius: 14,
                        paddingVertical: 8,
                        paddingHorizontal: 12,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6
                      }}
                    >
                      <Text style={{ fontSize: 14 }}>{cond.icon}</Text>
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: isSelected ? "800" : "600",
                          color: isSelected ? colors.emerald : colors.text
                        }}
                      >
                        {cond.name}
                      </Text>
                      {isSelected && (
                        <Text style={{ fontSize: 10, color: colors.emerald, fontWeight: "900" }}>✓</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* SECTION 3: DIETARY FOCUS */}
            <View style={{ gap: 10 }}>
              <View>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "900",
                    color: colors.emerald,
                    textTransform: "uppercase",
                    letterSpacing: 1
                  }}
                >
                  3. Wellness Focus & Goals
                </Text>
                <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                  Powers AI clean-swap suggestions and ingredient scoring.
                </Text>
              </View>

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {POPULAR_GOALS.map((goal) => {
                  const isSelected = selectedGoals.includes(goal);
                  return (
                    <TouchableOpacity
                      key={goal}
                      onPress={() => toggleGoal(goal)}
                      activeOpacity={0.7}
                      style={{
                        backgroundColor: isSelected ? `${colors.blue}20` : colors.cardAlt,
                        borderColor: isSelected ? colors.blue : colors.border,
                        borderWidth: 1,
                        borderRadius: 10,
                        paddingVertical: 6,
                        paddingHorizontal: 10
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: isSelected ? "800" : "600",
                          color: isSelected ? colors.blue : colors.textMuted
                        }}
                      >
                        {isSelected ? `✓ ${goal}` : `+ ${goal}`}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* TERMS & PRIVACY CHECKBOX */}
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
              <TouchableOpacity
                onPress={() => setAgreedToTerms((prev) => !prev)}
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 6,
                  borderWidth: 1.5,
                  borderColor: agreedToTerms ? colors.emerald : colors.border,
                  backgroundColor: agreedToTerms ? colors.emerald : "transparent",
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: 2
                }}
              >
                {agreedToTerms && <Text style={{ color: "#FFF", fontSize: 12, fontWeight: "900" }}>✓</Text>}
              </TouchableOpacity>

              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: colors.textMuted, lineHeight: 18 }}>
                  I agree to the{" "}
                  <Text
                    onPress={() => setShowTermsModal(true)}
                    style={{ color: colors.emerald, fontWeight: "800", textDecorationLine: "underline" }}
                  >
                    NutriLens Terms of Service
                  </Text>{" "}
                  and{" "}
                  <Text
                    onPress={() => setShowTermsModal(true)}
                    style={{ color: colors.emerald, fontWeight: "800", textDecorationLine: "underline" }}
                  >
                    Health Data Privacy Policy
                  </Text>.
                </Text>
              </View>
            </View>

            {/* CREATE ACCOUNT SUBMIT BUTTON */}
            <TouchableOpacity
              onPress={handleRegister}
              disabled={submitting || googleSubmitting || isLoading}
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
                  Create Account & Start Scanning 🚀
                </Text>
              )}
            </TouchableOpacity>

            {/* LINK BACK TO SIGN IN */}
            <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center" }}>
              <Text style={{ fontSize: 13, color: colors.textMuted }}>
                Already have an account?{" "}
              </Text>
              <TouchableOpacity onPress={() => router.push("/login")}>
                <Text style={{ fontSize: 13, fontWeight: "900", color: colors.emerald }}>
                  Sign In
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Medical Disclaimer */}
          <Text
            style={{
              fontSize: 11,
              color: colors.textDim,
              textAlign: "center",
              marginTop: 20,
              lineHeight: 16
            }}
          >
            NutriLens provides clinical nutrition intelligence for educational guidance.
            Always consult a medical professional for individual diagnostic treatment.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* TERMS & PRIVACY MODAL */}
      <Modal
        visible={showTermsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTermsModal(false)}
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
              maxWidth: 480,
              maxHeight: "80%",
              width: "100%",
              gap: 14
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: 18, fontWeight: "900", color: colors.text }}>
                NutriLens Health Privacy & Terms
              </Text>
              <TouchableOpacity onPress={() => setShowTermsModal(false)}>
                <Text style={{ fontSize: 18, color: colors.textMuted, fontWeight: "700" }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1, marginVertical: 6 }} showsVerticalScrollIndicator={true}>
              <Text style={{ fontSize: 13, color: colors.text, fontWeight: "800", marginBottom: 4 }}>
                1. Health Data Protection
              </Text>
              <Text style={{ fontSize: 12, color: colors.textMuted, lineHeight: 18, marginBottom: 12 }}>
                Your declared health conditions (e.g. Diabetes, Hypertension, Allergies) are strictly utilized to flag conflicting food ingredients and are never sold or shared with third-party advertisers.
              </Text>

              <Text style={{ fontSize: 13, color: colors.text, fontWeight: "800", marginBottom: 4 }}>
                2. AI Scanning & Disclaimer
              </Text>
              <Text style={{ fontSize: 12, color: colors.textMuted, lineHeight: 18, marginBottom: 12 }}>
                NutriLens utilizes on-device OCR and ML classification models to evaluate ingredient nutrition. While highly accurate, always review manufacturer labels for life-critical allergens.
              </Text>

              <Text style={{ fontSize: 13, color: colors.text, fontWeight: "800", marginBottom: 4 }}>
                3. Secure Firebase & Cloud Architecture
              </Text>
              <Text style={{ fontSize: 12, color: colors.textMuted, lineHeight: 18 }}>
                Authentication credentials and scan history are encrypted using industry-standard tokens and verified sessions.
              </Text>
            </ScrollView>

            <TouchableOpacity
              onPress={() => setShowTermsModal(false)}
              style={{
                backgroundColor: colors.emerald,
                paddingVertical: 12,
                borderRadius: 14,
                alignItems: "center"
              }}
            >
              <Text style={{ color: "#FFF", fontWeight: "900", fontSize: 14 }}>
                I Understand
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
