import { ROUTE, waitForRoute } from "./fixtures/app";
import { expect, test } from "./fixtures/test";

test.describe("Project URLs", () => {
  test("keep UUID links through edits, reloads and legacy redirects", async ({ page }) => {
    await page.goto("/overview");
    const firstProject = page.getByRole("button", { name: "Create your first project" });
    await waitForRoute(firstProject);
    await firstProject.click();
    await expect(page).toHaveURL(ROUTE.metadata);
    const metadataUrl = page.url();
    const overviewUrl = metadataUrl.replace(/\/metadata$/, "");

    await page
      .getByLabel(/Project ID/)
      .first()
      .fill("KIEL-2025");
    await page.getByLabel(/Project Name/).fill("Kiel trial");
    await expect(page).toHaveURL(metadataUrl);
    await page.reload();
    await expect(page.getByLabel(/Project ID/).first()).toHaveValue("KIEL-2025");
    await expect(page).toHaveURL(metadataUrl);
    await page.goto("/overview");
    await expect(page).toHaveURL(overviewUrl);
    await page.goto("/project");
    await expect(page).toHaveURL(metadataUrl);

    await page.goto(overviewUrl);
    await page.getByRole("button", { name: /Create.*Experiment/i }).click();
    await expect(page).toHaveURL(ROUTE.experiment);
    const experimentUrl = page.url();
    await page
      .getByLabel(/Experiment ID/)
      .first()
      .fill("EXP-1");
    await page.getByLabel(/Experiment Name/).fill("Baseline");
    await expect(page).toHaveURL(experimentUrl);
    await page.goto("/experiment");
    await expect(page).toHaveURL(experimentUrl);

    await page.goto("/projects/KIEL-2025");
    await expect(page.getByRole("heading", { name: "Project not found" })).toBeVisible();
    await page.goto(`${overviewUrl}/experiments/GONE`);
    await expect(page.getByRole("heading", { name: "Experiment not found" })).toBeVisible();
    await page.getByRole("button", { name: "Back to project" }).click();
    await expect(page).toHaveURL(overviewUrl);
    await page.goto("/no/such/page");
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  });

  test("keep duplicate metadata IDs in separate, directly addressable drafts", async ({ page }) => {
    await page.goto("/overview");
    const firstProject = page.getByRole("button", { name: "Create your first project" });
    await waitForRoute(firstProject);
    await firstProject.click();
    await expect(page).toHaveURL(ROUTE.metadata);
    const firstUrl = page.url();
    await page
      .getByLabel(/Project ID/)
      .first()
      .fill("DUP");
    await page.getByLabel(/Project Name/).fill("First");
    const switcher = page.getByRole("button", { name: /Current project:/ });
    await switcher.click();
    await page.getByRole("menuitem", { name: "New project" }).click();
    await expect(page).toHaveURL(ROUTE.metadata);
    const secondUrl = page.url();
    expect(secondUrl).not.toBe(firstUrl);
    await page
      .getByLabel(/Project ID/)
      .first()
      .fill("DUP");
    await page.getByLabel(/Project Name/).fill("Second");

    await page.goto(firstUrl);
    await expect(page.getByLabel(/Project Name/)).toHaveValue("First");
    await expect(page.getByLabel(/Project ID/).first()).toHaveValue("DUP");
    await page.goto(secondUrl);
    await expect(page.getByLabel(/Project Name/)).toHaveValue("Second");
    await expect(page.getByLabel(/Project ID/).first()).toHaveValue("DUP");
  });
});
