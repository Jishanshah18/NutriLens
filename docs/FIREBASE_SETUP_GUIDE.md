# NutriLens — Firebase Authentication Setup Guide

This guide walks you through setting up Firebase Authentication for NutriLens while preserving your existing Supabase database and scan history.

---

## 1. Create a Firebase Project

1. Navigate to the [Firebase Console](https://console.firebase.google.com/).
2. Click **Add project** (or **Create a project**).
3. Enter your project name: `NutriLens` (or your preferred name).
4. (Optional) Enable Google Analytics according to your preference.
5. Click **Create project** and wait for provisioning to complete.

---

## 2. Register Your Web App & Obtain Config Keys

1. In the Firebase Project Overview screen, click the **Web icon** (`</>`) to add a web application.
2. Enter an App nickname (e.g. `NutriLens-App`).
3. (Optional) Check "Also set up Firebase Hosting" if planning to host on Firebase.
4. Click **Register app**.
5. Firebase will display your `firebaseConfig` object:
   ```javascript
   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "your-project-id.firebaseapp.com",
     projectId: "your-project-id",
     storageBucket: "your-project-id.appspot.com",
     messagingSenderId: "123456789012",
     appId: "1:123456789012:web:abcdef123456",
     measurementId: "G-XXXXXXXXXX"
   };
   ```
6. Copy these values — you will paste them into your frontend `.env` file.

---

## 3. Enable Email/Password Authentication

1. In the Firebase Console left navigation, select **Build > Authentication**.
2. Click **Get started**.
3. Under the **Sign-in method** tab:
   - Click **Email/Password**.
   - Toggle **Enable** to **ON**.
   - (Optional) Toggle **Email link (passwordless sign-in)** if desired (NutriLens defaults to password + email verification).
   - Click **Save**.
4. Under the **Templates** tab:
   - Customize your **Email address verification** and **Password reset** email subject and sender names as needed.

---

## 4. Enable Google Sign-In Provider

1. In the **Sign-in method** tab, click **Add new provider**.
2. Select **Google**.
3. Toggle **Enable** to **ON**.
4. Choose a **Project public-facing name** (e.g. `NutriLens`).
5. Select a **Project support email** from your Google account.
6. Click **Save**.

---

## 5. Configure Authorized Domains & OAuth Redirects

1. Under **Authentication > Settings > Authorized domains**:
   - Verify `localhost` is listed (enabled by default for local development).
   - Click **Add domain** and enter your production web domain:
     - `nutrilens.vercel.app` (or your actual Vercel/Render URL).
     - Any custom production domains (e.g. `nutrilens.ai`).

---

## 6. Configure Environment Variables

### Frontend: `frontend/.env`
Add the keys obtained from Step 2:

```env
# Backend API Base URL
EXPO_PUBLIC_API_URL=https://nutrilens-jfiv.onrender.com/api
# Or for local development:
# EXPO_PUBLIC_API_URL=http://127.0.0.1:8000/api

# Firebase Authentication Configuration
EXPO_PUBLIC_FIREBASE_API_KEY=AIzaSyYourActualApiKeyHere
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=1:your_sender_id:web:your_app_id
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX

# Supabase Cloud Database (Preserves scan history & user profiles)
EXPO_PUBLIC_SUPABASE_URL=https://llbithcfnwzgwubfuhfb.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_N-nO07iLpQAHtpwAj0oVqQ_K7yKQ0O8
```

### Backend: `backend/.env`
Add your Firebase Project ID for backend token verification:

```env
FIREBASE_PROJECT_ID=your-project-id
SUPABASE_URL=https://llbithcfnwzgwubfuhfb.supabase.co
SUPABASE_KEY=sb_publishable_N-nO07iLpQAHtpwAj0oVqQ_K7yKQ0O8
ALLOWED_ORIGINS=http://localhost:8081,https://nutrilens.vercel.app
```

---

## 7. Android & iOS Platform Settings (When Building Native Binaries)

For native Expo builds (`npx expo run:android` or `npx expo run:ios`):
1. **Android**:
   - In Firebase Console > Project Settings, click **Add app > Android**.
   - Package name: from `app.json` (`com.anonymous.frontend` or your custom package name).
   - Generate SHA-1 fingerprint: run `keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android`.
   - Download `google-services.json` and place in your Expo project root.
2. **iOS**:
   - In Firebase Console > Project Settings, click **Add app > iOS**.
   - Bundle ID: from `app.json`.
   - Download `GoogleService-Info.plist`.

---

## 8. Test Your Setup

1. **Email Sign Up**:
   - Go to `/signup`.
   - Fill in name, email, password, and select health conditions (e.g. Diabetes).
   - Submit: you will receive an email verification link, and your profile is created.
2. **Email Sign In**:
   - Go to `/login` and sign in with the new credentials.
   - Verify you land on the dashboard with your conditions intact.
3. **Google Sign-In**:
   - Click "Continue with Google" on the login screen.
   - Select your Google account; you will be signed in seamlessly.
4. **Password Reset**:
   - Click "Forgot Password?" on the login screen.
   - Enter your email and click "Send Reset Link".
   - Check your inbox for the password reset email.
5. **Session Persistence**:
   - Refresh the page or close and reopen the app.
   - You should remain logged in.
6. **Secure Logout**:
   - Go to `/profile` and click "Sign Out".
   - You should be redirected back to `/login` and active tokens cleared.
7. **Supabase & Legacy Data Preservation**:
   - Sign in with an existing user email (e.g. `jishan@nutrilens.ai`).
   - All past scans and clinical profile preferences are automatically migrated and preserved.
