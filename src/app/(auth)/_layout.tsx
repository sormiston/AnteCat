import { useAuth } from "@/providers/auth/AuthProvider";
import { Redirect, Slot } from "expo-router";

export default function AuthLayout() {
  const { status } = useAuth();

  // UX convenience only, not a security boundary -- RLS does not exist yet
  // (see SPEC.md's Architectural Decisions).
  if (status === "signedIn") return <Redirect href="/order" />;

  return <Slot />;
}
