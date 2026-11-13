import { expect, test } from "@playwright/test";
import { waitForRoute } from "./fixtures/app";

// The startup route preloads used to race the "/" → /overview redirect and log router errors.
test("loading / logs no router errors from the startup preloads", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto("/");
  await waitForRoute(page.getByRole("button", { name: "Create your first project" }));
  await page.waitForLoadState("networkidle");

  expect(errors.filter((e) => /_nonReactive|preloadRoute/.test(e))).toEqual([]);
});
