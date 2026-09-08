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
  calories?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  sugar_g?: number;
  sodium_mg?: number;
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

export interface AnalyzeResponse {
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
export const getApiBaseUrl = (): string => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  if (typeof window !== "undefined" && window.location?.hostname) {
    return `http://${window.location.hostname}:8000/api`;
  }
  return "http://127.0.0.1:8000/api";
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
    const response = await fetch(`${API_BASE_URL}/user/profile?user_id=${userId}`);
    if (!response.ok) throw new Error("Failed to fetch user profile");
    return await response.json();
  } catch (error) {
    console.error("API Error (getUserProfile):", error);
    throw error;
  }
};

export const updateUserProfile = async (profile: UserProfile): Promise<UserProfile> => {
  try {
    const response = await fetch(`${API_BASE_URL}/user/profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });
    if (!response.ok) throw new Error("Failed to update user profile");
    return await response.json();
  } catch (error) {
    console.error("API Error (updateUserProfile):", error);
    throw error;
  }
};

export const analyzeLabel = async (requestData: AnalyzeRequest): Promise<AnalyzeResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/analyze-label`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestData),
    });

    if (!response.ok) {
      throw new Error("Failed to analyze label");
    }

    return await response.json();
  } catch (error) {
    console.error("API Error (analyzeLabel):", error);
    throw error;
  }
};

export const analyzeLabelImage = async (requestData: AnalyzeImageRequest): Promise<AnalyzeResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/analyze-image`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestData),
    });

    if (!response.ok) {
      throw new Error("Failed to analyze label image");
    }

    return await response.json();
  } catch (error) {
    console.error("API Error (analyzeLabelImage):", error);
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
    const response = await fetch(`${API_BASE_URL}/extract-ocr`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ image_base64: imageBase64 }),
    });

    if (!response.ok) {
      throw new Error("Failed to extract OCR text");
    }

    return await response.json();
  } catch (error) {
    console.error("API Error (extractOcrText):", error);
    throw error;
  }
};

export const getUserStats = async (userId: string = "default_user"): Promise<UserStatsResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/user/stats?user_id=${userId}`);
    if (!response.ok) throw new Error("Failed to fetch user stats");
    return await response.json();
  } catch (error) {
    console.error("API Error (getUserStats):", error);
    throw error;
  }
};

export const getScanHistory = async (userId: string = "default_user", limit: number = 20): Promise<ScanHistoryItem[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/history?user_id=${userId}`);
    if (!response.ok) throw new Error("Failed to fetch scan history");
    const data: ScanHistoryItem[] = await response.json();
    return data.slice(0, limit);
  } catch (error) {
    console.error("API Error (getScanHistory):", error);
    throw error;
  }
};

export const getScanDetails = async (scanId: string): Promise<ScanHistoryItem> => {
  try {
    const response = await fetch(`${API_BASE_URL}/history/${scanId}`);
    if (!response.ok) throw new Error("Failed to fetch scan details");
    return await response.json();
  } catch (error) {
    console.error("API Error (getScanDetails):", error);
    throw error;
  }
};

export const deleteScanItem = async (scanId: string): Promise<void> => {
  try {
    const response = await fetch(`${API_BASE_URL}/history/${scanId}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Failed to delete scan item");
  } catch (error) {
    console.error("API Error (deleteScanItem):", error);
    throw error;
  }
};

export const getDailyQuizzes = async (): Promise<QuizQuestion[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/engagement/quizzes`);
    if (!response.ok) throw new Error("Failed to fetch quizzes");
    return await response.json();
  } catch (error) {
    console.error("API Error (getDailyQuizzes):", error);
    throw error;
  }
};

export const submitQuizAnswer = async (quizId: string, answer: string, userId: string = "default_user"): Promise<QuizSubmitResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/engagement/quiz/submit?user_id=${userId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quiz_id: quizId, user_answer: answer }),
    });
    if (!response.ok) throw new Error("Failed to submit quiz answer");
    return await response.json();
  } catch (error) {
    console.error("API Error (submitQuizAnswer):", error);
    throw error;
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
    const response = await fetch(`${API_BASE_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestData),
    });
    if (!response.ok) throw new Error("Failed to send chat message");
    return await response.json();
  } catch (error) {
    console.error("API Error (sendChatMessage):", error);
    throw error;
  }
};


