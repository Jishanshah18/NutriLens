import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  "https://llbithcfnwzgwubfuhfb.supabase.co";

const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_N-nO07iLpQAHtpwAj0oVqQ_K7yKQ0O8";

const isWebWithStorage = typeof window !== "undefined" && Boolean(window.localStorage);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: isWebWithStorage,
    autoRefreshToken: isWebWithStorage,
    detectSessionInUrl: isWebWithStorage,
  },
});

