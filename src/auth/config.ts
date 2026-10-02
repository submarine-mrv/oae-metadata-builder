/** Auth is off unless VITE_AUTH_ENABLED is "true": no account menu, auth routes, or Supabase code. */
export const authEnabled = import.meta.env.VITE_AUTH_ENABLED === "true";

/** "supabase" for deployments; "memory" is an in-browser fake for end-to-end tests and demos. */
export const authProvider = import.meta.env.VITE_AUTH_PROVIDER ?? "supabase";
