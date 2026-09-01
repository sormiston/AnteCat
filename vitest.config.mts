import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

try {
  process.loadEnvFile(".env.test.local");
} catch {
  // Optional locally-created file. If it's missing, integration tests will
  // fail clearly at the createClient() call instead of here.
}

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
