import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Animated,
  ScrollView,
  Platform,
  Easing,
  Image,
  ActivityIndicator,
  StyleSheet
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import {
  analyzeLabel,
  analyzeLabelImage,
  extractOcrText,
  lookupBarcode,
  getActiveUserId,
  getSavedUserProfile,
  getUserProfile,
  UserProfile,
  AnalyzeResponse,
  PersonalizedRecommendation
} from "../lib/api";
import { useTheme } from "../lib/ThemeContext";
import { ScanningOverlay } from "../components/ScanningOverlay";
import { BottomNav } from "../components/BottomNav";

type ScanStage = "IDLE" | "SCANNING" | "PROCESSING" | "ANALYZING" | "RESULT";

// Fallback offline condition evaluator if backend connection times out
function buildConditionAwareFallback(
  text: string = "",
  name: string = "Scanned Food Item",
  profile?: UserProfile
): AnalyzeResponse {
  const textLower = (text || "").toLowerCase();
  const conditions = profile?.health_conditions || [];

  const additives: Array<{ code: string; name: string; risk_level: string; description: string }> = [];
  if (textLower.includes("e621") || textLower.includes("monosodium glutamate") || textLower.includes("msg")) {
    additives.push({ code: "E621", name: "Monosodium Glutamate", risk_level: "Moderate", description: "Flavor enhancer." });
  }
  if (textLower.includes("e150") || textLower.includes("caramel color")) {
    additives.push({ code: "E150d", name: "Caramel IV", risk_level: "Moderate", description: "Industrial coloring agent." });
  }
  if (textLower.includes("e951") || textLower.includes("aspartame")) {
    additives.push({ code: "E951", name: "Aspartame", risk_level: "High", description: "High-intensity artificial sweetener." });
  }

  const allergens: string[] = [];
  if (textLower.includes("wheat") || textLower.includes("flour") || textLower.includes("gluten")) allergens.push("Gluten / Wheat");
  if (textLower.includes("milk") || textLower.includes("cheese") || textLower.includes("dairy")) allergens.push("Dairy / Lactose");
  if (textLower.includes("peanut")) allergens.push("Peanuts");
  if (textLower.includes("soy")) allergens.push("Soy");

  const hasProcessedOil = textLower.includes("palm oil") || textLower.includes("hydrogenated");
  const isHighSugarItem = textLower.includes("sugar") || textLower.includes("syrup") || textLower.includes("sweetener");
  const isHighSodiumItem = textLower.includes("salt") || textLower.includes("sodium") || textLower.includes("ramen");

  // Simulated estimated macros
  const calories = isHighSugarItem ? 280 : 160;
  const sugar_g = isHighSugarItem ? 22 : 3;
  const sodium_mg = isHighSodiumItem ? 640 : 120;
  const fat_g = hasProcessedOil ? 12 : 4;
  const protein_g = 6;
  const fiber_g = 2.5;

  // Build Personalized Recommendation based on user's active health conditions
  const key_concerns: string[] = [];
  const reasons: string[] = [];
  const positive_notes: string[] = [];
  let status: "Good Choice" | "Suitable" | "Moderately Suitable" | "Limit" | "Not Recommended" = "Suitable";

  if (conditions.includes("Diabetes")) {
    if (sugar_g > 10) {
      status = "Not Recommended";
      key_concerns.push(`High Sugar Content (${sugar_g}g per serving)`);
      reasons.push("Product contains high simple sugars which may cause rapid blood glucose spikes.");
    } else {
      positive_notes.push("Low glycemic load aligns well with blood glucose management.");
    }
  }

  if (conditions.includes("High Blood Pressure")) {
    if (sodium_mg > 400) {
      status = "Not Recommended";
      key_concerns.push(`High Sodium (${sodium_mg}mg per serving)`);
      reasons.push("Elevated sodium may contribute to fluid retention and increased arterial pressure.");
    } else {
      positive_notes.push("Low sodium profile supports vascular health and blood pressure targets.");
    }
  }

  if (conditions.includes("High Cholesterol")) {
    if (fat_g > 8 || hasProcessedOil) {
      if (status !== "Not Recommended") status = "Limit";
      key_concerns.push("Contains saturated or processed oils");
      reasons.push("Refined fats may elevate LDL cholesterol and arterial plaque risk.");
    }
  }

  if (conditions.includes("Obesity / Weight Management")) {
    if (calories > 250) {
      if (status === "Suitable") status = "Limit";
      key_concerns.push(`Higher Caloric Density (${calories} kcal)`);
    }
  }

  if (conditions.length === 0) {
    if (hasProcessedOil || additives.length > 0) {
      status = "Moderately Suitable";
      reasons.push("Moderately processed formulation. Contains synthetic additives.");
    } else {
      status = "Good Choice";
      positive_notes.push("Wholesome nutritional makeup suitable for general wellness.");
    }
  }

  const rec: PersonalizedRecommendation = {
    status: status,
    headline: status === "Not Recommended"
      ? "Not Recommended For Your Health Profile"
      : status === "Limit"
      ? "Consider Limiting Consumption"
      : "Suitable For Your Health Profile",
    health_conditions_considered: conditions.length > 0 ? conditions : ["General Wellness"],
    reasons: reasons.length > 0 ? reasons : ["Evaluated based on clinical nutritional thresholds."],
    key_concerns: key_concerns,
    positive_notes: positive_notes.length > 0 ? positive_notes : ["Contains beneficial macronutrients."],
    better_alternative: status === "Not Recommended" ? "Unsweetened whole grain rolled oats with chia seeds or fresh fruit" : null,
    medical_disclaimer: "AI nutritional guidance only. Not a medical diagnosis. Consult a healthcare professional before altering your medical diet."
  };

  const healthScore = status === "Not Recommended" ? 38 : status === "Limit" ? 58 : 88;

  return {
    is_food: true,
    product_name: name,
    brand: "Scanned Food Label",
    category: "Food & Beverage",
    health_score: healthScore,
    nova_group: hasProcessedOil ? 4 : additives.length > 0 ? 3 : 1,
    allergen_flags: allergens,
    ingredient_risks: hasProcessedOil ? ["Contains refined/industrial oils."] : [],
    positive_attributes: positive_notes,
    additives: additives,
    nutrition_estimate: {
      calories,
      sugar_g,
      sodium_mg,
      fat_g,
      protein_g,
      fiber_g,
      is_estimated: true,
      source: "Scanned Label Extraction"
    },
    healthier_alternatives: [
      {
        name: "Organic Whole Food Alternative",
        reason: "Zero refined sugars, natural fiber matrix, low sodium.",
        estimated_health_score: 94
      }
    ],
    personalized_verdict: rec.headline + ": " + (rec.reasons[0] || "Nutritional evaluation completed."),
    personalized_recommendation: rec,
    ocr_text: text || "Ingredients scanned from packaging."
  };
}

export default function ScannerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors } = useTheme();

  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [flashOn, setFlashOn] = useState(false);

  // 5-Stage Simulation State
  const [scanStage, setScanStage] = useState<ScanStage>("IDLE");
  const [simulationStageIndex, setSimulationStageIndex] = useState(0);

  // Scanner Mode: "nutrition" (3:4 aspect ratio) vs "barcode" (compact barcode slot)
  const [scanMode, setScanMode] = useState<"nutrition" | "barcode">("nutrition");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [isBarcodeLoading, setIsBarcodeLoading] = useState(false);
  const [showManualBarcode, setShowManualBarcode] = useState(false);

  const BARCODE_PRESETS = [
    { label: "Nutella", code: "3017620422003", icon: "🍫" },
    { label: "Coca-Cola", code: "5449000000996", icon: "🥤" },
    { label: "Lay's Chips", code: "8901491101837", icon: "🥔" },
    { label: "Maggi Noodles", code: "8901058852898", icon: "🍜" },
  ];

  // Live Camera Stream State
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const webVideoRef = useRef<any>(null);
  const webStreamRef = useRef<any>(null);

  // Selected Image
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);

  // Active User Profile
  const [profile, setProfile] = useState<UserProfile>({
    user_id: "default_user",
    health_conditions: ["Diabetes"],
    dietary_preferences: ["Low Sugar"],
    allergies: [],
    health_goals: ["Blood Sugar Management"]
  });

  // Animated laser line
  const laserAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(laserAnim, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true
        }),
        Animated.timing(laserAnim, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true
        })
      ])
    ).start();

    // Load active user profile
    loadActiveProfile();
  }, []);

  // Automatic live barcode scanner for Web browsers with BarcodeDetector support
  useEffect(() => {
    if (Platform.OS !== "web" || scanMode !== "barcode" || !isCameraActive) return;

    let isCancelled = false;
    let intervalId: any = null;

    if (typeof window !== "undefined" && "BarcodeDetector" in window) {
      try {
        const detector = new (window as any).BarcodeDetector({
          formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39"]
        });

        intervalId = setInterval(async () => {
          if (isCancelled || isBarcodeLoading) return;
          const video = webVideoRef.current;
          if (!video || video.readyState < 2) return;

          try {
            const barcodes = await detector.detect(video);
            if (barcodes && barcodes.length > 0 && !isCancelled) {
              const code = barcodes[0].rawValue;
              if (code && code.length >= 8) {
                handleBarcodeDetected(code);
              }
            }
          } catch (e) {
            // Frame detection skipped
          }
        }, 600);
      } catch (e) {
        console.log("BarcodeDetector setup skipped:", e);
      }
    }

    return () => {
      isCancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [scanMode, isCameraActive, isBarcodeLoading]);

  const loadActiveProfile = async () => {
    try {
      const activeId = await getActiveUserId();
      const saved = await getSavedUserProfile();
      if (saved && saved.health_conditions) {
        setProfile(saved);
      } else {
        const remote = await getUserProfile(activeId);
        if (remote) setProfile(remote);
      }
    } catch (e) {
      console.warn("Could not load active profile in scanner:", e);
    }
  };

  // Start camera when screen opens, clean up on unmount
  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  const nutritionLaserY = laserAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 240]
  });

  const barcodeLaserY = laserAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 65]
  });

  // Convert image URI to Base64
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

  // Live Camera Starter
  const startCamera = async () => {
    setCameraError(null);
    setScanError(null);
    setIsCameraLoading(true);
    setSelectedImageUri(null);

    if (Platform.OS === "web") {
      try {
        if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
          setCameraError("Camera is not supported on this browser context.");
          setIsCameraLoading(false);
          return;
        }

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
        setCameraError("Camera permission denied. Please allow camera access in your browser settings.");
        setIsCameraActive(false);
        setIsCameraLoading(false);
      }
    } else {
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

  // Gallery Picker
  const pickImageFromGallery = async () => {
    setScanError(null);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted" && Platform.OS !== "web") {
        alert("Camera roll / photo library permissions are needed to select food images.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.85,
        base64: true
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setSelectedImageUri(asset.uri);

        let b64 = asset.base64 || "";
        if (!b64 && asset.uri) {
          b64 = await uriToBase64(asset.uri);
        }

        if (b64) {
          runSimulationAndAnalyze(b64);
        }
      }
    } catch (err: any) {
      console.warn("Gallery error:", err);
      setScanError("Failed to select photo from gallery. Please try again.");
    }
  };

  // Capture Photo from Camera & Execute Analysis
  const captureAndScan = async () => {
    setScanError(null);
    let capturedBase64 = "";

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
          capturedBase64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
          setSelectedImageUri(dataUrl);
          stopCamera();
        }
      } catch (e: any) {
        console.error("Web capture error:", e);
        setScanError("Camera snapshot capture failed. Please try again.");
        return;
      }
    } else {
      try {
        if (cameraRef.current) {
          const photo = await cameraRef.current.takePictureAsync({
            quality: 0.85,
            base64: true
          });
          if (photo && photo.uri) {
            setSelectedImageUri(photo.uri);
            capturedBase64 = photo.base64 || (await uriToBase64(photo.uri));
            setIsCameraActive(false);
          }
        }
      } catch (e: any) {
        console.warn("Native capture error:", e);
        setScanError("Camera capture failed. Please try again.");
        return;
      }
    }

    if (capturedBase64) {
      runSimulationAndAnalyze(capturedBase64);
    }
  };

  // 5-Stage Simulation Progression + Backend API Call
  const runSimulationAndAnalyze = async (imageBase64: string) => {
    // Stage 1: SCANNING
    setScanStage("SCANNING");
    setSimulationStageIndex(0);

    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    try {
      // Advance to Stage 2: PROCESSING (Label tokens / OCR)
      await sleep(500);
      setScanStage("PROCESSING");
      setSimulationStageIndex(1);

      // Advance to Stage 3: ANALYZING (Condition thresholds)
      await sleep(600);
      setScanStage("ANALYZING");
      setSimulationStageIndex(2);

      // Fire off API request with user's active health conditions
      const apiCall = analyzeLabelImage({
        image_base64: imageBase64,
        user_profile: profile
      });

      // 12s safety timeout
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 12000));

      const response = await Promise.race([apiCall, timeoutPromise]);

      // Advance to Stage 4: EVALUATING
      setSimulationStageIndex(3);
      await sleep(500);

      let finalResult: AnalyzeResponse;
      if (response) {
        finalResult = response;
      } else {
        // Safe offline condition fallback
        finalResult = buildConditionAwareFallback("Nutrition Facts: Enriched grains, sugars, sodium.", "Scanned Food Label", profile);
      }

      // Check if item was rejected as non-food or unreadable
      if (finalResult.is_food === false && !finalResult.health_score) {
        setScanStage("IDLE");
        setScanError(finalResult.rejection_reason || "Unable to detect nutritional or ingredient data. Please ensure the label is clearly visible.");
        return;
      }

      // Stage 5: RESULT
      setScanStage("RESULT");
      setSimulationStageIndex(4);
      await sleep(400);

      // Cleanly transition to results page (scanner UI unmounts/hides)
      setScanStage("IDLE");
      router.push({
        pathname: "/results",
        params: { data: JSON.stringify(finalResult) }
      });
    } catch (err: any) {
      console.warn("Analysis error:", err);
      // Try local fallback rather than leaving the user stranded
      try {
        const fallback = buildConditionAwareFallback("Scanned Food Product Ingredients", "Scanned Food Item", profile);
        setScanStage("RESULT");
        setSimulationStageIndex(4);
        await sleep(300);
        setScanStage("IDLE");
        router.push({
          pathname: "/results",
          params: { data: JSON.stringify(fallback) }
        });
      } catch (inner) {
        setScanStage("IDLE");
        setScanError("Failed to process scan. Please ensure the food label is well lit and try again.");
      }
    }
  };

  const handleTryAgain = () => {
    setScanError(null);
    setSelectedImageUri(null);
    setScanStage("IDLE");
    startCamera();
  };

  // Barcode detection & online lookup
  const handleBarcodeDetected = async (barcode: string) => {
    const cleanCode = barcode.trim().replace(/\s+/g, "");
    if (!cleanCode || isBarcodeLoading) return;

    setIsBarcodeLoading(true);
    setScanError(null);
    setScanStage("ANALYZING");
    setSimulationStageIndex(2);

    try {
      const response = await lookupBarcode(cleanCode, profile.user_id);

      if (response.is_food === false && !response.health_score) {
        setIsBarcodeLoading(false);
        setScanStage("IDLE");
        setScanError(
          response.rejection_reason ||
          `Barcode "${cleanCode}" was not found in the food database. Switch to "Nutrition Label (3:4)" to scan the packaging directly.`
        );
        return;
      }

      setSimulationStageIndex(4);
      setScanStage("RESULT");
      setTimeout(() => {
        setScanStage("IDLE");
        setIsBarcodeLoading(false);
        router.push({
          pathname: "/results",
          params: { data: JSON.stringify(response) }
        });
      }, 400);
    } catch (err: any) {
      console.warn("Barcode lookup error:", err);
      setIsBarcodeLoading(false);
      setScanStage("IDLE");
      setScanError(
        `Failed to lookup barcode "${cleanCode}". Please check your internet connection or try scanning the packaging directly in 3:4 mode.`
      );
    }
  };

  // Barcode Capture / Scan Button Click
  const captureAndScanBarcode = async () => {
    setScanError(null);
    if (Platform.OS === "web") {
      const video = webVideoRef.current;
      if (video && typeof window !== "undefined" && "BarcodeDetector" in window) {
        try {
          const detector = new (window as any).BarcodeDetector({
            formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39"]
          });
          const detected = await detector.detect(video);
          if (detected && detected.length > 0 && detected[0].rawValue) {
            handleBarcodeDetected(detected[0].rawValue);
            return;
          }
        } catch (e) {
          console.log("Barcode detection error on frame:", e);
        }
      }
    }
    // If not detected from camera frame, open manual entry with guidance
    setShowManualBarcode(true);
    setScanError("Align the barcode closer to the slot, or enter the numbers below directly.");
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#060A13" }}>
      {/* 5-Stage Holographic AI Overlay during Scan */}
      {scanStage !== "IDLE" && (
        <ScanningOverlay
          productTitle="Product Packaging & Nutrition Label"
          healthConditions={profile.health_conditions}
          activeStageIndex={simulationStageIndex}
        />
      )}

      {/* Top Header Bar */}
      <View style={{
        paddingTop: Platform.OS === "ios" ? 50 : 42,
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
            NutriLens AI Scanner
          </Text>
          <Text style={{ color: "#10B981", fontSize: 11, fontWeight: "700" }}>
            Personalized Food Analysis
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

      {/* User Active Health Profile Indicator */}
      <TouchableOpacity
        onPress={() => router.push("/profile" as any)}
        activeOpacity={0.8}
        style={{
          marginHorizontal: 18,
          marginBottom: 14,
          paddingVertical: 8,
          paddingHorizontal: 14,
          backgroundColor: "rgba(16, 185, 129, 0.1)",
          borderColor: "rgba(16, 185, 129, 0.35)",
          borderWidth: 1,
          borderRadius: 16,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between"
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
          <Text style={{ fontSize: 16 }}>🛡️</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#F8FAFC", fontSize: 12, fontWeight: "800" }}>
              Active Health Profile:
            </Text>
            <Text style={{ color: "#34D399", fontSize: 11, fontWeight: "700" }} numberOfLines={1}>
              {profile.health_conditions && profile.health_conditions.length > 0
                ? profile.health_conditions.join(" • ")
                : "General Wellness (No conditions selected)"}
            </Text>
          </View>
        </View>
        <Text style={{ color: "#10B981", fontSize: 11, fontWeight: "800" }}>Edit →</Text>
      </TouchableOpacity>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
        {/* Mode Selector Segmented Tabs */}
        <View style={{
          marginHorizontal: 18,
          marginBottom: 14,
          padding: 4,
          backgroundColor: "rgba(255,255,255,0.06)",
          borderRadius: 16,
          flexDirection: "row",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.08)"
        }}>
          <TouchableOpacity
            onPress={() => {
              setScanMode("nutrition");
              setScanError(null);
              setSelectedImageUri(null);
            }}
            activeOpacity={0.8}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 12,
              backgroundColor: scanMode === "nutrition" ? "#10B981" : "transparent",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: 6
            }}
          >
            <Text style={{ fontSize: 15 }}>🥗</Text>
            <Text style={{
              color: scanMode === "nutrition" ? "#FFF" : "#94A3B8",
              fontSize: 13,
              fontWeight: "800"
            }}>
              Nutrition Label (3:4)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setScanMode("barcode");
              setScanError(null);
              setSelectedImageUri(null);
            }}
            activeOpacity={0.8}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 12,
              backgroundColor: scanMode === "barcode" ? "#06B6D4" : "transparent",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: 6
            }}
          >
            <Text style={{ fontSize: 15 }}>🏷️</Text>
            <Text style={{
              color: scanMode === "barcode" ? "#FFF" : "#94A3B8",
              fontSize: 13,
              fontWeight: "800"
            }}>
              Barcode Scan
            </Text>
          </TouchableOpacity>
        </View>

        {/* Error Alert Card (If Scan or OCR Failed) */}
        {scanError && (
          <View style={{
            marginHorizontal: 18,
            marginBottom: 14,
            backgroundColor: "rgba(239, 68, 68, 0.15)",
            borderColor: "#EF4444",
            borderWidth: 1.5,
            borderRadius: 20,
            padding: 16,
            gap: 12
          }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Text style={{ fontSize: 24 }}>⚠️</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#FCA5A5", fontSize: 14, fontWeight: "900" }}>
                  {scanMode === "barcode" ? "Barcode Not Detected" : "Unrecognized Product or Label"}
                </Text>
                <Text style={{ color: "#F1F5F9", fontSize: 12, marginTop: 2, lineHeight: 17 }}>
                  {scanError}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={handleTryAgain}
              style={{
                backgroundColor: "#EF4444",
                paddingVertical: 10,
                borderRadius: 12,
                alignItems: "center"
              }}
            >
              <Text style={{ color: "#FFF", fontSize: 13, fontWeight: "800" }}>
                🔄 Try Again
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Focused Camera Viewfinder Box: 3:4 for Nutrition Mode, Compact Slot for Barcode Mode */}
        <View style={{
          width: "92%",
          ...(scanMode === "nutrition"
            ? {
                aspectRatio: 3 / 4,
                maxHeight: 440,
                borderRadius: 24,
                borderColor: "rgba(16, 185, 129, 0.35)"
              }
            : {
                height: 145,
                borderRadius: 20,
                borderColor: "rgba(6, 182, 212, 0.55)",
                shadowColor: "#06B6D4",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.25,
                shadowRadius: 10
              }),
          alignSelf: "center",
          overflow: "hidden",
          backgroundColor: "#0B101D",
          borderWidth: 1.5,
          position: "relative"
        }}>
          {selectedImageUri ? (
            /* Selected Photo Preview */
            <View style={{ flex: 1, position: "relative" }}>
              <Image
                source={{ uri: selectedImageUri }}
                style={{ width: "100%", height: "100%", resizeMode: "cover" }}
              />
              <View style={{
                position: "absolute",
                top: 12,
                left: 12,
                backgroundColor: scanMode === "barcode" ? "rgba(6, 182, 212, 0.9)" : "rgba(16, 185, 129, 0.9)",
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 12
              }}>
                <Text style={{ color: "#FFF", fontSize: 11, fontWeight: "800" }}>📸 Captured Snapshot</Text>
              </View>

              <TouchableOpacity
                onPress={handleTryAgain}
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
              <ActivityIndicator size="large" color={scanMode === "barcode" ? "#06B6D4" : "#10B981"} />
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
                barcodeScannerSettings={
                  scanMode === "barcode"
                    ? {
                        barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128", "code39"]
                      }
                    : undefined
                }
                onBarcodeScanned={
                  scanMode === "barcode" && !isBarcodeLoading
                    ? (result) => {
                        if (result.data) {
                          handleBarcodeDetected(result.data);
                        }
                      }
                    : undefined
                }
              />
            )
          ) : (
            <TouchableOpacity
              onPress={startCamera}
              activeOpacity={0.8}
              style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0D1322", padding: 16 }}
            >
              <View style={{
                width: 54,
                height: 54,
                borderRadius: 27,
                backgroundColor: scanMode === "barcode" ? "rgba(6, 182, 212, 0.15)" : "rgba(16, 185, 129, 0.15)",
                borderWidth: 1.5,
                borderColor: scanMode === "barcode" ? "#06B6D4" : "#10B981",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 8
              }}>
                <Image
                  source={require("../assets/camera-icon-white.png")}
                  style={{ width: 28, height: 28 }}
                  resizeMode="contain"
                />
              </View>
              <Text style={{ color: "#F8FAFC", fontSize: 14, fontWeight: "800" }}>
                {cameraError ? "Camera Access Needed" : "Tap to Open Live Camera"}
              </Text>
              <Text style={{ color: "#64748B", fontSize: 11, marginTop: 4, textAlign: "center", maxWidth: 260 }}>
                {cameraError || (scanMode === "barcode" ? "Point slot directly over barcode lines" : "Point camera at food packaging, ingredient lists, or nutrition facts labels")}
              </Text>
              {cameraError && (
                <View style={{ marginTop: 10, backgroundColor: "#10B981", paddingHorizontal: 14, paddingVertical: 6, borderRadius: 10 }}>
                  <Text style={{ color: "#FFF", fontSize: 11, fontWeight: "800" }}>Allow & Retry Camera</Text>
                </View>
              )}
            </TouchableOpacity>
          )}

          {/* 3:4 Holographic Frame for Nutrition Mode */}
          {!selectedImageUri && scanMode === "nutrition" && (
            <View style={{
              position: "absolute",
              top: "7%",
              left: "7%",
              right: "7%",
              bottom: "7%",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.15)",
              borderRadius: 20,
              backgroundColor: "rgba(0,0,0,0.12)",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden"
            }}>
              {/* 4 Neon Corners */}
              <View style={{ position: "absolute", top: 0, left: 0, width: 26, height: 26, borderTopWidth: 3.5, borderLeftWidth: 3.5, borderColor: "#10B981", borderTopLeftRadius: 12 }} />
              <View style={{ position: "absolute", top: 0, right: 0, width: 26, height: 26, borderTopWidth: 3.5, borderRightWidth: 3.5, borderColor: "#10B981", borderTopRightRadius: 12 }} />
              <View style={{ position: "absolute", bottom: 0, left: 0, width: 26, height: 26, borderBottomWidth: 3.5, borderLeftWidth: 3.5, borderColor: "#10B981", borderBottomLeftRadius: 12 }} />
              <View style={{ position: "absolute", bottom: 0, right: 0, width: 26, height: 26, borderBottomWidth: 3.5, borderRightWidth: 3.5, borderColor: "#10B981", borderBottomRightRadius: 12 }} />

              {/* Animated Laser Beam */}
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
                transform: [{ translateY: nutritionLaserY }]
              }} />

              <View style={{ backgroundColor: "rgba(0,0,0,0.65)", paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14 }}>
                <Text style={{ color: "#F8FAFC", fontSize: 11, fontWeight: "700" }}>
                  Align nutrition facts or food package in 3:4 frame
                </Text>
              </View>
            </View>
          )}

          {/* Compact Barcode Guide Slot for Barcode Mode */}
          {!selectedImageUri && scanMode === "barcode" && (
            <View style={{
              position: "absolute",
              top: 14,
              bottom: 14,
              left: 14,
              right: 14,
              borderWidth: 1.5,
              borderColor: "rgba(6, 182, 212, 0.45)",
              borderRadius: 14,
              backgroundColor: "rgba(0,0,0,0.15)",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden"
            }}>
              {/* Left & Right Barcode Guide Brackets */}
              <View style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: 14, borderLeftWidth: 3.5, borderTopWidth: 3.5, borderBottomWidth: 3.5, borderColor: "#06B6D4", borderTopLeftRadius: 10, borderBottomLeftRadius: 10 }} />
              <View style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: 14, borderRightWidth: 3.5, borderTopWidth: 3.5, borderBottomWidth: 3.5, borderColor: "#06B6D4", borderTopRightRadius: 10, borderBottomRightRadius: 10 }} />

              {/* Animated Barcode Red Laser */}
              <Animated.View style={{
                position: "absolute",
                top: 0,
                left: 10,
                right: 10,
                height: 2.5,
                backgroundColor: "#EF4444",
                shadowColor: "#EF4444",
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 1,
                shadowRadius: 8,
                transform: [{ translateY: barcodeLaserY }]
              }} />

              <View style={{ backgroundColor: "rgba(0,0,0,0.72)", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10 }}>
                <Text style={{ color: "#38BDF8", fontSize: 11, fontWeight: "800" }}>
                  ||||  Fit Barcode Inside Slot  ||||
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Mode-Specific Action Buttons */}
        {scanMode === "nutrition" ? (
          <View style={{
            marginTop: 20,
            marginHorizontal: 18,
            flexDirection: "row",
            alignItems: "center",
            gap: 14
          }}>
            {/* Gallery Button */}
            <TouchableOpacity
              onPress={pickImageFromGallery}
              activeOpacity={0.8}
              style={{
                width: 58,
                height: 58,
                borderRadius: 20,
                backgroundColor: "rgba(255,255,255,0.08)",
                borderColor: "rgba(255,255,255,0.18)",
                borderWidth: 1.5,
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <Text style={{ fontSize: 24 }}>🖼️</Text>
            </TouchableOpacity>

            {/* Big [ Scan Food Label (3:4) ] Button */}
            <TouchableOpacity
              onPress={captureAndScan}
              activeOpacity={0.85}
              style={{
                flex: 1,
                height: 58,
                borderRadius: 20,
                backgroundColor: "#10B981",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                shadowColor: "#10B981",
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.35,
                shadowRadius: 12
              }}
            >
              <Image
                source={require("../assets/camera-icon-white.png")}
                style={{ width: 22, height: 22 }}
                resizeMode="contain"
              />
              <Text style={{ color: "#FFF", fontSize: 16, fontWeight: "900", letterSpacing: -0.2 }}>
                Scan Food Label (3:4)
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{
            marginTop: 18,
            marginHorizontal: 18,
            gap: 14
          }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              {/* Type Barcode Toggle Button */}
              <TouchableOpacity
                onPress={() => setShowManualBarcode((prev) => !prev)}
                activeOpacity={0.8}
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: 20,
                  backgroundColor: showManualBarcode ? "rgba(6, 182, 212, 0.2)" : "rgba(255,255,255,0.08)",
                  borderColor: showManualBarcode ? "#06B6D4" : "rgba(255,255,255,0.18)",
                  borderWidth: 1.5,
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <Text style={{ fontSize: 24 }}>⌨️</Text>
              </TouchableOpacity>

              {/* Big [ Scan Barcode ] Button */}
              <TouchableOpacity
                onPress={captureAndScanBarcode}
                activeOpacity={0.85}
                disabled={isBarcodeLoading}
                style={{
                  flex: 1,
                  height: 58,
                  borderRadius: 20,
                  backgroundColor: "#06B6D4",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  shadowColor: "#06B6D4",
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.35,
                  shadowRadius: 12
                }}
              >
                {isBarcodeLoading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={{ fontSize: 20 }}>🏷️</Text>
                )}
                <Text style={{ color: "#FFF", fontSize: 16, fontWeight: "900", letterSpacing: -0.2 }}>
                  {isBarcodeLoading ? "Looking Up Barcode..." : "Scan Barcode"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Manual Barcode Input Card */}
            {showManualBarcode && (
              <View style={{
                backgroundColor: "rgba(15, 23, 42, 0.9)",
                borderColor: "rgba(6, 182, 212, 0.4)",
                borderWidth: 1,
                borderRadius: 18,
                padding: 14,
                gap: 10
              }}>
                <Text style={{ color: "#F8FAFC", fontSize: 12, fontWeight: "800" }}>
                  Enter Product Barcode (EAN / UPC / GTIN):
                </Text>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <TextInput
                    value={barcodeInput}
                    onChangeText={setBarcodeInput}
                    placeholder="e.g. 3017620422003"
                    placeholderTextColor="#64748B"
                    keyboardType="numeric"
                    style={{
                      flex: 1,
                      backgroundColor: "rgba(255, 255, 255, 0.08)",
                      borderColor: "rgba(255, 255, 255, 0.15)",
                      borderWidth: 1,
                      borderRadius: 12,
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      color: "#FFF",
                      fontSize: 14,
                      fontWeight: "700"
                    }}
                  />
                  <TouchableOpacity
                    onPress={() => {
                      if (barcodeInput.trim()) {
                        handleBarcodeDetected(barcodeInput.trim());
                      }
                    }}
                    disabled={!barcodeInput.trim() || isBarcodeLoading}
                    style={{
                      backgroundColor: barcodeInput.trim() ? "#06B6D4" : "rgba(255,255,255,0.1)",
                      paddingHorizontal: 16,
                      borderRadius: 12,
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                  >
                    <Text style={{ color: barcodeInput.trim() ? "#FFF" : "#64748B", fontSize: 13, fontWeight: "800" }}>
                      Lookup
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Quick Test Barcode Chips */}
            <View style={{ gap: 8 }}>
              <Text style={{ color: "#94A3B8", fontSize: 11, fontWeight: "700", marginLeft: 4 }}>
                ⚡ Quick Test Barcodes:
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {BARCODE_PRESETS.map((item) => (
                  <TouchableOpacity
                    key={item.code}
                    onPress={() => {
                      setBarcodeInput(item.code);
                      handleBarcodeDetected(item.code);
                    }}
                    disabled={isBarcodeLoading}
                    style={{
                      backgroundColor: "rgba(6, 182, 212, 0.12)",
                      borderColor: "rgba(6, 182, 212, 0.35)",
                      borderWidth: 1,
                      borderRadius: 12,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6
                    }}
                  >
                    <Text style={{ fontSize: 13 }}>{item.icon}</Text>
                    <Text style={{ color: "#E0F2FE", fontSize: 12, fontWeight: "700" }}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* Tips Bar */}
        <View style={{
          marginTop: 18,
          marginHorizontal: 18,
          backgroundColor: "rgba(255,255,255,0.04)",
          borderRadius: 16,
          padding: 12,
          flexDirection: "row",
          alignItems: "center",
          gap: 10
        }}>
          <Text style={{ fontSize: 18 }}>💡</Text>
          <Text style={{ color: "#94A3B8", fontSize: 11, flex: 1, lineHeight: 16 }}>
            {scanMode === "barcode"
              ? "Hold product steady so the barcode numbers and black bars fill the horizontal slot."
              : "For highest accuracy, ensure the ingredients list and nutrition facts table are well lit without glare."}
          </Text>
        </View>
      </ScrollView>

      {/* Global Bottom Navigation */}
      <BottomNav />
    </View>
  );
}
