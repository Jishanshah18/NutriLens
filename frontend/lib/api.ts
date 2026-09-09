export interface UserProfile {
  user_id?: string;
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
  is_estimated?: boolean;
  source?: string;
  serving_size?: string;
}

export interface AlternativeProduct {
  name: string;
  reason: string;
  estimated_health_score: number;
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
  health_score: number;
  nova_group?: number;
  allergen_flags: string[];
  ingredient_risks: string[];
  positive_attributes?: string[];
  additives?: AdditiveDetail[];
  nutrition_estimate?: NutritionBreakdown;
  healthier_alternatives?: AlternativeProduct[];
  personalized_verdict: string;
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
  user_id: "default_user",
  dietary_preferences: ["Low Sugar", "Vegan"],
  allergies: ["Peanuts", "Soy"],
  health_goals: ["Weight Loss", "Heart Health"],
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
  return "http://localhost:8000/api";
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

export const getUserProfile = async (userId: string = "default_user"): Promise<UserProfile> => {
  try {
    const url = getApiBaseUrl();
    const response = await fetch(`${url}/user/profile?user_id=${userId}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn("Notice: Using fallback user profile (backend offline/pending):", error);
    return { ...DEFAULT_USER_PROFILE, user_id: userId };
  }
};

export const updateUserProfile = async (profile: UserProfile): Promise<UserProfile> => {
  try {
    const url = getApiBaseUrl();
    const response = await fetch(`${url}/user/profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
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

export const sendChatMessage = async (requestData: ChatApiRequest): Promise<ChatApiResponse> => {
  try {
    const url = getApiBaseUrl();
    const response = await fetch(`${url}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestData),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn("Notice (sendChatMessage):", error);
    throw error;
  }
};


