import { execSync } from "node:child_process";
import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

function gitHead(): string {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

// Exports record the commit they were built from. Netlify sets COMMIT_REF.
process.env.VITE_BUILDER_GIT_HASH ??= process.env.COMMIT_REF || gitHead();

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    // Must precede the React plugin so route files are transformed first.
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  // Keep the dev/preview port on 3000 so Playwright + CI workflows are unchanged.
  server: { port: 3000 },
  preview: { port: 3000 },
});
