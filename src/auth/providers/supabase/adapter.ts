import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { failedResult, mapAuthError } from "../../errors";
import type { AuthClient, AuthEvent, AuthOtpType, AuthResult } from "../../types";
import { supabase } from "./client";
import { mapSession, mapUser } from "./mapUser";

function mapEvent(event: AuthChangeEvent): AuthEvent {
  return event as AuthEvent;
}

function result(
  session: Session | null,
  error: { message?: string; status?: number } | null,
): AuthResult {
  return {
    session: mapSession(session),
    user: session ? mapUser(session.user) : null,
    error: mapAuthError(error),
  };
}

export const supabaseAuthClient: AuthClient = {
  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw mapAuthError(error);
    return mapSession(data.session);
  },

  onAuthStateChange(callback) {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      callback(mapSession(session), mapEvent(event));
    });
    return () => data.subscription.unsubscribe();
  },

  async signUpWithPassword({ email, password, displayName, redirectTo }) {
    const response = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: displayName ? { display_name: displayName } : undefined,
        emailRedirectTo: redirectTo,
      },
    });
    return result(response.data.session, response.error);
  },

  async signInWithPassword({ email, password }) {
    const response = await supabase.auth.signInWithPassword({ email, password });
    return result(response.data.session, response.error);
  },

  async signInWithOtp({ email, redirectTo }) {
    const response = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    return result(null, response.error);
  },

  async signOut(scope = "local") {
    const { error } = await supabase.auth.signOut({ scope });
    if (error && import.meta.env.DEV) {
      console.warn("Supabase signOut completed locally with remote error:", error.message);
    }
  },

  async deleteAccount() {
    // Requires a "delete-user" edge function (service role) to remove the auth.users row.
    const { error } = await supabase.functions.invoke("delete-user");
    if (error) return failedResult({ message: error.message });
    return { session: null, user: null, error: null };
  },

  async sendPasswordReset(email, redirectTo) {
    const response = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    return failedResult(response.error);
  },

  async updatePassword(newPassword) {
    const response = await supabase.auth.updateUser({ password: newPassword });
    return result(null, response.error);
  },

  async updateEmail(newEmail, redirectTo) {
    const response = await supabase.auth.updateUser(
      { email: newEmail },
      { emailRedirectTo: redirectTo },
    );
    return result(null, response.error);
  },

  async resendVerification(email, redirectTo) {
    const response = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: redirectTo },
    });
    return result(null, response.error);
  },

  async verifyOtp(tokenHash: string, type: AuthOtpType) {
    const response = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!response.error && type === "email_change") {
      const [{ data: sessionData, error: sessionError }, { data: userData, error: userError }] =
        await Promise.all([supabase.auth.getSession(), supabase.auth.getUser()]);

      if (!sessionError && !userError && sessionData.session && userData.user) {
        return result({ ...sessionData.session, user: userData.user }, null);
      }
    }
    return result(response.data.session, response.error);
  },

  async getProfile() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw mapAuthError({ message: "Not authenticated" });
    const { data, error } = await supabase
      .from("profiles")
      .select("display_name, organization, orcid")
      .eq("id", user.id)
      .maybeSingle();
    if (error) throw mapAuthError(error);
    if (!data) return null;
    return {
      displayName: data.display_name,
      organization: data.organization,
      orcid: data.orcid,
    };
  },

  async updateProfile(patch) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw mapAuthError({ message: "Not authenticated" });
    const row = {
      id: user.id,
      display_name: patch.displayName || null,
      organization: patch.organization || null,
      orcid: patch.orcid || null,
    };
    const { data, error } = await supabase
      .from("profiles")
      .upsert(row, { onConflict: "id" })
      .select("display_name, organization, orcid")
      .single();
    if (error) throw mapAuthError(error);
    return {
      displayName: data.display_name,
      organization: data.organization,
      orcid: data.orcid,
    };
  },
};
