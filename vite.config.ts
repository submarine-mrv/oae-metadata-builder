import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

function git(args: string): string {
  try {
    return execSync(`git ${args}`, { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

// Exports record the builder version: 1.2.0 from main, 1.1.0+dev.ac24e9a from anything else.
// Netlify sets BRANCH and COMMIT_REF. The release tag is pushed after Netlify builds main,
// so the branch decides, not the tag.
const { version } = JSON.parse(readFileSync("package.json", "utf8"));
const branch = process.env.BRANCH || git("rev-parse --abbrev-ref HEAD");
const commit = (process.env.COMMIT_REF || git("rev-parse HEAD")).slice(0, 7);
process.env.VITE_BUILDER_VERSION ??= branch === "main" ? version : `${version}+dev.${commit}`;

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
