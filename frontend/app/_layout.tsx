import "../global.css";
import { Stack } from "expo-router";
import { ThemeProvider } from "../lib/ThemeContext";

export default function Layout() {
  return (
    <ThemeProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="scanner" />
        <Stack.Screen name="results" />
        <Stack.Screen name="chat" />
        <Stack.Screen name="insights" />
        <Stack.Screen name="history" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="engagement" />
      </Stack>
    </ThemeProvider>
  );
}
