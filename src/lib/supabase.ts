import type { Database } from "@/lib/database.types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. " +
      "Copy .example.env.development to .env.development and fill it in, then " +
      "restart Metro with --clear (env vars are inlined at bundle time).",
  );
}

export const supabaseUrl = url;
export const supabase = createClient<Database>(url, anonKey, {
  auth: {
    // Web has localStorage already; supabase-js picks it up when storage is
    // left undefined, and falls back to in-memory during the static web
    // prerender, where there is no window.
    storage: Platform.OS === "web" ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  global: {
    headers: {
      // ngrok's free tier answers browser-like User-Agents with an HTML
      // interstitial instead of proxying. This header opts out of it.
      "ngrok-skip-browser-warning": "true",
    },
  },
});
