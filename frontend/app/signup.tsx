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
  const { colors } = useTheme();
  const { register, isLoading } = useAuth();

  // Form Fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [age, setAge] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Selected Health Factors
  const [selectedConditions, setSelectedConditions] = useState<string[]>(["Diabetes"]);
  const [selectedGoals, setSelectedGoals] = useState<string[]>(["Low Sugar", "Heart Health"]);

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
    if (!fullName.trim()) {
      setErrorMessage("Please enter your full name.");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setErrorMessage("Please enter a valid email address.");
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
      setErrorMessage("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      await register({
        fullName: fullName.trim(),
        email: email.trim(),
        age: parsedAge,
        password,
        healthConditions: selectedConditions,
        healthGoals: selectedGoals,
        dietaryPreferences: selectedGoals
      });
      router.replace("/");
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to create account. Please try again.");
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
            paddingBottom: 60,
            maxWidth: 560,
            width: "100%",
            alignSelf: "center"
          }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Top Bar Navigation */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <TouchableOpacity
              onPress={() => router.push("/login")}
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
              <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: "700" }}>← Back to Log In</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.replace("/")} style={{ padding: 4 }}>
              <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: "600" }}>Skip as Guest</Text>
            </TouchableOpacity>
          </View>

          {/* Hero Header */}
          <View style={{ alignItems: "center", marginBottom: 24 }}>
            <View
              style={{
                width: 68,
                height: 68,
                borderRadius: 34,
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
              <Text style={{ fontSize: 32 }}>🩺</Text>
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
                lineHeight: 18
              }}
            >
              Personalize food scanning to monitor your specific conditions and wellness goals.
            </Text>
          </View>

          {/* Card Container */}
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
              gap: 20
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
                <Text style={{ color: colors.crimson, fontSize: 12, fontWeight: "700", flex: 1 }}>
                  {errorMessage}
                </Text>
              </View>
            )}

            {/* STEP 1: CREDENTIALS */}
            <View style={{ gap: 14 }}>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "900",
                  color: colors.emerald,
                  textTransform: "uppercase",
                  letterSpacing: 1
                }}
              >
                1. Account Details
              </Text>

              {/* Full Name */}
              <View>
                <Text style={{ fontSize: 11, fontWeight: "800", color: colors.textMuted, marginBottom: 4, textTransform: "uppercase" }}>
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

              {/* Email Address */}
              <View>
                <Text style={{ fontSize: 11, fontWeight: "800", color: colors.textMuted, marginBottom: 4, textTransform: "uppercase" }}>
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
                    fontSize: 14
                  }}
                />
              </View>

              {/* Age Field */}
              <View>
                <Text style={{ fontSize: 11, fontWeight: "800", color: colors.textMuted, marginBottom: 4, textTransform: "uppercase" }}>
                  Age (Powers clinical nutrition guidance)
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
                  <Text style={{ fontSize: 11, fontWeight: "800", color: colors.textMuted, textTransform: "uppercase" }}>
                    Password (min 6 characters)
                  </Text>
                  <TouchableOpacity onPress={() => setShowPassword((p) => !p)}>
                    <Text style={{ fontSize: 11, color: colors.emerald, fontWeight: "700" }}>
                      {showPassword ? "Hide" : "Show"}
                    </Text>
                  </TouchableOpacity>
                </View>

                <TextInput
                  value={password}
                  onChangeText={(val) => {
                    setPassword(val);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="Create a secure password"
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
                    color: colors.text,
                    fontSize: 14
                  }}
                />
              </View>

              {/* Confirm Password */}
              <View>
                <Text style={{ fontSize: 11, fontWeight: "800", color: colors.textMuted, marginBottom: 4, textTransform: "uppercase" }}>
                  Confirm Password
                </Text>
                <TextInput
                  value={confirmPassword}
                  onChangeText={(val) => {
                    setConfirmPassword(val);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="Repeat your password"
                  placeholderTextColor={colors.textDim}
                  secureTextEntry={!showPassword}
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
                  <Text style={{ fontSize: 11, color: colors.crimson, marginTop: 4, fontWeight: "600" }}>
                    Passwords do not match
                  </Text>
                ) : confirmPassword && password === confirmPassword ? (
                  <Text style={{ fontSize: 11, color: colors.emerald, marginTop: 4, fontWeight: "700" }}>
                    ✓ Passwords match
                  </Text>
                ) : null}
              </View>
            </View>

            {/* STEP 2: HEALTH CONDITIONS */}
            <View style={{ gap: 10 }}>
              <View>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "900",
                    color: colors.emerald,
                    textTransform: "uppercase",
                    letterSpacing: 1
                  }}
                >
                  2. Select Health Conditions (Radar)
                </Text>
                <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                  The AI scanner checks ingredients and warns you about conflicting items.
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

            {/* STEP 3: GOALS & DIETARY PREFERENCES */}
            <View style={{ gap: 10 }}>
              <View>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "900",
                    color: colors.emerald,
                    textTransform: "uppercase",
                    letterSpacing: 1
                  }}
                >
                  3. Dietary Focus & Goals
                </Text>
                <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                  Used to generate healthier clean-swap recommendations.
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

            {/* Sign Up Submit Button */}
            <TouchableOpacity
              onPress={handleRegister}
              disabled={submitting || isLoading}
              activeOpacity={0.85}
              style={{
                backgroundColor: colors.emerald,
                paddingVertical: 14,
                borderRadius: 16,
                alignItems: "center",
                justifyContent: "center",
                marginTop: 6,
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
                  Create Account & Start Scanning 🚀
                </Text>
              )}
            </TouchableOpacity>

            {/* Link to Log In */}
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

          {/* Medical Notice */}
          <Text
            style={{
              fontSize: 11,
              color: colors.textDim,
              textAlign: "center",
              marginTop: 20,
              lineHeight: 16
            }}
          >
            NutriLens provides educational nutrition insights and is not a substitute for clinical medical advice.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
