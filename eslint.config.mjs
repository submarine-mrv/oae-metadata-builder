import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
  {
    rules: {
      // Disable 'any' type errors - common in schema-driven apps like RJSF
      "@typescript-eslint/no-explicit-any": "off",
      // Keep unused vars and expressions as warnings instead of errors
      "@typescript-eslint/no-unused-vars": "warn", 
      "@typescript-eslint/no-unused-expressions": "warn",
      // Keep React hooks warnings
      "react-hooks/exhaustive-deps": "warn",
    },
  },
];

export default eslintConfig;
