import { createClient } from "@supabase/supabase-js";
import { authEnabled, authProvider } from "../../config";

const supabaseEnabled = authEnabled && authProvider === "supabase";
const url = supabaseEnabled ? import.meta.env.VITE_SUPABASE_URL : "http://127.0.0.1:54321";
const publishableKey = supabaseEnabled
  ? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  : "supabase-disabled";

if (!url || !publishableKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env and configure Supabase.",
  );
}

export const supabase = createClient(url, publishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    flowType: "pkce",
    storageKey: "oae-auth",
    debug: import.meta.env.DEV,
  },
});
