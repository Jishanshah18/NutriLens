import React, { useState, useEffect, useRef } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Animated } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { sendChatMessage, getUserProfile, UserProfile } from "../lib/api";
import { useTheme } from "../lib/ThemeContext";
import { BottomNav } from "../components/BottomNav";

interface MessageItem {
  id: string;
  sender: "user" | "ai";
  text: string;
  timestamp: string;
  detectedAdditives?: string[];
  safetyVerdict?: string;
}

const LANGUAGES = [
  { code: "en", label: "English 🇬🇧" },
  { code: "hi", label: "हिंदी 🇮🇳" },
  { code: "es", label: "Español 🇪🇸" },
  { code: "fr", label: "Français 🇫🇷" }
];

const QUICK_SUGGESTIONS = [
  "Is E621 (MSG) dangerous?",
  "What are ultra-processed foods?",
  "Find clean snacks for weight loss",
  "Is Maltodextrin worse than sugar?",
  "Healthy swaps for packaged chips"
];

export default function ChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors, isDark } = useTheme();

  const [selectedLang, setSelectedLang] = useState("en");
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const [messages, setMessages] = useState<MessageItem[]>([
    {
      id: "m-welcome",
      sender: "ai",
      text: "Hello Jishan! I am your NutriLens AI Nutritionist. Ask me about any ingredient, preservative E-code, allergen risk, or diet optimization!",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    }
  ]);

  const scrollViewRef = useRef<ScrollView>(null);

  // Typing indicator dots animation
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    getUserProfile("default_user").then(setProfile).catch(() => {});

    // Check if opened with an initial message from results screen
    if (params.initialMessage && typeof params.initialMessage === "string") {
      handleSend(params.initialMessage);
    }
  }, [params.initialMessage]);

  useEffect(() => {
    if (isTyping) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(dot1, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot2, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot3, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot1, { toValue: 0.3, duration: 300, useNativeDriver: true }),
          Animated.timing(dot2, { toValue: 0.3, duration: 300, useNativeDriver: true }),
          Animated.timing(dot3, { toValue: 0.3, duration: 300, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [isTyping]);

  const handleSend = async (messageText?: string) => {
    const textToSend = messageText || inputText;
    if (!textToSend.trim() || isTyping) return;

    const userMsg: MessageItem = {
      id: `u-${Date.now()}`,
      sender: "user",
      text: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setIsTyping(true);

    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);

    try {
      const res = await sendChatMessage({
        message: textToSend.trim(),
        language: selectedLang,
        user_profile: profile || undefined,
        product_context: typeof params.productContext === "string" ? params.productContext : undefined
      });

      const aiMsg: MessageItem = {
        id: `ai-${Date.now()}`,
        sender: "ai",
        text: res.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        detectedAdditives: res.detected_additives,
        safetyVerdict: res.safety_verdict
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (e) {
      const errorMsg: MessageItem = {
        id: `err-${Date.now()}`,
        sender: "ai",
        text: "Sorry, I had trouble reaching the nutrition engine. Please ensure the backend server is running.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: colors.bg }}
    >
      {/* Top Header */}
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
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: `${colors.emerald}20`,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: colors.emerald
          }}>
            <Text style={{ fontSize: 20 }}>🤖</Text>
          </View>
          <View>
            <Text style={{ fontSize: 16, fontWeight: "900", color: colors.text }}>
              NutriLens AI Dietitian
            </Text>
            <Text style={{ fontSize: 11, color: colors.emerald, fontWeight: "700" }}>
              Offline Neural Intelligence
            </Text>
          </View>
        </View>

        {/* Clear Chat Button */}
        <TouchableOpacity
          onPress={() => setMessages([messages[0]])}
          style={{
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 12,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border
          }}
        >
          <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: "700" }}>Clear</Text>
        </TouchableOpacity>
      </View>

      {/* Multilingual Selector Strip */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {LANGUAGES.map((lang) => {
            const isSelected = selectedLang === lang.code;
            return (
              <TouchableOpacity
                key={lang.code}
                onPress={() => setSelectedLang(lang.code)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 5,
                  borderRadius: 14,
                  backgroundColor: isSelected ? colors.emerald : colors.card,
                  borderWidth: 1,
                  borderColor: isSelected ? colors.emerald : colors.border
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: "800", color: isSelected ? "#FFF" : colors.textMuted }}>
                  {lang.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Message Stream */}
      <ScrollView
        ref={scrollViewRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, gap: 14 }}
      >
        {messages.map((msg) => {
          const isUser = msg.sender === "user";
          return (
            <View
              key={msg.id}
              style={{
                alignSelf: isUser ? "flex-end" : "flex-start",
                maxWidth: "85%",
                backgroundColor: isUser ? colors.emerald : colors.card,
                borderColor: isUser ? colors.emerald : colors.border,
                borderWidth: 1,
                borderRadius: 20,
                borderTopRightRadius: isUser ? 4 : 20,
                borderTopLeftRadius: isUser ? 20 : 4,
                padding: 14,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 6,
                elevation: 2
              }}
            >
              {/* Verdict Tag if available */}
              {msg.safetyVerdict && (
                <View style={{
                  backgroundColor: "rgba(0,0,0,0.2)",
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 8,
                  alignSelf: "flex-start",
                  marginBottom: 6
                }}>
                  <Text style={{ fontSize: 10, fontWeight: "800", color: "#F8FAFC" }}>
                    {msg.safetyVerdict}
                  </Text>
                </View>
              )}

              <Text style={{
                color: isUser ? "#FFF" : colors.text,
                fontSize: 14,
                lineHeight: 20,
                fontWeight: "500"
              }}>
                {msg.text}
              </Text>

              {/* Timestamp */}
              <Text style={{
                color: isUser ? "rgba(255,255,255,0.7)" : colors.textDim,
                fontSize: 9,
                fontWeight: "600",
                marginTop: 4,
                alignSelf: "flex-end"
              }}>
                {msg.timestamp}
              </Text>
            </View>
          );
        })}

        {/* Typing Animation Indicator */}
        {isTyping && (
          <View style={{
            alignSelf: "flex-start",
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 18,
            paddingHorizontal: 16,
            paddingVertical: 12,
            flexDirection: "row",
            alignItems: "center",
            gap: 6
          }}>
            <Text style={{ fontSize: 12, color: colors.textMuted, marginRight: 4 }}>NutriBot typing</Text>
            <Animated.View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.emerald, opacity: dot1 }} />
            <Animated.View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.emerald, opacity: dot2 }} />
            <Animated.View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.emerald, opacity: dot3 }} />
          </View>
        )}
      </ScrollView>

      {/* Quick Suggestion Chips */}
      <View style={{ paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.bg }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {QUICK_SUGGESTIONS.map((chip, idx) => (
            <TouchableOpacity
              key={idx}
              onPress={() => handleSend(chip)}
              style={{
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderWidth: 1,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 16
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: "700", color: colors.emerald }}>
                {chip}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Input Dock Bar */}
      <View style={{
        paddingHorizontal: 14,
        paddingTop: 8,
        paddingBottom: 10,
        backgroundColor: colors.card,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        flexDirection: "row",
        alignItems: "center",
        gap: 10
      }}>
        <TextInput
          value={inputText}
          onChangeText={setInputText}
          placeholder="Ask about ingredients, additives, E-codes..."
          placeholderTextColor={colors.textDim}
          onSubmitEditing={() => handleSend()}
          style={{
            flex: 1,
            backgroundColor: colors.cardAlt,
            color: colors.text,
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 22,
            fontSize: 14,
            borderWidth: 1,
            borderColor: colors.border
          }}
        />

        <TouchableOpacity
          onPress={() => handleSend()}
          disabled={!inputText.trim() || isTyping}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: inputText.trim() ? colors.emerald : colors.cardAlt,
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <Text style={{ fontSize: 18, color: "#FFF" }}>➔</Text>
        </TouchableOpacity>
      </View>

      {/* Global Bottom Navigation */}
      <BottomNav />
    </KeyboardAvoidingView>
  );
}
