import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
    css: true,
    exclude: ["**/node_modules/**", "**/e2e/**", ".claude/**"],
    env: {
      VITEST: "true",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json"],
      include: [
        "src/utils/**/*.{ts,tsx}",
        "src/pages/**/*.{ts,tsx}",
        "src/contexts/**/*.{ts,tsx}",
        "src/components/**/*.{ts,tsx}",
        "scripts/**/*.mjs",
      ],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/**/__tests__/**",
        "src/components/rjsf/**", // Skip RJSF custom widgets (mostly UI)
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
        statements: 70,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
