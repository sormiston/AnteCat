import { Redirect } from "expo-router";

// Exactly one seeded order exists, so there is no order picker or order list
// to land on (SPEC.md's Screen / Route Map).
export default function AppIndex() {
  return <Redirect href="/order" />;
}
