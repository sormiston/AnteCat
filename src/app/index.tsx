import { supabase, supabaseUrl } from "@/lib/supabase";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";

// Connectivity spike screen: dumps whatever the local Supabase stack answers
// with, success or failure. A PostgREST "permission denied" is a PASS -- it
// means the request reached Kong -> PostgREST -> Postgres. Only a network-level
// failure (no response at all) is a fail. Ticket 3 replaces this screen.

type Result = { label: "loading" | "response" | "network error"; body: string };

const INITIAL: Result = { label: "loading", body: "requesting products..." };

export default function Index() {
  const [result, setResult] = useState<Result>(INITIAL);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { data, error } = await supabase.from("products").select("*");
        if (cancelled) return;
        setResult({
          label: "response",
          body: JSON.stringify(data ?? error, null, 2),
        });
      } catch (thrown) {
        if (cancelled) return;
        setResult({ label: "network error", body: String(thrown) });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: `connectivity: ${Platform.OS}` }} />
      <Text style={styles.endpoint}>{supabaseUrl}</Text>
      <Text style={styles.label}>{result.label}</Text>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={styles.json}>{result.body}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  endpoint: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 12,
  },
  scroll: {
    flex: 1,
    marginTop: 4,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  json: {
    fontFamily: Platform.select({
      ios: "Menlo",
      android: "monospace",
      default: "monospace",
    }),
    fontSize: 12,
  },
});
