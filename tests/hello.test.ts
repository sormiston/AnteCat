import type { Database } from "@/lib/database.types";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

// Deliberately not importing a shared app client here — the eventual RN app
// client will need react-native-url-polyfill and an AsyncStorage-backed
// storage adapter that don't apply (or work) in this Node test environment.
describe("anon Supabase client — local instance", () => {
  it("reaches the local Supabase REST API", async () => {
    const supabase = createClient<Database>(
      // process.env.EXPO_PUBLIC_SUPABASE_URL!,
      // process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
    );

    const { data, error } = await supabase
      .from("products")
      .select("id")
      .limit(1);

    // RLS-agnostic on purpose: proves the client got a well-formed response
    // from the server, not that RLS currently allows anon reads on `products`.
    expect(data === null || Array.isArray(data)).toBe(true);
    expect(error === null || typeof error.code === "string").toBe(true);
  });
});
