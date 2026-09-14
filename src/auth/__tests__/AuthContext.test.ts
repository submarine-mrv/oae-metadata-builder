import { authStore, updateAuthStore } from "../authStore";

describe("updateAuthStore", () => {
  beforeEach(() => {
    updateAuthStore(null, null);
  });

  it("updates store status and properties when session and profile are set", () => {
    const session = {
      accessToken: "token-1",
      refreshToken: "refresh-1",
      expiresAt: 12345,
      user: {
        id: "user-1",
        email: "test@example.com",
        emailVerified: true,
        createdAt: "2026-01-01",
      },
    };
    const profile = { displayName: "Jane Doe", organization: "OAE", orcid: null };

    updateAuthStore(session, profile, "SIGNED_IN");

    expect(authStore.status).toBe("authenticated");
    expect(authStore.isAuthenticated).toBe(true);
    expect(authStore.session).toEqual(session);
    expect(authStore.user).toEqual(session.user);
    expect(authStore.profile).toEqual(profile);
  });

  it("resets state when session is null", () => {
    const session = {
      accessToken: "token-1",
      refreshToken: "refresh-1",
      expiresAt: 12345,
      user: {
        id: "user-1",
        email: "test@example.com",
        emailVerified: true,
        createdAt: "2026-01-01",
      },
    };
    updateAuthStore(session, {
      displayName: "Jane",
      organization: null,
      orcid: null,
    });
    expect(authStore.isAuthenticated).toBe(true);

    updateAuthStore(null);

    expect(authStore.status).toBe("unauthenticated");
    expect(authStore.isAuthenticated).toBe(false);
    expect(authStore.session).toBeNull();
    expect(authStore.user).toBeNull();
    expect(authStore.profile).toBeNull();
  });
});
