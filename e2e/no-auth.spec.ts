import { expect, test } from "@playwright/test";

// Runs against a dev server started with VITE_AUTH_ENABLED=false (see playwright.config.ts).
test.describe("with auth turned off", () => {
  test("hides the account menu items", async ({ page }) => {
    await page.goto("/overview");
    await page.getByRole("button", { name: "Menu" }).click();

    await expect(page.getByRole("menuitem", { name: "About" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Log in" })).toHaveCount(0);
    await expect(page.getByRole("menuitem", { name: "Sign up" })).toHaveCount(0);
  });

  for (const path of ["/auth/login", "/auth/sign-up", "/auth/callback", "/profile"]) {
    test(`redirects ${path} to the overview`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/overview$/);
    });
  }
});
