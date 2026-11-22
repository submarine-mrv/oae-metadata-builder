/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** GA4 measurement ID. Unset disables analytics. */
  readonly VITE_GA_MEASUREMENT_ID: string;
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  readonly VITE_AUTH_ENABLED?: string;
  readonly VITE_AUTH_PROVIDER?: string;
  /** Builder commit, set in vite.config.ts. */
  readonly VITE_BUILDER_GIT_HASH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
