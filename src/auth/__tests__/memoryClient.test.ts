import { MemoryAuthClient } from "../memoryClient";

describe("MemoryAuthClient", () => {
  it("supports sign-in and emits auth state changes", async () => {
    const client = new MemoryAuthClient();
    const events: string[] = [];
    client.onAuthStateChange((_session, event) => events.push(event));

    const result = await client.signInWithPassword({
      email: "one@example.com",
      password: "password",
    });

    expect(result.error).toBeNull();
    expect(result.user?.email).toBe("one@example.com");
    expect(await client.getSession()).toEqual(result.session);
    expect(events).toEqual(["SIGNED_IN"]);
  });

  it("clears the session on sign-out", async () => {
    const client = new MemoryAuthClient();
    await client.signInWithPassword({ email: "one@example.com", password: "password" });

    await client.signOut();

    expect(await client.getSession()).toBeNull();
  });

  it("emits a sign-out event and clears the session", async () => {
    const client = new MemoryAuthClient();
    const events: string[] = [];
    client.onAuthStateChange((_session, event) => events.push(event));
    await client.signInWithPassword({ email: "one@example.com", password: "password" });
    await client.updateProfile({ displayName: "Researcher" });

    await client.signOut();

    expect(events).toEqual(["SIGNED_IN", "SIGNED_OUT"]);
    expect(await client.getSession()).toBeNull();
    expect(await client.getProfile()).toEqual({
      displayName: "Researcher",
      organization: null,
      orcid: null,
      avatarUrl: null,
    });
  });

  it("preserves the existing profile when applying a partial update", async () => {
    const client = new MemoryAuthClient();
    await client.updateProfile({ displayName: "Researcher", organization: "OAE" });

    const profile = await client.updateProfile({ orcid: "0000-0000-0000-0000" });

    expect(profile).toEqual({
      displayName: "Researcher",
      organization: "OAE",
      orcid: "0000-0000-0000-0000",
      avatarUrl: null,
    });
  });

  it("returns the active session from operations that do not change auth state", async () => {
    const client = new MemoryAuthClient();
    const signedIn = await client.signInWithPassword({
      email: "one@example.com",
      password: "password",
    });

    const result = await client.updatePassword();

    expect(result.session).toEqual(signedIn.session);
    expect(result.user).toEqual(signedIn.user);
    expect(result.error).toBeNull();
  });

  it("updates an in-memory profile", async () => {
    const client = new MemoryAuthClient();

    const profile = await client.updateProfile({ displayName: "Researcher" });

    expect(profile.displayName).toBe("Researcher");
    expect(profile.organization).toBeNull();
  });
});
