import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  updateProfile,
  onAuthStateChanged,
  User as FirebaseUser
} from "firebase/auth";

// Public Firebase Client Configuration for NutriLens (nutrilens-13ad2)
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSyCTBUn6wM4WzXkvK0EryHeY0vL76MkHhq8",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "nutrilens-13ad2.firebaseapp.com",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "nutrilens-13ad2",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "nutrilens-13ad2.firebasestorage.app",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "781410208219",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:781410208219:web:7dc96a1fa5f6102912bffe",
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-HRV1BG3V7V"
};

// Check if developer has replaced placeholder credentials with real Firebase keys
export const isFirebaseConfigured = (): boolean => {
  const key = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
  return Boolean(
    key &&
    key.length > 10 &&
    !key.includes("PLACEHOLDER") &&
    !key.includes("YOUR_") &&
    !key.includes("your_")
  );
};

// Initialize Firebase App singleton
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Auth
export const auth = getAuth(app);

// Google Sign-In Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: "select_account"
});

/**
 * Human-friendly Firebase error message translator.
 * Shields users from raw internal codes and provides actionable guidance.
 */
export const getFriendlyFirebaseErrorMessage = (error: any): string => {
  if (!error) return "An unexpected error occurred. Please try again.";

  const code: string = error.code || "";
  const rawMsg: string = error.message || "";

  switch (code) {
    case "auth/email-already-in-use":
      return "An account with this email address already exists. Please log in instead.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
      return "Incorrect email or password. Please verify your details and try again.";
    case "auth/user-not-found":
      return "No account was found with this email. Please check your spelling or sign up.";
    case "auth/invalid-email":
      return "Please enter a valid email address (e.g. name@example.com).";
    case "auth/weak-password":
      return "Password is too weak. Please use at least 6 characters with letters and numbers.";
    case "auth/user-disabled":
      return "This account has been temporarily disabled. Please contact NutriLens support.";
    case "auth/too-many-requests":
      return "Too many failed attempts. For your security, please wait a minute before trying again.";
    case "auth/network-request-failed":
      return "Network connection failed. Please check your internet connection.";
    case "auth/popup-closed-by-user":
      return "Google Sign-In window was closed before completing.";
    case "auth/cancelled-popup-request":
      return "Google sign-in request was cancelled.";
    case "auth/popup-blocked":
      return "Google sign-in popup was blocked by your browser. Please allow popups for NutriLens.";
    case "auth/unauthorized-domain":
      return "This domain is not authorized for Google Sign-In. Please add your domain to Firebase Console > Authentication > Settings > Authorized domains.";
    case "auth/requires-recent-login":
      return "For security, please log out and sign in again before making this change.";
    default:
      if (rawMsg.toLowerCase().includes("network")) {
        return "Network error. Please check your internet connection and try again.";
      }
      const fullText = `${code} ${rawMsg}`.toLowerCase();
      if (
        fullText.includes("api-key") ||
        fullText.includes("api_key") ||
        fullText.includes("api key")
      ) {
        return "Firebase API Key restricted or not configured for this domain.";
      }
      return rawMsg.replace(/^Firebase:\s*/i, "").trim() || "Authentication request failed. Please try again.";
  }
};

export {
  FirebaseUser,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  updateProfile,
  onAuthStateChanged
};
