import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { failedResult, mapAuthError } from "../../errors";
import type { AuthClient, AuthEvent, AuthResult } from "../../types";
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

  async signUpWithPassword({ email, password, displayName }) {
    const response = await supabase.auth.signUp({
      email,
      password,
      options: { data: displayName ? { display_name: displayName } : undefined },
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
    if (error) throw mapAuthError(error);
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

  async exchangeCodeForSession(url) {
    const response = await supabase.auth.exchangeCodeForSession(url);
    // TODO: Dev code
    if (response.error) {
      console.error("Supabase exchangeCodeForSession failed:", {
        code: response.error.code,
        message: response.error.message,
        status: response.error.status,
      });
    }
    return result(response.data.session, response.error);
  },

  async getProfile() {
    const { data, error } = await supabase
      .from("profiles")
      .select("display_name, organization, orcid, avatar_url")
      .single();
    if (error) {
      if (error.code === "PGRST116") return null;
      throw mapAuthError(error);
    }
    return {
      displayName: data.display_name,
      organization: data.organization,
      orcid: data.orcid,
      avatarUrl: data.avatar_url,
    };
  },

  async updateProfile(patch) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw mapAuthError({ message: "Not authenticated" });
    const row = {
      display_name: patch.displayName,
      organization: patch.organization || null,
      orcid: patch.orcid || null,
      avatar_url: patch.avatarUrl,
    };
    const { data, error } = await supabase
      .from("profiles")
      .update(row)
      .eq("id", user.id)
      .select()
      .single();
    if (error) throw mapAuthError(error);
    return {
      displayName: data.display_name,
      organization: data.organization,
      orcid: data.orcid,
      avatarUrl: data.avatar_url,
    };
  },
};
