import "@/css/global.css";

import { useAppStateSync } from "@/lib/appState";
import { queryClient } from "@/lib/queryClient";
import { AuthProvider, useAuth } from "@/providers/auth/AuthProvider";
import { FeedbackProvider } from "@/providers/feedback/FeedbackProvider";
import { QueryClientProvider } from "@tanstack/react-query";
import { Slot } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { View } from "react-native";

SplashScreen.preventAutoHideAsync();

function SplashGate() {
  const { status } = useAuth();
  const ready = status !== "loading";

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  // Nothing renders until the persisted session has been restored, so the
  // route guards below never redirect off a status they are about to change.
  return ready ? <Slot /> : null;
}

export default function RootLayout() {
  useAppStateSync();

  return (
    <FeedbackProvider projectId="proj_11bd125ef5e7cdb58b761bf1">
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <View className="flex-1 bg-ground web:mx-auto web:w-full web:max-w-[1200px]">
            <SplashGate />
          </View>
        </AuthProvider>
      </QueryClientProvider>
    </FeedbackProvider>
  );
}
