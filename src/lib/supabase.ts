import type { Database } from "@/lib/database.types";
import { createClient } from "@supabase/supabase-js";

// Connectivity spike only: unauthenticated, no session handling. Ticket 3
// replaces this file with the real singleton (auth + platform-conditional
// storage adapter) rather than extending it.

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. " +
      "Copy .example.env.local to .env.local and fill it in, then restart Metro " +
      "with --clear (env vars are inlined at bundle time).",
  );
}

export const supabaseUrl = url;

export const supabase = createClient<Database>(url, anonKey, {
  auth: {
    // Nothing signs in during this spike, and no storage adapter is installed
    // yet -- leaving these on makes supabase-js warn about missing storage.
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
  global: {
    headers: {
      // ngrok's free tier answers browser-like User-Agents with an HTML
      // interstitial instead of proxying. This header opts out of it.
      "ngrok-skip-browser-warning": "true",
    },
  },
});
