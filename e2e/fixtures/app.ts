import { expect, type Locator, type Page } from "@playwright/test";

/**
 * A cold Vite dev server pre-bundles dependencies and compiles each route on
 * its first request. With several workers starting at once that can take far
 * longer than the action timeout, so the first thing each test waits for gets
 * this instead.
 */
export const COLD_START_TIMEOUT = 45_000;

/** Wait for the first element of a freshly loaded route, allowing for a cold server. */
export async function waitForRoute(locator: Locator) {
  await expect(locator).toBeVisible({ timeout: COLD_START_TIMEOUT });
}

/** Open the overview and create a fresh project or experiment. */
export async function createFromOverview(page: Page, kind: "Project" | "Experiment") {
  await page.goto("/overview");
  const create = page.getByRole("button", { name: new RegExp(`Create.*${kind}`, "i") });
  await waitForRoute(create);
  await create.click();
  await page.waitForURL(`**/${kind.toLowerCase()}`);
}
