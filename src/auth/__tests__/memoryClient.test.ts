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

  it("updates an in-memory profile", async () => {
    const client = new MemoryAuthClient();

    const profile = await client.updateProfile({ displayName: "Researcher" });

    expect(profile.displayName).toBe("Researcher");
    expect(profile.organization).toBeNull();
  });
});
