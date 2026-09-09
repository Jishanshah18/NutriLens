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

function buildInstantLocalAnalysis(text: string = "", name: string = "Scanned Food Product") {
  const textLower = (text || "").toLowerCase();
  
  const additives: Array<{ code: string; name: string; risk_level: string; description: string }> = [];
  if (textLower.includes("e621") || textLower.includes("monosodium glutamate") || textLower.includes("msg")) {
    additives.push({ code: "E621", name: "Monosodium Glutamate", risk_level: "Moderate", description: "Flavor enhancer associated with excitotoxicity in sensitive individuals." });
  }
  if (textLower.includes("e150") || textLower.includes("caramel color")) {
    additives.push({ code: "E150d", name: "Caramel IV - Sulfite Ammonia", risk_level: "Moderate", description: "Industrial food coloring synthesized under pressure." });
  }
  if (textLower.includes("e330") || textLower.includes("citric acid")) {
    additives.push({ code: "E330", name: "Citric Acid", risk_level: "Low", description: "Standard antioxidant and acidity regulator." });
  }
  if (textLower.includes("e951") || textLower.includes("aspartame")) {
    additives.push({ code: "E951", name: "Aspartame", risk_level: "High", description: "Artificial intense sweetener with potential metabolic health risks." });
  }

  const allergens: string[] = [];
  if (textLower.includes("wheat") || textLower.includes("flour") || textLower.includes("gluten")) allergens.push("Gluten / Wheat");
  if (textLower.includes("milk") || textLower.includes("cheddar") || textLower.includes("cheese") || textLower.includes("lactose")) allergens.push("Dairy / Lactose");
  if (textLower.includes("peanut")) allergens.push("Peanuts");
  if (textLower.includes("soy")) allergens.push("Soy");

  const hasHighRisk = additives.some(a => a.risk_level === "High") || textLower.includes("palm oil") || textLower.includes("artificial");
  const healthScore = hasHighRisk ? 42 : (allergens.length > 0 ? 68 : 88);
  const novaGroup = hasHighRisk ? 4 : (additives.length > 0 ? 3 : 1);

  return {
    product_name: name || "Scanned Food Product",
    health_score: healthScore,
    nova_group: novaGroup,
    allergen_flags: allergens,
    ingredient_risks: hasHighRisk ? ["Contains ultra-processed industrial additives or refined oils."] : [],
    positive_attributes: healthScore >= 80 ? ["Clean whole food ingredients with natural nutrients."] : ["Provides quick energy."],
    additives: additives,
    nutrition_estimate: {
      calories: novaGroup >= 3 ? 240 : 130,
      protein_g: novaGroup >= 3 ? 4 : 8,
      carbs_g: novaGroup >= 3 ? 32 : 12,
      fat_g: novaGroup >= 3 ? 10 : 3,
      sugar_g: novaGroup >= 3 ? 14 : 2,
      sodium_mg: novaGroup >= 3 ? 420 : 80
    },
    healthier_alternatives: [
      { name: "Organic Sprouted Pumpkin & Sunflower Seeds", reason: "Clean bioavailable zinc and plant protein with zero refined oils.", estimated_health_score: 96 },
      { name: "Wild-Harvested Dried Blueberries & Almonds", reason: "Rich in antioxidants with natural low sugar impact.", estimated_health_score: 92 }
    ],
    personalized_verdict: hasHighRisk
      ? "Ultra-Processed Food: Contains multiple industrial additives or high glycemic markers. Recommended to consume rarely."
      : "Wholesome Product: Balanced nutritional makeup; aligns well with health goals.",
    ocr_text: text || "Ingredients list processed instantly."
  };
}

export default function ScannerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors, isDark } = useTheme();

  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [activeMode, setActiveMode] = useState<ScanMode>("Ingredient");
  const [flashOn, setFlashOn] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [pendingResult, setPendingResult] = useState<any>(null);
  const [customText, setCustomText] = useState("");
  const [productName, setProductName] = useState("");

  // Live Camera Stream State
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const webVideoRef = useRef<any>(null);
  const webStreamRef = useRef<any>(null);

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

  // Auto-start camera when scanner opens, clean up when leaving
  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

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
        setCustomText("");
        setProductName("");
        setIsExtractingOcr(true);
        setOcrStatusMessage("Scanning photo for ingredient text...");

        let b64 = asset.base64 || "";
        if (!b64 && asset.uri) {
          b64 = await uriToBase64(asset.uri);
        }
        setSelectedImageBase64(b64);

        if (b64) {
          try {
            const ocrRes = await extractOcrText(b64);
            if (ocrRes.success && ocrRes.extracted_text && ocrRes.extracted_text.trim()) {
              setCustomText(ocrRes.extracted_text);
              const firstLine = ocrRes.extracted_text.split("\n")[0].replace(/ingredients:?/i, "").trim();
              setProductName(firstLine ? firstLine.slice(0, 35) : "Gallery Scanned Item");
              setOcrStatusMessage(`Extracted ${ocrRes.words_count} words from image!`);
            } else {
              setOcrStatusMessage("No clear ingredient text detected in this photo. You can type ingredients manually below.");
            }
          } catch (ocrErr) {
            console.warn("OCR Extraction Notice:", ocrErr);
            setOcrStatusMessage("Could not extract text automatically. You can enter ingredients below.");
          }
        }
        setIsExtractingOcr(false);
      }
    } catch (err: any) {
      console.warn("Gallery picker notice:", err);
      setIsExtractingOcr(false);
      alert("Failed to pick image from gallery: " + (err.message || err));
    }
  };

  // Live Camera Starter (WebRTC on Web, CameraView on Native)
  const startCamera = async () => {
    setCameraError(null);
    setIsCameraLoading(true);
    setSelectedImageUri(null);
    setSelectedImageBase64(null);
    setOcrStatusMessage(null);

    if (Platform.OS === "web") {
      try {
        if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
          setCameraError("Camera is not supported on this browser context.");
          setIsCameraLoading(false);
          return;
        }

        // Clean up any existing stream
        if (webStreamRef.current) {
          webStreamRef.current.getTracks().forEach((t: any) => t.stop());
          webStreamRef.current = null;
        }

        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }
          });
        } catch (envErr) {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }

        webStreamRef.current = stream;
        setIsCameraActive(true);
        setIsCameraLoading(false);

        if (webVideoRef.current) {
          webVideoRef.current.srcObject = stream;
          webVideoRef.current.play().catch(() => {});
        }
      } catch (err: any) {
        console.error("Camera access error:", err);
        setCameraError("Camera permission denied. Please allow camera access in your browser address bar.");
        setIsCameraActive(false);
        setIsCameraLoading(false);
      }
    } else {
      // Native (iOS/Android)
      try {
        const res = await requestPermission();
        if (res.granted) {
          setIsCameraActive(true);
        } else {
          setCameraError("Camera permission required. Please allow camera in device settings.");
        }
      } catch (err) {
        setCameraError("Could not access device camera.");
      }
      setIsCameraLoading(false);
    }
  };

  const stopCamera = () => {
    if (webStreamRef.current) {
      webStreamRef.current.getTracks().forEach((t: any) => t.stop());
      webStreamRef.current = null;
    }
    setIsCameraActive(false);
  };

  // 2. Open Camera & Capture Photo Handler
  const handleCameraAction = async () => {
    // If a photo was already captured, clicking camera clears it and starts live camera
    if (selectedImageUri) {
      setSelectedImageUri(null);
      setSelectedImageBase64(null);
      setOcrStatusMessage(null);
      await startCamera();
      return;
    }

    // If camera is not active yet, start/open it
    if (!isCameraActive) {
      await startCamera();
      return;
    }

    // Camera IS active: snap photo directly from live feed
    if (Platform.OS === "web") {
      try {
        const video = webVideoRef.current;
        if (!video || !video.videoWidth) {
          await startCamera();
          return;
        }

        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
          const b64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;

          // Display captured snapshot
          setSelectedImageUri(dataUrl);
          setSelectedImageBase64(b64);
          setCustomText("");
          setProductName("");
          setIsExtractingOcr(true);
          setOcrStatusMessage("Extracting text from camera snapshot...");

          // Stop camera stream so hardware indicator turns off
          stopCamera();

          try {
            const ocrRes = await extractOcrText(b64);
            if (ocrRes.success && ocrRes.extracted_text && ocrRes.extracted_text.trim()) {
              setCustomText(ocrRes.extracted_text);
              const firstLine = ocrRes.extracted_text.split("\n")[0].replace(/ingredients:?/i, "").trim();
              setProductName(firstLine ? firstLine.slice(0, 35) : "Camera Scanned Item");
              setOcrStatusMessage(`Extracted ${ocrRes.words_count} words! Click Analyze to review.`);
            } else {
              setOcrStatusMessage("No clear ingredient text detected in photo. You can type ingredients manually below.");
            }
          } catch (e) {
            setOcrStatusMessage("Photo captured. You can enter ingredients below to analyze.");
          }
          setIsExtractingOcr(false);
        }
      } catch (err) {
        console.error("Web camera capture error:", err);
      }
    } else {
      // Native capture via CameraView
      try {
        if (cameraRef.current) {
          const photo = await cameraRef.current.takePictureAsync({
            quality: 0.85,
            base64: true,
          });

          if (photo && photo.uri) {
            setSelectedImageUri(photo.uri);
            setCustomText("");
            setProductName("");
            setIsExtractingOcr(true);
            setOcrStatusMessage("Extracting text from camera snapshot...");

            let b64 = photo.base64 || "";
            if (!b64 && photo.uri) {
              b64 = await uriToBase64(photo.uri);
            }
            setSelectedImageBase64(b64);
            setIsCameraActive(false);

            if (b64) {
              try {
                const ocrRes = await extractOcrText(b64);
                if (ocrRes.success && ocrRes.extracted_text && ocrRes.extracted_text.trim()) {
                  setCustomText(ocrRes.extracted_text);
                  const firstLine = ocrRes.extracted_text.split("\n")[0].replace(/ingredients:?/i, "").trim();
                  setProductName(firstLine ? firstLine.slice(0, 35) : "Camera Scanned Item");
                  setOcrStatusMessage(`Extracted ${ocrRes.words_count} words! Click Analyze to review.`);
                } else {
                  setOcrStatusMessage("No clear ingredient text detected in photo. You can type ingredients manually below.");
                }
              } catch (e) {
                setOcrStatusMessage("Photo captured. You can enter ingredients below to analyze.");
              }
            }
            setIsExtractingOcr(false);
          }
        }
      } catch (err) {
        console.warn("Native camera capture error:", err);
      }
    }
  };

  // 3. Trigger Full Model Analysis
  const triggerAnalysis = async (textToScan?: string, nameHint?: string) => {
    let targetText = (textToScan !== undefined ? textToScan : customText).trim();
    if (activeMode === "Barcode" && /^\d{8,14}$/.test(targetText)) {
      targetText = `Scanned Barcode GTIN: ${targetText}`;
    }
    const targetName = nameHint || productName || (targetText ? "Scanned Food Product" : "");

    if (!targetText && !selectedImageBase64) {
      alert(activeMode === "Barcode" ? "Please enter or scan a food barcode." : "Please upload/capture an ingredient label photo or enter ingredients text.");
      return;
    }

    setIsAnalyzing(true);
    try {
      // 15-second timeout for backend OCR & ML model inference
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 15000));

      let apiPromise: Promise<any>;
      if (selectedImageBase64 && !targetText) {
        apiPromise = analyzeLabelImage({
          image_base64: selectedImageBase64,
          user_profile: profile
        });
      } else {
        apiPromise = analyzeLabel({
          ocr_text: targetText || "Ingredients not specified",
          user_profile: profile
        });
      }

      let result = await Promise.race([apiPromise, timeoutPromise]);

      if (!result) {
        // Local client fallback if backend is offline
        result = buildInstantLocalAnalysis(targetText, targetName || "Scanned Food Product");
      }

      if (targetName && (!result.product_name || result.product_name === "Scanned Food Product")) {
        result.product_name = targetName;
      }
      setPendingResult(result);

      // Navigate to results page
      setIsAnalyzing(false);
      router.push({
        pathname: "/results",
        params: { data: JSON.stringify(result) }
      });
    } catch (e: any) {
      console.warn("Scan analysis notice:", e);
      setIsAnalyzing(false);
      const fallback = buildInstantLocalAnalysis(targetText, targetName || "Scanned Food Product");
      router.push({
        pathname: "/results",
        params: { data: JSON.stringify(fallback) }
      });
    }
  };

  const handleAnalysisAnimationComplete = () => {
    setIsAnalyzing(false);
    if (pendingResult) {
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
                  startCamera();
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
          ) : isCameraLoading ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0D1322" }}>
              <ActivityIndicator size="large" color="#10B981" />
              <Text style={{ color: "#94A3B8", fontSize: 13, fontWeight: "700", marginTop: 12 }}>
                Opening live camera...
              </Text>
            </View>
          ) : isCameraActive ? (
            Platform.OS === "web" ? (
              <View style={{ flex: 1, backgroundColor: "#000", overflow: "hidden", position: "relative" }}>
                {React.createElement("video", {
                  ref: (el: any) => {
                    webVideoRef.current = el;
                    if (el && webStreamRef.current && el.srcObject !== webStreamRef.current) {
                      el.srcObject = webStreamRef.current;
                      el.play().catch(() => {});
                    }
                  },
                  autoPlay: true,
                  playsInline: true,
                  muted: true,
                  style: {
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    position: "absolute",
                    top: 0,
                    left: 0
                  }
                })}
              </View>
            ) : (
              <CameraView
                ref={cameraRef}
                style={{ flex: 1 }}
                facing="back"
                enableTorch={flashOn}
                onBarcodeScanned={(barcode) => {
                  if (!isAnalyzing && barcode.data) {
                    triggerAnalysis(`Scanned Barcode GTIN: ${barcode.data}`, `Scanned Item (${barcode.data.slice(-4)})`);
                  }
                }}
              />
            )
          ) : (
            <TouchableOpacity
              onPress={startCamera}
              activeOpacity={0.8}
              style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0D1322", padding: 20 }}
            >
              <View style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: "rgba(16, 185, 129, 0.15)",
                borderWidth: 1.5,
                borderColor: "#10B981",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 10
              }}>
                <Image
                  source={require("../assets/camera-icon-white.png")}
                  style={{ width: 32, height: 32 }}
                  resizeMode="contain"
                />
              </View>
              <Text style={{ color: "#F8FAFC", fontSize: 15, fontWeight: "800" }}>
                {cameraError ? "Camera Access Needed" : "Tap to Open Live Camera"}
              </Text>
              <Text style={{ color: "#64748B", fontSize: 11, marginTop: 4, textAlign: "center" }}>
                {cameraError || "Click here or camera button below to activate live feed"}
              </Text>
              {cameraError && (
                <View style={{ marginTop: 12, backgroundColor: "#10B981", paddingHorizontal: 14, paddingVertical: 6, borderRadius: 10 }}>
                  <Text style={{ color: "#FFF", fontSize: 12, fontWeight: "800" }}>Retry Camera</Text>
                </View>
              )}
            </TouchableOpacity>
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

            {/* Shutter / Camera Capture Button */}
            <TouchableOpacity
              onPress={handleCameraAction}
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
                <Image
                  source={require("../assets/camera-icon-white.png")}
                  style={{ width: 28, height: 28 }}
                  resizeMode="contain"
                />
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
              <Text style={{ fontSize: 20 }}>🖼️</Text>
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
        {(showManualEditor || selectedImageUri || activeMode === "Barcode") && (
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
                {activeMode === "Barcode"
                  ? "🏷️ Barcode GTIN / EAN Lookup"
                  : selectedImageUri
                  ? "Extracted Ingredients (Editable)"
                  : "Custom Ingredient Input"}
              </Text>
              <Text style={{ color: "#64748B", fontSize: 11 }}>
                {activeMode === "Barcode"
                  ? `${customText.replace(/\D/g, "").length} digits`
                  : isExtractingOcr
                  ? "Scanning..."
                  : `${customText.split(/\s+/).filter(Boolean).length} words`}
              </Text>
            </View>

            <TextInput
              value={customText}
              onChangeText={setCustomText}
              placeholder={
                activeMode === "Barcode"
                  ? "Enter 8-14 digit barcode (e.g. 3017620422003 for Nutella)..."
                  : isExtractingOcr
                  ? "Extracting ingredients from image..."
                  : "Ingredients will appear here from your photo, or type/paste them..."
              }
              placeholderTextColor="#64748B"
              multiline={activeMode !== "Barcode"}
              numberOfLines={activeMode === "Barcode" ? 1 : 4}
              keyboardType={activeMode === "Barcode" ? "number-pad" : "default"}
              style={{
                backgroundColor: "rgba(0,0,0,0.35)",
                borderColor: "rgba(255,255,255,0.1)",
                borderWidth: 1,
                borderRadius: 14,
                padding: 12,
                color: "#F8FAFC",
                fontSize: 13,
                minHeight: activeMode === "Barcode" ? 48 : 80,
                textAlignVertical: activeMode === "Barcode" ? "center" : "top"
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
                {activeMode === "Barcode" ? "🔍 Lookup Barcode in Food Database" : "🚀 Analyze Scanned Ingredients"}
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
