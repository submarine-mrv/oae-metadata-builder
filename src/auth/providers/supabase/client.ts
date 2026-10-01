import { createClient } from "@supabase/supabase-js";
import { authEnabled, authProvider } from "../../config";

const authDisabled = !authEnabled || authProvider !== "supabase";
const url = authDisabled ? "http://127.0.0.1:54321" : import.meta.env.VITE_SUPABASE_URL;
const publishableKey = authDisabled
  ? "auth-disabled"
  : import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

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
