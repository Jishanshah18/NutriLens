import React, { useState, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, Animated, TextInput, ScrollView, Platform, Easing, Image, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { analyzeLabel, analyzeLabelImage, extractOcrText, getUserProfile, UserProfile } from "../lib/api";
import { useTheme } from "../lib/ThemeContext";
import { ScanningOverlay } from "../components/ScanningOverlay";
import { BottomNav } from "../components/BottomNav";

type ScanMode = "Barcode" | "Nutrition" | "Ingredient" | "Fresh Food";

const PRESET_SAMPLES = [
  {
    name: "Spicy Instant Ramen Noodles",
    text: "Ingredients: Enriched wheat flour, palm oil, salt, monosodium glutamate E621, artificial chicken flavor, caramel color E150d, disodium inosinate, sugar."
  },
  {
    name: "Organic Raw Blueberries & Oats",
    text: "Ingredients: 100% whole grain rolled oats, organic wild blueberries, chia seeds, pure cinnamon."
  },
  {
    name: "Zero Calorie Energy Drink",
    text: "Ingredients: Carbonated water, citric acid E330, taurine, artificial sweetener aspartame E951, sodium benzoate E211, artificial red 40 E129."
  },
  {
    name: "Aged Sharp Cheddar Cheese",
    text: "Ingredients: Pasteurized cultured milk, salt, microbial enzymes, annatto color."
  }
];

export default function ScannerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors, isDark } = useTheme();

  const [permission, requestPermission] = useCameraPermissions();
  const [activeMode, setActiveMode] = useState<ScanMode>("Ingredient");
  const [flashOn, setFlashOn] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [pendingResult, setPendingResult] = useState<any>(null);
  const [customText, setCustomText] = useState(PRESET_SAMPLES[0].text);
  const [productName, setProductName] = useState(PRESET_SAMPLES[0].name);

  // Gallery & Image State
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [selectedImageBase64, setSelectedImageBase64] = useState<string | null>(null);
  const [isExtractingOcr, setIsExtractingOcr] = useState(false);
  const [ocrStatusMessage, setOcrStatusMessage] = useState<string | null>(null);
  const [showManualEditor, setShowManualEditor] = useState(false);

  const [profile, setProfile] = useState<UserProfile>({
    user_id: "default_user",
    dietary_preferences: ["Low Sugar"],
    allergies: ["Peanuts", "Lactose Intolerant"],
    health_goals: ["Weight Loss"],
  });

  // Animated laser line
  const laserAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(laserAnim, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(laserAnim, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
      ])
    ).start();

    if (params.profile && typeof params.profile === "string") {
      try {
        setProfile(JSON.parse(params.profile));
      } catch (e) {}
    } else {
      getUserProfile("default_user").then(setProfile).catch(() => {});
    }
  }, [params.profile]);

  const laserTranslateY = laserAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 220]
  });

  // Helper to convert blob/URI to Base64 (needed on Web)
  const uriToBase64 = async (uri: string): Promise<string> => {
    if (uri.startsWith("data:image")) {
      return uri.split(",")[1];
    }
    const response = await fetch(uri);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const res = reader.result as string;
        const b64 = res.includes(",") ? res.split(",")[1] : res;
        resolve(b64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // 1. Pick Image from Gallery
  const pickImageFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted" && Platform.OS !== "web") {
        alert("Camera roll / gallery permissions are needed to select food images.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.85,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setSelectedImageUri(asset.uri);
        setIsExtractingOcr(true);
        setOcrStatusMessage("Reading ingredient text using local OCR...");

        let b64 = asset.base64 || "";
        if (!b64 && asset.uri) {
          b64 = await uriToBase64(asset.uri);
        }
        setSelectedImageBase64(b64);

        if (b64) {
          try {
            const ocrRes = await extractOcrText(b64);
            if (ocrRes.success && ocrRes.extracted_text.trim()) {
              setCustomText(ocrRes.extracted_text);
              const firstLine = ocrRes.extracted_text.split("\n")[0].replace(/ingredients:?/i, "").trim();
              setProductName(firstLine ? firstLine.slice(0, 35) : "Gallery Scanned Item");
              setOcrStatusMessage(`Successfully extracted ${ocrRes.words_count} words!`);
            } else {
              setOcrStatusMessage("OCR did not detect clear text. You can type or edit the ingredients below.");
            }
          } catch (ocrErr) {
            console.error("OCR Extraction Error:", ocrErr);
            setOcrStatusMessage("OCR engine offline. You can edit ingredients manually below.");
          }
        }
        setIsExtractingOcr(false);
      }
    } catch (err: any) {
      console.error("Gallery picker error:", err);
      setIsExtractingOcr(false);
      alert("Failed to pick image from gallery: " + (err.message || err));
    }
  };

  // 2. Capture Photo using Device Camera
  const takePhotoWithCamera = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted" && Platform.OS !== "web") {
        alert("Camera permission is required to capture photos.");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.85,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setSelectedImageUri(asset.uri);
        setIsExtractingOcr(true);
        setOcrStatusMessage("Extracting text from camera snapshot...");

        let b64 = asset.base64 || "";
        if (!b64 && asset.uri) {
          b64 = await uriToBase64(asset.uri);
        }
        setSelectedImageBase64(b64);

        if (b64) {
          try {
            const ocrRes = await extractOcrText(b64);
            if (ocrRes.success && ocrRes.extracted_text.trim()) {
              setCustomText(ocrRes.extracted_text);
              setOcrStatusMessage(`Extracted ${ocrRes.words_count} words!`);
            }
          } catch (e) {}
        }
        setIsExtractingOcr(false);
      }
    } catch (e) {
      // Fall back to scanning current text
      triggerAnalysis(customText, productName);
    }
  };

  // 3. Trigger Full Model Analysis
  const triggerAnalysis = async (textToScan: string, nameHint?: string) => {
    setIsAnalyzing(true);
    try {
      let result;
      if (selectedImageBase64 && (!textToScan || textToScan === customText)) {
        // Direct image analysis
        result = await analyzeLabelImage({
          image_base64: selectedImageBase64,
          user_profile: profile
        });
      } else {
        // Text OCR analysis
        result = await analyzeLabel({
          ocr_text: textToScan,
          user_profile: profile
        });
      }

      if (nameHint) {
        result.product_name = nameHint;
      } else if (productName) {
        result.product_name = productName;
      }
      setPendingResult(result);
    } catch (e: any) {
      console.error("Scan analysis error:", e);
      setIsAnalyzing(false);
      alert("Failed to analyze product. Please ensure backend is running.");
    }
  };

  const handleAnalysisAnimationComplete = () => {
    if (pendingResult) {
      setIsAnalyzing(false);
      router.push({
        pathname: "/results",
        params: { data: JSON.stringify(pendingResult) }
      });
    }
  };

  const selectPreset = (preset: typeof PRESET_SAMPLES[0]) => {
    setSelectedImageUri(null);
    setSelectedImageBase64(null);
    setOcrStatusMessage(null);
    setProductName(preset.name);
    setCustomText(preset.text);
    triggerAnalysis(preset.text, preset.name);
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#070B14" }}>
      {/* Multi-Stage AI Scanning Animation Overlay */}
      {isAnalyzing && (
        <ScanningOverlay
          productTitle={productName}
          onComplete={handleAnalysisAnimationComplete}
        />
      )}

      {/* Top Controls Bar */}
      <View style={{
        paddingTop: 44,
        paddingBottom: 12,
        paddingHorizontal: 18,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        zIndex: 20
      }}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: "rgba(255,255,255,0.12)",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <Text style={{ color: "#FFF", fontSize: 18, fontWeight: "700" }}>←</Text>
        </TouchableOpacity>

        <View style={{ alignItems: "center" }}>
          <Text style={{ color: "#F8FAFC", fontSize: 16, fontWeight: "900", letterSpacing: -0.3 }}>
            Smart AI Scanner
          </Text>
          <Text style={{ color: "#10B981", fontSize: 11, fontWeight: "700" }}>
            Offline OCR & ML
          </Text>
        </View>

        {/* Flash Toggle */}
        <TouchableOpacity
          onPress={() => setFlashOn((f) => !f)}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: flashOn ? "#10B981" : "rgba(255,255,255,0.12)",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <Text style={{ fontSize: 18 }}>{flashOn ? "⚡" : "🔦"}</Text>
        </TouchableOpacity>
      </View>

      {/* 4 Scan Modes Pill Selector */}
      <View style={{ paddingHorizontal: 16, marginBottom: 10, zIndex: 20 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {(["Ingredient", "Nutrition", "Barcode", "Fresh Food"] as ScanMode[]).map((m) => {
            const isSelected = activeMode === m;
            return (
              <TouchableOpacity
                key={m}
                onPress={() => setActiveMode(m)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 7,
                  borderRadius: 20,
                  backgroundColor: isSelected ? "#10B981" : "rgba(255,255,255,0.08)",
                  borderWidth: 1,
                  borderColor: isSelected ? "#10B981" : "rgba(255,255,255,0.12)"
                }}
              >
                <Text style={{ color: isSelected ? "#FFF" : "#94A3B8", fontSize: 12, fontWeight: "800" }}>
                  {m === "Ingredient" ? "🔬 Ingredients" : m === "Nutrition" ? "📊 Nutrition" : m === "Barcode" ? "🏷️ Barcode" : "🍎 Fresh Food"}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 30 }}>
        {/* Camera Viewfinder Box / Gallery Image Preview */}
        <View style={{
          height: 310,
          marginHorizontal: 16,
          borderRadius: 28,
          overflow: "hidden",
          backgroundColor: "#0B101D",
          position: "relative"
        }}>
          {selectedImageUri ? (
            /* Selected Gallery Photo Preview */
            <View style={{ flex: 1, position: "relative" }}>
              <Image
                source={{ uri: selectedImageUri }}
                style={{ width: "100%", height: "100%", resizeMode: "cover" }}
              />
              <View style={{
                position: "absolute",
                top: 12,
                left: 12,
                backgroundColor: "rgba(16, 185, 129, 0.9)",
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 12
              }}>
                <Text style={{ color: "#FFF", fontSize: 11, fontWeight: "800" }}>📸 Gallery Photo Loaded</Text>
              </View>

              <TouchableOpacity
                onPress={() => {
                  setSelectedImageUri(null);
                  setSelectedImageBase64(null);
                  setOcrStatusMessage(null);
                }}
                style={{
                  position: "absolute",
                  top: 12,
                  right: 12,
                  backgroundColor: "rgba(0,0,0,0.6)",
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <Text style={{ color: "#FFF", fontSize: 14, fontWeight: "900" }}>✕</Text>
              </TouchableOpacity>
            </View>
          ) : permission?.granted ? (
            <CameraView style={{ flex: 1 }} facing="back" />
          ) : (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0D1322" }}>
              <Text style={{ fontSize: 44, opacity: 0.25 }}>📦</Text>
              <Text style={{ color: "#64748B", fontSize: 12, marginTop: 10 }}>Live Camera Viewfinder</Text>
            </View>
          )}

          {/* Viewfinder Neon Corners Target Frame */}
          {!selectedImageUri && (
            <View style={{
              position: "absolute",
              top: "10%",
              left: "10%",
              right: "10%",
              height: 200,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.15)",
              borderRadius: 20,
              backgroundColor: "rgba(0,0,0,0.15)",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden"
            }}>
              <View style={{ position: "absolute", top: 0, left: 0, width: 24, height: 24, borderTopWidth: 3, borderLeftWidth: 3, borderColor: "#10B981", borderTopLeftRadius: 10 }} />
              <View style={{ position: "absolute", top: 0, right: 0, width: 24, height: 24, borderTopWidth: 3, borderRightWidth: 3, borderColor: "#10B981", borderTopRightRadius: 10 }} />
              <View style={{ position: "absolute", bottom: 0, left: 0, width: 24, height: 24, borderBottomWidth: 3, borderLeftWidth: 3, borderColor: "#10B981", borderBottomLeftRadius: 10 }} />
              <View style={{ position: "absolute", bottom: 0, right: 0, width: 24, height: 24, borderBottomWidth: 3, borderRightWidth: 3, borderColor: "#10B981", borderBottomRightRadius: 10 }} />

              <Animated.View style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 3,
                backgroundColor: "#10B981",
                shadowColor: "#10B981",
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 1,
                shadowRadius: 10,
                transform: [{ translateY: laserTranslateY }]
              }} />

              <View style={{ backgroundColor: "rgba(0,0,0,0.65)", paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12 }}>
                <Text style={{ color: "#F8FAFC", fontSize: 11, fontWeight: "700" }}>
                  Align {activeMode} label inside frame
                </Text>
              </View>
            </View>
          )}

          {/* Viewfinder Controls (Gallery + Shutter + Text) */}
          <View style={{
            position: "absolute",
            bottom: 12,
            left: 0,
            right: 0,
            flexDirection: "row",
            justifyContent: "space-around",
            alignItems: "center",
            paddingHorizontal: 24
          }}>
            {/* Gallery Upload Button */}
            <TouchableOpacity
              onPress={pickImageFromGallery}
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: "rgba(16,185,129,0.25)",
                borderWidth: 1.5,
                borderColor: "#10B981",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <Text style={{ fontSize: 22 }}>🖼️</Text>
            </TouchableOpacity>

            {/* Shutter Capture Button */}
            <TouchableOpacity
              onPress={selectedImageUri ? () => triggerAnalysis(customText, productName) : takePhotoWithCamera}
              activeOpacity={0.85}
              style={{
                width: 66,
                height: 66,
                borderRadius: 33,
                backgroundColor: "rgba(255,255,255,0.2)",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <View style={{
                width: 52,
                height: 52,
                borderRadius: 26,
                backgroundColor: "#10B981",
                borderWidth: 2.5,
                borderColor: "#FFF",
                alignItems: "center",
                justifyContent: "center",
                shadowColor: "#10B981",
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.8,
                shadowRadius: 8
              }}>
                <Text style={{ fontSize: 20 }}>⚡</Text>
              </View>
            </TouchableOpacity>

            {/* Quick Manual Text Toggle */}
            <TouchableOpacity
              onPress={() => setShowManualEditor((prev) => !prev)}
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: showManualEditor ? "#10B981" : "rgba(255,255,255,0.15)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.3)",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <Text style={{ fontSize: 18 }}>✏️</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Gallery Quick Action Bar */}
        <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
          <TouchableOpacity
            onPress={pickImageFromGallery}
            style={{
              backgroundColor: "rgba(16, 185, 129, 0.12)",
              borderColor: "rgba(16, 185, 129, 0.4)",
              borderWidth: 1.5,
              borderRadius: 18,
              paddingVertical: 12,
              paddingHorizontal: 16,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between"
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Text style={{ fontSize: 20 }}>📸</Text>
              <View>
                <Text style={{ color: "#F8FAFC", fontSize: 14, fontWeight: "800" }}>
                  Select Image from Gallery
                </Text>
                <Text style={{ color: "#94A3B8", fontSize: 11, marginTop: 1 }}>
                  Automatic on-device OCR extracts ingredients
                </Text>
              </View>
            </View>
            <View style={{ backgroundColor: "#10B981", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }}>
              <Text style={{ color: "#FFF", fontSize: 11, fontWeight: "900" }}>Upload</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* OCR Status / Extracting Indicator */}
        {isExtractingOcr && (
          <View style={{
            marginHorizontal: 16,
            marginTop: 10,
            backgroundColor: "rgba(16, 185, 129, 0.1)",
            borderColor: "#10B981",
            borderWidth: 1,
            borderRadius: 14,
            padding: 12,
            flexDirection: "row",
            alignItems: "center",
            gap: 10
          }}>
            <ActivityIndicator size="small" color="#10B981" />
            <Text style={{ color: "#10B981", fontSize: 12, fontWeight: "700" }}>
              {ocrStatusMessage || "Scanning image text..."}
            </Text>
          </View>
        )}

        {/* OCR Status feedback if completed */}
        {!isExtractingOcr && ocrStatusMessage && (
          <View style={{
            marginHorizontal: 16,
            marginTop: 10,
            backgroundColor: "rgba(255, 255, 255, 0.06)",
            borderColor: "rgba(255, 255, 255, 0.12)",
            borderWidth: 1,
            borderRadius: 14,
            padding: 10,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between"
          }}>
            <Text style={{ color: "#94A3B8", fontSize: 11, flex: 1 }}>{ocrStatusMessage}</Text>
            <TouchableOpacity onPress={() => setOcrStatusMessage(null)}>
              <Text style={{ color: "#64748B", fontSize: 12, paddingHorizontal: 6 }}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Extracted Ingredients & Manual Editor Card */}
        {(showManualEditor || selectedImageUri) && (
          <View style={{
            marginHorizontal: 16,
            marginTop: 12,
            backgroundColor: "rgba(255, 255, 255, 0.05)",
            borderColor: "rgba(255, 255, 255, 0.12)",
            borderWidth: 1,
            borderRadius: 20,
            padding: 14,
            gap: 10
          }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ color: "#10B981", fontSize: 12, fontWeight: "800", textTransform: "uppercase" }}>
                {selectedImageUri ? "Extracted Ingredients (Editable)" : "Custom Ingredient Input"}
              </Text>
              <Text style={{ color: "#64748B", fontSize: 11 }}>
                {customText.split(/\s+/).filter(Boolean).length} words
              </Text>
            </View>

            <TextInput
              value={customText}
              onChangeText={setCustomText}
              placeholder="Paste or edit ingredient list..."
              placeholderTextColor="#64748B"
              multiline
              numberOfLines={4}
              style={{
                backgroundColor: "rgba(0,0,0,0.35)",
                borderColor: "rgba(255,255,255,0.1)",
                borderWidth: 1,
                borderRadius: 14,
                padding: 12,
                color: "#F8FAFC",
                fontSize: 13,
                minHeight: 80,
                textAlignVertical: "top"
              }}
            />

            {/* Big Analyze Button */}
            <TouchableOpacity
              onPress={() => triggerAnalysis(customText, productName)}
              style={{
                backgroundColor: "#10B981",
                borderRadius: 16,
                paddingVertical: 12,
                alignItems: "center",
                shadowColor: "#10B981",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8
              }}
            >
              <Text style={{ color: "#FFF", fontSize: 14, fontWeight: "900" }}>
                🚀 Analyze Scanned Ingredients
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Preset Demo Strip */}
        <View style={{ padding: 16, marginTop: 6 }}>
          <Text style={{ color: "#94A3B8", fontSize: 11, fontWeight: "800", textTransform: "uppercase", marginBottom: 8 }}>
            Sample Products (Tap to Test AI Model)
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {PRESET_SAMPLES.map((preset) => (
              <TouchableOpacity
                key={preset.name}
                onPress={() => selectPreset(preset)}
                style={{
                  backgroundColor: "rgba(255,255,255,0.08)",
                  borderColor: productName === preset.name ? "#10B981" : "rgba(255,255,255,0.12)",
                  borderWidth: 1,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 14
                }}
              >
                <Text style={{ color: "#F8FAFC", fontSize: 12, fontWeight: "700" }}>{preset.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </ScrollView>

      {/* Global Bottom Navigation */}
      <BottomNav />
    </View>
  );
}
