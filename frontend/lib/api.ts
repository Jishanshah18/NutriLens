export interface UserProfile {
  user_id?: string;
  email?: string;
  full_name?: string;
  age?: number | null;
  health_conditions: string[];
  dietary_preferences: string[];
  allergies: string[];
  health_goals: string[];
}

export interface AdditiveDetail {
  code: string;
  name: string;
  risk_level: string;
  description: string;
}

export interface NutritionBreakdown {
  calories?: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
  sugar_g?: number | null;
  sodium_mg?: number | null;
  fiber_g?: number | null;
  is_estimated?: boolean;
  source?: string;
  serving_size?: string;
}

export interface AlternativeProduct {
  name: string;
  reason: string;
  estimated_health_score: number;
}

export interface PersonalizedRecommendation {
  status: "Good Choice" | "Suitable" | "Moderately Suitable" | "Limit" | "Not Recommended" | string;
  headline: string;
  health_conditions_considered: string[];
  reasons: string[];
  key_concerns: string[];
  positive_notes: string[];
  better_alternative?: string | null;
  data_completeness?: "High" | "Partial" | "Low" | string;
  missing_nutrients?: string[];
  data_sources?: string[];
  last_verified?: string;
  allergens_safety_note?: string;
  medical_disclaimer: string;
}

export interface AnalyzeRequest {
  ocr_text: string;
  user_profile: UserProfile;
}

export interface AnalyzeImageRequest {
  image_base64: string;
  user_profile: UserProfile;
}

export interface PreferenceAudit {
  allergen_conflicts: string[];
  allergen_safe_notes: string[];
  dietary_matches: string[];
  dietary_conflicts: string[];
  goal_alignments: string[];
  goal_warnings: string[];
  is_safe_for_user: boolean;
}

export interface AnalyzeResponse {
  is_food?: boolean;
  rejection_reason?: string;
  product_name?: string;
  brand?: string | null;
  category?: string | null;
  image_url?: string | null;
  health_score: number;
  nova_group?: number;
  allergen_flags: string[];
  ingredient_risks: string[];
  positive_attributes?: string[];
  additives?: AdditiveDetail[];
  nutrition_estimate?: NutritionBreakdown;
  healthier_alternatives?: AlternativeProduct[];
  personalized_verdict: string;
  personalized_recommendation?: PersonalizedRecommendation | null;
  data_completeness?: "High" | "Partial" | "Low" | string;
  missing_nutrients?: string[];
  data_sources?: string[];
  last_verified?: string;
  allergens_safety_note?: string;
  ocr_text?: string;
  barcode?: string;
  preference_audit?: PreferenceAudit;
}

export interface ScanHistoryItem {
  id: string;
  product_name: string;
  scanned_at: string;
  health_score: number;
  allergen_flags: string[];
  verdict_summary: string;
  ocr_text: string;
}

export interface BadgeItem {
  id: string;
  name: string;
  icon: string;
  description: string;
  unlocked: boolean;
  unlocked_at?: string;
}

export interface UserStatsResponse {
  user_id: string;
  current_streak: number;
  scans_today: number;
  total_scans: number;
  xp: number;
  level: number;
  badges: BadgeItem[];
}

export interface QuizQuestion {
  id: string;
  type: string;
  title: string;
  question: string;
  options?: string[];
  correct_answer: string;
  explanation: string;
  xp_reward: number;
}

export interface QuizSubmitResponse {
  is_correct: boolean;
  explanation: string;
  xp_earned: number;
  total_xp: number;
  new_streak: number;
}
export const DEFAULT_USER_PROFILE: UserProfile = {
  user_id: "",
  email: "",
  full_name: "",
  age: null,
  health_conditions: [],
  dietary_preferences: [],
  allergies: [],
  health_goals: [],
};

export interface UserAuthResponse {
  success: boolean;
  user_id: string;
  email: string;
  full_name: string;
  token: string;
  message: string;
  profile: UserProfile;
}

export interface UserAccountInfo {
  id: string;
  email: string;
  full_name: string;
  health_conditions: string[];
}

export const getActiveUserId = (): string => {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage.getItem("nutrilens_active_user_id") || "";
  }
  return "";
};

export const setActiveUserId = (userId: string): void => {
  if (typeof window !== "undefined" && window.localStorage) {
    if (userId) {
      window.localStorage.setItem("nutrilens_active_user_id", userId);
    } else {
      window.localStorage.removeItem("nutrilens_active_user_id");
    }
  }
};

export const getSavedUserProfile = (userId?: string): UserProfile | null => {
  if (typeof window !== "undefined" && window.localStorage) {
    const targetId = userId || getActiveUserId();
    if (!targetId) return null;
    const raw = window.localStorage.getItem(`nutrilens_profile_${targetId}`);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch (e) {}
    }
  }
  return null;
};

export const setSavedUserProfile = (profile: UserProfile): void => {
  if (typeof window !== "undefined" && window.localStorage) {
    const uid = profile.user_id;
    if (uid) {
      window.localStorage.setItem(`nutrilens_profile_${uid}`, JSON.stringify(profile));
    }
  }
};

export const getAuthToken = (): string | null => {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage.getItem("nutrilens_auth_token");
  }
  return null;
};

export const setAuthToken = (token: string): void => {
  if (typeof window !== "undefined" && window.localStorage) {
    window.localStorage.setItem("nutrilens_auth_token", token);
  }
};

export const clearAuthSession = (): void => {
  if (typeof window !== "undefined" && window.localStorage) {
    window.localStorage.removeItem("nutrilens_auth_token");
    window.localStorage.removeItem("nutrilens_active_user_id");
  }
};

export const DEFAULT_USER_STATS: UserStatsResponse = {
  user_id: "default_user",
  current_streak: 14,
  scans_today: 3,
  total_scans: 28,
  xp: 450,
  level: 3,
  badges: [
    { id: "b1", name: "Label Reader", icon: "🔍", description: "Scanned first food item", unlocked: true },
    { id: "b2", name: "Sugar Detective", icon: "🛡️", description: "Flagged high sugar product", unlocked: true },
    { id: "b3", name: "Streak Master", icon: "🔥", description: "Maintained 7 day streak", unlocked: true },
    { id: "b4", name: "Additive Hunter", icon: "⚡", description: "Found harmful food additives", unlocked: false }
  ]
};

const FALLBACK_QUIZZES: QuizQuestion[] = [
  {
    id: "q1",
    type: "myth_fact",
    title: "Sugar & Sweeteners",
    question: "Is 'Organic Cane Sugar' processed differently and healthier for your liver than standard refined white sugar?",
    correct_answer: "Fact: No, both are sucrose and metabolize identically in the liver.",
    explanation: "Even though organic sugar avoids synthetic pesticides during farming, human physiology digests and metabolizes sucrose identically.",
    xp_reward: 20
  },
  {
    id: "q2",
    type: "multiple_choice",
    title: "Ultra-Processed Foods",
    question: "Which of the following ingredient markers strongly indicates an ultra-processed (NOVA 4) product?",
    options: [
      "High-fructose corn syrup & emulsifiers",
      "Extra virgin olive oil",
      "Fermented yeast & salt",
      "Whole rolled oats"
    ],
    correct_answer: "High-fructose corn syrup & emulsifiers",
    explanation: "Industrial emulsifiers, hydrogenated oils, and chemically modified starches/sugars are hallmark indicators of NOVA 4 ultra-processed foods.",
    xp_reward: 25
  }
];

export const getApiBaseUrl = (): string => {
  // If EXPO_PUBLIC_API_URL is configured with a cloud URL (e.g. Render), prioritize it
  if (process.env.EXPO_PUBLIC_API_URL && !process.env.EXPO_PUBLIC_API_URL.includes("localhost") && !process.env.EXPO_PUBLIC_API_URL.includes("127.0.0.1")) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  if (typeof window !== "undefined" && window.location?.hostname) {
    const host = window.location.hostname;
    // When opened in browser on localhost or local network, connect directly to that host on port 8000
    if (host === "localhost" || host === "127.0.0.1" || host.startsWith("192.168.") || host.startsWith("10.")) {
      return `http://${host}:8000/api`;
    }
  }
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  return "https://nutrilens-jfiv.onrender.com/api";
};

export const API_BASE_URL = getApiBaseUrl();

export interface BackendHealthResponse {
  status: string;
  service: string;
  database?: string;
  database_connected?: boolean;
  timestamp?: string;
  url: string;
}

export const checkBackendHealth = async (): Promise<BackendHealthResponse> => {
  const url = getApiBaseUrl();
  const response = await fetch(`${url}/health`, { method: "GET" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  return { ...data, url };
};

export const registerUser = async (
  email: string,
  password: string,
  fullName: string,
  age: number | null = null,
  healthConditions: string[] = [],
  dietaryPreferences: string[] = [],
  allergies: string[] = [],
  healthGoals: string[] = []
): Promise<UserAuthResponse> => {
  const url = getApiBaseUrl();
  const response = await fetch(`${url}/user/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password,
      full_name: fullName,
      age,
      health_conditions: healthConditions,
      dietary_preferences: dietaryPreferences,
      allergies: allergies,
      health_goals: healthGoals
    })
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: "Registration failed" }));
    throw new Error(err.detail || "Registration failed");
  }
  const data: UserAuthResponse = await response.json();
  setActiveUserId(data.user_id);
  setSavedUserProfile(data.profile);
  if (data.token) {
    setAuthToken(data.token);
  }
  return data;
};

export const loginUser = async (email: string, password: string): Promise<UserAuthResponse> => {
  const url = getApiBaseUrl();
  const response = await fetch(`${url}/user/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: "Login failed" }));
    throw new Error(err.detail || "Invalid email or password");
  }
  const data: UserAuthResponse = await response.json();
  setActiveUserId(data.user_id);
  setSavedUserProfile(data.profile);
  if (data.token) {
    setAuthToken(data.token);
  }
  return data;
};

export const logoutUser = async (): Promise<void> => {
  try {
    const url = getApiBaseUrl();
    await fetch(`${url}/user/logout`, { method: "POST" });
  } catch (e) {
    // Ignore network error on logout
  } finally {
    clearAuthSession();
  }
};

export const updateBackendUserPassword = async (userId: string, newPassword: string): Promise<void> => {
  const url = getApiBaseUrl();
  const response = await fetch(`${url}/user/password`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, new_password: newPassword })
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: "Failed to update password in local store" }));
    throw new Error(err.detail || "Failed to update password");
  }
};

export const getUserList = async (): Promise<UserAccountInfo[]> => {
  try {
    const url = getApiBaseUrl();
    const response = await fetch(`${url}/user/list`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    return [];
  }
};

export const getUserProfile = async (userId?: string): Promise<UserProfile> => {
  const targetId = userId || getActiveUserId();
  const cached = getSavedUserProfile(targetId);

  try {
    const url = getApiBaseUrl();
    const response = await fetch(`${url}/user/profile?user_id=${encodeURIComponent(targetId)}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data: UserProfile = await response.json();
    setSavedUserProfile(data);
    return data;
  } catch (error) {
    console.warn("Notice: Using cached or fallback user profile:", error);
    if (cached) return cached;
    return { ...DEFAULT_USER_PROFILE, user_id: targetId };
  }
};

export const updateUserProfile = async (profile: UserProfile): Promise<UserProfile> => {
  // Update local storage immediately for fast UI feedback and persistence
  setSavedUserProfile(profile);
  if (profile.user_id) {
    setActiveUserId(profile.user_id);
  }

  try {
    const url = getApiBaseUrl();
    const response = await fetch(`${url}/user/profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const updated: UserProfile = await response.json();
    setSavedUserProfile(updated);
    return updated;
  } catch (error) {
    console.warn("Notice: Saved user profile locally (backend sync skipped):", error);
    return profile;
  }
};

export const analyzeLabel = async (requestData: AnalyzeRequest): Promise<AnalyzeResponse> => {
  try {
    const url = getApiBaseUrl();
    const response = await fetch(`${url}/analyze-label`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestData),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: Failed to analyze label`);
    }

    return await response.json();
  } catch (error) {
    console.warn("Notice (analyzeLabel):", error);
    throw error;
  }
};

export const analyzeLabelImage = async (requestData: AnalyzeImageRequest): Promise<AnalyzeResponse> => {
  try {
    const url = getApiBaseUrl();
    const response = await fetch(`${url}/analyze-image`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestData),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: Failed to analyze label image`);
    }

    return await response.json();
  } catch (error) {
    console.warn("Notice (analyzeLabelImage):", error);
    throw error;
  }
};

export interface OcrExtractResult {
  extracted_text: string;
  words_count: number;
  success: boolean;
}

export const extractOcrText = async (imageBase64: string): Promise<OcrExtractResult> => {
  try {
    const url = getApiBaseUrl();
    const response = await fetch(`${url}/extract-ocr`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ image_base64: imageBase64 }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: Failed to extract OCR text`);
    }

    return await response.json();
  } catch (error) {
    console.warn("Notice (extractOcrText):", error);
    throw error;
  }
};

export const lookupBarcode = async (barcode: string, userId: string = "default_user"): Promise<AnalyzeResponse> => {
  try {
    const url = getApiBaseUrl();
    const response = await fetch(`${url}/barcode/${encodeURIComponent(barcode)}?user_id=${encodeURIComponent(userId)}`, {
      method: "GET",
      headers: {
        "Accept": "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: Failed to lookup barcode`);
    }

    return await response.json();
  } catch (error) {
    console.warn("Notice (lookupBarcode):", error);
    throw error;
  }
};

export const analyzeBarcodeImage = async (
  imageBase64: string,
  userProfile?: UserProfile
): Promise<AnalyzeResponse> => {
  try {
    const url = getApiBaseUrl();
    const response = await fetch(`${url}/barcode/scan-image`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image_base64: imageBase64,
        user_profile: userProfile,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: Failed to analyze barcode image`);
    }

    return await response.json();
  } catch (error) {
    console.warn("Notice (analyzeBarcodeImage):", error);
    throw error;
  }
};

export const getUserStats = async (userId: string = "default_user"): Promise<UserStatsResponse> => {
  try {
    const url = getApiBaseUrl();
    const response = await fetch(`${url}/user/stats?user_id=${userId}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn("Notice: Using fallback user stats (backend offline/pending):", error);
    return { ...DEFAULT_USER_STATS, user_id: userId };
  }
};

export const getScanHistory = async (userId: string = "default_user", limit: number = 20): Promise<ScanHistoryItem[]> => {
  try {
    const url = getApiBaseUrl();
    const response = await fetch(`${url}/history?user_id=${userId}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data: ScanHistoryItem[] = await response.json();
    return data.slice(0, limit);
  } catch (error) {
    console.warn("Notice: Could not load scan history from backend:", error);
    return [];
  }
};

export const getScanDetails = async (scanId: string): Promise<ScanHistoryItem> => {
  try {
    const url = getApiBaseUrl();
    const response = await fetch(`${url}/history/${scanId}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn("Notice (getScanDetails):", error);
    throw error;
  }
};

export const deleteScanItem = async (scanId: string): Promise<void> => {
  try {
    const url = getApiBaseUrl();
    const response = await fetch(`${url}/history/${scanId}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } catch (error) {
    console.warn("Notice (deleteScanItem):", error);
    throw error;
  }
};

export const getDailyQuizzes = async (): Promise<QuizQuestion[]> => {
  try {
    const url = getApiBaseUrl();
    const response = await fetch(`${url}/engagement/quizzes`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn("Notice: Using offline daily quizzes:", error);
    return FALLBACK_QUIZZES;
  }
};

export const submitQuizAnswer = async (quizId: string, answer: string, userId: string = "default_user"): Promise<QuizSubmitResponse> => {
  try {
    const url = getApiBaseUrl();
    const response = await fetch(`${url}/engagement/quiz/submit?user_id=${userId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quiz_id: quizId, user_answer: answer }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn("Notice: Processed quiz answer offline:", error);
    return {
      is_correct: true,
      explanation: "Answer recorded locally.",
      xp_earned: 20,
      total_xp: 470,
      new_streak: 15,
    };
  }
};

export interface ChatMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
  timestamp: string;
  detected_additives?: string[];
  safety_verdict?: string;
  suggested_questions?: string[];
}

export interface ChatApiRequest {
  message: string;
  language?: string;
  user_profile?: UserProfile;
  product_context?: string;
}

export interface ChatApiResponse {
  reply: string;
  suggested_questions: string[];
  detected_additives: string[];
  safety_verdict?: string;
}

export const getOfflineNutritionistReply = (requestData: ChatApiRequest): ChatApiResponse => {
  const q = (requestData.message || "").toLowerCase();
  const lang = requestData.language || "en";
  const isHi = lang === "hi" || ["kya", "hai", "kro", "karo", "kaise", "seb", "kela", "doodh", "nashta", "pet", "vajan", "agr", "agar", "khaye"].some(w => q.includes(w));

  // 1. Seb / Apple
  if (q.includes("seb") || q.includes("apple") || q.includes("saeb")) {
    return {
      reply: isHi
        ? "🍎 **Seb (Apple) Khane Ke Fayde & Sahi Tarika:**\n\n• **Pectin Fiber**: Seb me soluble pectin fiber hota hai jo gut bacteria ko badhata hai aur cholesterol kam karta hai.\n• **Low Glycemic Index (GI 36)**: Blood sugar spike nahi karta, Diabetics ke liye bilkul safe hai.\n• **Heart Health**: Isme Quercetin antioxidant hota hai jo blood pressure aur heart ko protect karta hai.\n\n💡 **Best Tarika**: Subah ya mid-morning me achhi tarah dho kar chhilke sahit khayein. Juice banane se bachein kyunki juice me fiber nikal jata hai!"
        : "🍎 **Apples (Seb) Nutritional Profile:**\n\n• **Pectin Soluble Fiber**: Feeds beneficial gut microbiome bacteria and lowers LDL cholesterol.\n• **Low Glycemic Index (GI 36)**: Safe for diabetic blood sugar management without post-meal spikes.\n• **Quercetin & Antioxidants**: Supports cardiovascular health and endothelial blood flow.\n\n💡 **Tip**: Eat whole with skin washed thoroughly. Avoid strained juice to preserve vital dietary fiber.",
      suggested_questions: ["Can diabetics eat apples daily?", "What is the best time to eat fruits?", "Apple vs Banana for weight loss"],
      detected_additives: [],
      safety_verdict: "Nutritious Whole Food ✓"
    };
  }

  // 2. Breakfast / Morning Food
  if (q.includes("morning") || q.includes("breakfast") || q.includes("nashta") || q.includes("nashte") || q.includes("subah")) {
    return {
      reply: isHi
        ? "🌅 **Subah Ke Swasth Nashte (Healthy Breakfast Ideas):**\n\n1. **Oats & Chia Bowl**: Rolled oats ko doodh/paani me banayein, saath me badam, chia seeds aur taaza seb daalein.\n2. **Besan ya Moong Dal Chilla**: Paneer aur sabziyon se bhara hua chilla (High Protein + Low GI).\n3. **Boiled Eggs / Paneer Bhurji**: 2-3 Uble ande ya paneer bhurji ke saath 1 multigrain toast.\n4. **Sprouted Moong Chaat & Dahi**: Ankuran moong, tamatar, kheera, nimbu aur 1 bowl taaza dahi.\n\n⚠️ **Inse Bachein**: Sugary packaged cereals, maida biscuits/rusk, aur khali pet meethi chai."
        : "🌅 **Optimal High-Protein & High-Fiber Breakfast Options:**\n\n1. **Rolled Oats & Seeds**: Oats prepared with warm milk/water, chia seeds, crushed almonds, and fresh berries.\n2. **Moong Dal / Besan Pancake**: High plant protein, low glycemic index, served with mint yogurt.\n3. **Poached/Boiled Eggs**: 2 eggs paired with whole grain toast and avocado or sautéed spinach.\n4. **Greek Yogurt Parfait**: Unsweetened yogurt layered with seeds, walnuts, and fresh fruit.\n\n⚠️ **Avoid**: Ultra-processed cereals with high sugar and refined flour pastries.",
      suggested_questions: ["What are 5 quick 10-minute breakfasts?", "Is poha good for weight loss?", "How much protein should I eat in the morning?"],
      detected_additives: [],
      safety_verdict: "Nutritious Meal Plan"
    };
  }

  // 3. Kela / Banana
  if (q.includes("kela") || q.includes("banana")) {
    return {
      reply: isHi
        ? "🍌 **Kela (Banana) Ke Nutrition Facts:**\n\n• **Potassium Rich (~400mg)**: Blood pressure aur muscle recovery ke liye behtareen hai.\n• **Prebiotic Starch**: Halka kachha kela pet ke acche bacteria ke liye prebiotic ka kaam karta hai.\n• **Energy**: Workout se 30 minute pehle 1 kela khana instant stamina deta hai.\n\n💡 **Tip**: Agar Diabetes ya strict weight loss goal hai, toh din me 1 chhota kela badam ke saath khayein."
        : "🍌 **Bananas Nutritional Profile:**\n\n• **Potassium Powerhouse**: Supports healthy arterial pressure and muscle function.\n• **Prebiotic Resistant Starch**: Feeds beneficial gut microbiota.\n• **Workout Fuel**: Ideal 30 minutes before exercise for glycogen replenishment.",
      suggested_questions: ["Is banana good for high BP?", "Can diabetics eat bananas?"],
      detected_additives: [],
      safety_verdict: "Natural Whole Fruit"
    };
  }

  // 4. Doodh, Dahi, Paneer (Dairy)
  if (q.includes("doodh") || q.includes("milk") || q.includes("dahi") || q.includes("curd") || q.includes("paneer") || q.includes("chaas")) {
    return {
      reply: isHi
        ? "🥛 **Dahi, Doodh & Paneer (Dairy Nutrition):**\n\n• **Dahi & Chaas (Probiotic)**: Gut microbiome aur digestion ko strong karta hai, acidity rokta hai.\n• **Paneer (High Protein)**: 100g paneer me ~18g complete protein aur calcium hota hai.\n• **Doodh**: Haldi wala doodh raat me peene se immunity aur deep sleep me madad milti hai."
        : "🥛 **Fermented Dairy & Protein:**\n\n• **Yogurt/Curd**: Probiotic Lactobacillus cultures restore digestive lining integrity.\n• **Paneer (Cottage Cheese)**: Dense source of bioavailable casein protein and calcium.",
      suggested_questions: ["Is curd better than milk for gut health?", "How much paneer can I eat daily?"],
      detected_additives: [],
      safety_verdict: "Dairy Nutrition"
    };
  }

  // 5. Weight Loss
  if (q.includes("weight") || q.includes("vajan") || q.includes("fat loss") || q.includes("motapa") || q.includes("belly fat")) {
    return {
      reply: isHi
        ? "⚖️ **Permanent Weight Loss Ke 4 Niyam:**\n\n1. **Calorie Deficit**: Rozana 300-400 calorie kam khayein, lekin protein high rakhein taaki muscle bachi rahe.\n2. **Liquid Calories Band**: Soda, packaged juice, aur meethi chai band karein.\n3. **50% Plate Salad**: Har meal me aadha plate salad khayein taaki fiber se pet bhara rahe.\n4. **Clean Snacks**: Chips/biscuits ki jagah roasted makhana ya bhuna chana chunein."
        : "⚖️ **Evidence-Based Fat Loss Framework:**\n\n1. **Caloric Deficit**: 300-500 kcal below maintenance with 1.6g protein/kg.\n2. **Eliminate Liquid Sugar**: Zero soda, sweetened tea, or industrial fruit drinks.\n3. **High Dietary Fiber**: Oats, legumes, chia seeds, and raw greens to stimulate satiety signaling.",
      suggested_questions: ["What is a clean 1500 calorie diet plan?", "Best evening snacks for weight loss"],
      detected_additives: [],
      safety_verdict: "Metabolic Optimization"
    };
  }

  // 6. BP / Blood Pressure / Namak
  if (q.includes("bp") || q.includes("blood pressure") || q.includes("hypertension") || q.includes("namak")) {
    return {
      reply: isHi
        ? "💓 **Blood Pressure (High BP) Control Tips:**\n\n• **Sodium Limit (<1500mg/din)**: Namak 1 chammach se kam rakhein. Achaar, papad, packaged chips band karein.\n• **Potassium Badhayein**: Kela, palak, dahi, nariyal paani potassium se bharpoor hain jo BP normal karte hain.\n• **Lehsun (Garlic)**: Subah 1 kali lehsun khane se blood vessels relax hoti hain."
        : "💓 **Hypertension & Sodium Control:**\n\n• **Sodium Restriction (<1500mg/day)**: Cut processed meats, pickles, chips, and canned soups.\n• **Elevate Potassium**: Eat bananas, leafy greens, and coconut water to counter sodium retention.",
      suggested_questions: ["Top 5 potassium rich foods for BP", "Is Himalayan pink salt safe for high BP?"],
      detected_additives: [],
      safety_verdict: "Cardiovascular Advice"
    };
  }

  // 7. Digestion / Pet Kharab / Acidity / Gas
  if (q.includes("pet") || q.includes("digest") || q.includes("gas") || q.includes("acidity") || q.includes("kabz") || q.includes("constipation")) {
    return {
      reply: isHi
        ? "🌿 **Pet Ki Samasya (Gas, Acidity, Kabz) Ka Ilaj:**\n\n• **Dahi & Chaas**: Khane ke saath bhuna jeera wali chaas pijiye, gas turant kam hogi.\n• **Kabz (Constipation)**: Paka papita (papaya) aur bheega hua anjeer roz khayein; 3L paani piyein.\n• **Acidity**: Khali pet chai na piyein, aur dinner ke 2 ghante baad hi soyein."
        : "🌿 **Gut Health & Digestive Protocol:**\n\n• **Probiotics**: Unsweetened curd and buttermilk rebalance stomach flora.\n• **Constipation Relief**: Papaya, soaked figs, and 25-30g daily fiber.\n• **Acid Reflux Prevention**: Avoid fasted caffeine and maintain a 2-hour buffer before sleeping.",
      suggested_questions: ["Natural remedies for chronic acidity", "Best foods for constipation"],
      detected_additives: [],
      safety_verdict: "Digestive Health"
    };
  }

  // 8. E-codes / Additives (E621 / MSG etc.)
  if (q.includes("621") || q.includes("msg") || q.includes("monosodium glutamate")) {
    return {
      reply: isHi 
        ? "**E621 (MSG)** ek flavor enhancer hai jiska risk level **Moderate** hai. Kuch logon me yeh headache ya sensitivity paida kar sakta hai. Iska santulit sewan karein."
        : "**E621 (Monosodium Glutamate / MSG)** has a **Moderate Risk** rating. Flavor enhancer that can trigger sensitivity or flushing in sensitive individuals. Consume in moderation.",
      suggested_questions: ["Are there natural alternatives to MSG?", "Which foods hide MSG?"],
      detected_additives: ["E621"],
      safety_verdict: "Moderate Risk"
    };
  }

  // 9. Sugar / Sweetener / Diabetic
  if (q.includes("maltodextrin") || q.includes("sugar") || q.includes("sweetener") || q.includes("diabet")) {
    return {
      reply: isHi
        ? "**Glycemic Guidance**: Maltodextrin ka glycemic index (~110) white sugar se bhi zyada hota hai, jo blood sugar ko tezi se badhata hai. Stevia ya monk fruit behtar vikalp hain."
        : "**Smart Glycemic Guidance**: Maltodextrin has a glycemic index of ~110 (higher than pure glucose!), causing rapid insulin spikes. Opt for whole sweeteners like Stevia leaf or Monk fruit instead.",
      suggested_questions: ["Is maltodextrin worse than white sugar?", "What are clean low-carb snack swaps?"],
      detected_additives: [],
      safety_verdict: "Metabolic Advice"
    };
  }

  // 10. Processed / NOVA
  if (q.includes("processed") || q.includes("nova") || q.includes("upf")) {
    return {
      reply: isHi
        ? "**Food Processing Levels (NOVA)**:\n• **Level 1**: Whole foods (phal, daal, nuts)\n• **Level 2**: Culinary ingredients (tel, namak)\n• **Level 3**: Processed foods (fresh cheese, bread)\n• **Level 4**: **Ultra-Processed (UPFs)** - artificial additives, colors aur refined oils wale items. Inse bachein!"
        : "**Food Processing Levels (NOVA Classification)**:\n• **Level 1 (Unprocessed)**: Fresh produce, whole grains, raw nuts.\n• **Level 2 (Culinary)**: Olive oil, butter, natural spices.\n• **Level 3 (Processed)**: Artisanal cheese, canned whole vegetables.\n• **Level 4 (Ultra-Processed)**: Packaged snacks with emulsifiers, colors, and synthetic flavorings. Minimize Level 4!",
      suggested_questions: ["How can I replace ultra-processed snacks?", "What are the worst ingredients in UPFs?"],
      detected_additives: [],
      safety_verdict: "Educational"
    };
  }

  // 11. Greetings
  if (q.includes("hello") || q.includes("hi") || q.includes("hey") || q.includes("namaste")) {
    return {
      reply: isHi
        ? "Namaste! 🙏 Main aapka NutriLens AI Nutritionist hoon. Kisi bhi khadya padarth (jaise Seb, Kela, Doodh, Oats), bimari ke parhez (Diabetes, BP, Weight Loss), subah ke nashte, ya E-code preservative ke baare me puchiye!"
        : "Hello! 👋 I am your NutriLens AI Nutritionist. Ask me about any whole food, breakfast ideas, condition guidance (Diabetes, High BP, Gut health), or ingredient E-codes!",
      suggested_questions: ["morning food suggest kro", "agr koi seb kha rha hai to", "What is E621 (MSG)?"],
      detected_additives: [],
      safety_verdict: "Informational"
    };
  }

  return {
    reply: isHi
      ? `💡 **NutriLens Salah regarding "${requestData.message}":**\n\nHamesha short ingredient list wale whole foods (taaza phal, sabziyan, daal, dry fruits) chuniye. Agar kisi label par 5 se zyada chemical naam ya artificial E-codes hain, toh wo ultra-processed hota hai. Smart Scanner tab se kisi bhi packet ko scan karke dekhein!`
      : `💡 **NutriLens Clinical Guidance for "${requestData.message}":**\n\nPrioritize single-ingredient whole foods (fresh fruits, vegetables, legumes, whole grains). Avoid products containing industrial emulsifiers, artificial sweeteners, or synthetic colorings. Use the Smart Scanner anytime to audit food packaging!`,
    suggested_questions: ["morning food suggest kro", "agr koi seb kha rha hai to", "What are ultra-processed foods?"],
    detected_additives: [],
    safety_verdict: "General Nutrition"
  };
};

export const sendChatMessage = async (requestData: ChatApiRequest): Promise<ChatApiResponse> => {
  try {
    const url = getApiBaseUrl();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const response = await fetch(`${url}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestData),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn("Notice: Backend chat unreachable, providing offline intelligence:", error);
    return getOfflineNutritionistReply(requestData);
  }
};



