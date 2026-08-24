import { createClient } from "@supabase/supabase-js";

const authDisabled = import.meta.env.VITE_AUTH_ENABLED === "false";
const url = import.meta.env.VITE_SUPABASE_URL ?? (authDisabled ? "http://127.0.0.1:54321" : "");
const publishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? (authDisabled ? "auth-disabled" : "");

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
  },
});
