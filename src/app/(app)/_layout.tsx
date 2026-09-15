import { useMemberships } from "@/features/syndicates/api";
import { useAuth } from "@/providers/auth/AuthProvider";
import { Redirect, Slot } from "expo-router";

export default function AppLayout() {
  const { status, user } = useAuth();

  // Syndicate and role resolution has one home, and this is it: every screen
  // below reads the same ['memberships', userId] key, so a syndicate picker
  // later is a screen added here rather than a second way to answer "which
  // syndicate, and what am I in it" (SPEC.md's Screen / Route Map).
  useMemberships(user?.id);

  // UX convenience only, not a security boundary -- RLS does not exist yet
  // (see SPEC.md's Architectural Decisions).
  if (status === "signedOut") return <Redirect href="/login" />;

  return <Slot />;
}
