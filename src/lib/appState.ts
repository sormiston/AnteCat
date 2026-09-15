import { supabase } from "@/lib/supabase";
import { focusManager } from "@tanstack/react-query";
import { useEffect } from "react";
import { AppState, Platform, type AppStateStatus } from "react-native";

/**
 * TanStack Query's focus tracking assumes a browser `visibilitychange`, which
 * React Native does not have -- AppState is the native equivalent. Supabase's
 * token auto-refresh timer needs the same signal for the opposite reason: it
 * must stop while backgrounded and catch up on return.
 *
 * Web needs neither: the default focus manager already works there, and
 * supabase-js starts its own refresh timer in a browser.
 */
export function useAppStateSync() {
  useEffect(() => {
    if (Platform.OS === "web") return;

    const onChange = (state: AppStateStatus) => {
      focusManager.setFocused(state === "active");
      if (state === "active") {
        supabase.auth.startAutoRefresh();
      } else {
        supabase.auth.stopAutoRefresh();
      }
    };

    onChange(AppState.currentState);
    const subscription = AppState.addEventListener("change", onChange);

    return () => {
      subscription.remove();
      supabase.auth.stopAutoRefresh();
    };
  }, []);
}
