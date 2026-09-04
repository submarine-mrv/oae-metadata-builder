import { expect, test } from "@playwright/test";

test.describe("authentication", () => {
  test("redirects unauthenticated users and preserves the destination", async ({ page }) => {
    await page.goto("/profile");

    await expect(page).toHaveURL(/\/auth\/login\?returnTo=/);
    await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
  });

  test("validates signup passwords and opens email verification", async ({ page }) => {
    await page.goto("/auth/sign-up");

    await page.getByLabel("Display name").fill("Researcher");
    await page.getByLabel("Email").fill("researcher@example.com");
    await page.locator('input[autocomplete="new-password"]').nth(0).fill("Password1");
    await page.getByLabel("Confirm password").fill("Different1");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.getByText("Passwords do not match.")).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/sign-up$/);

    await page.getByLabel("Confirm password").fill("Password1");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page).toHaveURL(/\/auth\/verify-email\?email=researcher%40example\.com/);
    await expect(page.getByRole("heading", { name: "Check your inbox" })).toBeVisible();
    await expect(page.getByText(/researcher@example.com/)).toBeVisible();
  });

  test("confirms a password reset request without revealing account state", async ({ page }) => {
    await page.goto("/auth/forgot-password");
    await page.getByLabel("Email").fill("researcher@example.com");
    await page.getByRole("button", { name: "Send reset link" }).click();

    await expect(
      page.getByText("If an account exists for that address, we have sent a reset link."),
    ).toBeVisible();
  });

  test("updates a profile, logs out, and confirms account deletion", async ({ page }) => {
    await page.goto("/auth/login");
    await page.getByLabel("Email").fill("researcher@example.com");
    await page.getByLabel("Password").fill("Password1");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/overview$/);

    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByRole("menuitem", { name: "Profile" }).click();
    await expect(page).toHaveURL(/\/profile$/);
    await page.getByLabel("Display name").fill("Metadata researcher");
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByText("Profile saved.")).toBeVisible();

    await page.getByRole("button", { name: "Delete account" }).click();
    await expect(page.getByRole("dialog", { name: "Delete account" })).toBeVisible();
    await page.getByLabel("Confirm email").fill("researcher@example.com");
    await page.getByRole("dialog").getByRole("button", { name: "Delete account" }).click();

    await expect(page).toHaveURL(/\/auth\/login$/);
    await expect(page.getByText("Your account has been deleted.")).toBeVisible();
  });

  test("returns to the originally requested page after login", async ({ page }) => {
    await page.goto("/profile");
    await expect(page).toHaveURL(/\/auth\/login\?returnTo=/);

    await page.getByLabel("Email").fill("researcher@example.com");
    await page.getByLabel("Password").fill("Password1");
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page).toHaveURL(/\/profile$/);
    await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible();
  });
});