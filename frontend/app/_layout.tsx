import "../global.css";
import { Stack } from "expo-router";
import { ThemeProvider } from "../lib/ThemeContext";
import { AuthProvider } from "../lib/AuthContext";

export default function Layout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="login" />
          <Stack.Screen name="signup" />
          <Stack.Screen name="scanner" />
          <Stack.Screen name="results" />
          <Stack.Screen name="chat" />
          <Stack.Screen name="insights" />
          <Stack.Screen name="history" />
          <Stack.Screen name="profile" />
          <Stack.Screen name="engagement" />
        </Stack>
      </AuthProvider>
    </ThemeProvider>
  );
}
