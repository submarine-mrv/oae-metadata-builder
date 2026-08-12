/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** GA4 measurement ID. Unset disables analytics. */
  readonly VITE_GA_MEASUREMENT_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
