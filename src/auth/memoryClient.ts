import type {
  AuthClient,
  AuthEvent,
  AuthProfile,
  AuthResult,
  AuthSession,
  AuthUser,
} from "./types";

export class MemoryAuthClient implements AuthClient {
  private session: AuthSession | null = null;
  private profile: AuthProfile | null = null;
  private listeners = new Set<(session: AuthSession | null, event: AuthEvent) => void>();

  async getSession() {
    return this.session;
  }

  onAuthStateChange(callback: (session: AuthSession | null, event: AuthEvent) => void) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  async signUpWithPassword({ email }: { email: string; password: string; displayName?: string }) {
    return this.authenticate(email, false);
  }

  async signInWithPassword({ email }: { email: string; password: string }) {
    return this.authenticate(email, false);
  }

  async signInWithOtp() {
    return this.emptyResult();
  }

  async signOut() {
    this.session = null;
    this.emit("SIGNED_OUT");
  }

  async deleteAccount() {
    this.session = null;
    this.profile = null;
    this.emit("SIGNED_OUT");
    return this.emptyResult();
  }

  async sendPasswordReset() {
    return this.emptyResult();
  }

  async updatePassword() {
    return this.emptyResult();
  }

  async updateEmail() {
    return this.emptyResult();
  }

  async resendVerification() {
    return this.emptyResult();
  }

  async exchangeCodeForSession() {
    return this.emptyResult();
  }

  async getProfile() {
    return this.profile;
  }

  async updateProfile(patch: Partial<AuthProfile>) {
    this.profile = {
      displayName: null,
      organization: null,
      orcid: null,
      avatarUrl: null,
      ...this.profile,
      ...patch,
    };
    return this.profile;
  }

  seedSession(user: AuthUser, event: AuthEvent = "SIGNED_IN") {
    this.session = {
      accessToken: "memory-access-token",
      refreshToken: "memory-refresh-token",
      expiresAt: null,
      user,
    };
    this.emit(event);
  }

  private authenticate(email: string, emailVerified: boolean): AuthResult {
    const user: AuthUser = {
      id: `memory-${email}`,
      email,
      emailVerified,
      createdAt: new Date(0).toISOString(),
    };
    this.seedSession(user);
    return { session: this.session, user, error: null };
  }

  private emptyResult(): AuthResult {
    return { session: this.session, user: this.session?.user ?? null, error: null };
  }

  private emit(event: AuthEvent) {
    for (const listener of this.listeners) listener(this.session, event);
  }
}
