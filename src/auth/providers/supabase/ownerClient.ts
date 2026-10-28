import { createClient } from "@supabase/supabase-js";
import { supabase } from "./client";

export function createOwnerClient(userId: string, keepalive = false) {
  return createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    {
      global: {
        fetch: (input, init) => {
          const body = init?.body;
          // Browsers cap outstanding keepalive bodies at 64 KiB.
          const canKeepalive =
            keepalive &&
            typeof body === "string" &&
            new TextEncoder().encode(body).byteLength <= 60_000;
          return fetch(input, { ...init, keepalive: canKeepalive });
        },
      },
      accessToken: async () => {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw new Error(`Could not authenticate this project request: ${error.message}`);
        if (!data.session || data.session.user.id !== userId) {
          throw new Error("The account changed. This project request has been stopped.");
        }
        return data.session.access_token;
      },
    },
  );
}
