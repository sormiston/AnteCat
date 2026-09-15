import { useAuth } from "@/providers/auth/AuthProvider";
import { Redirect, Slot } from "expo-router";

export default function AppLayout() {
  const { status } = useAuth();

  // UX convenience only, not a security boundary -- RLS does not exist yet
  // (see SPEC.md's Architectural Decisions).
  if (status === "signedOut") return <Redirect href="/login" />;

  // TODO(ticket 4): resolve the one seeded syndicate and the caller's role in
  // it here, through the helpers a syndicate picker would later call.
  return <Slot />
}
