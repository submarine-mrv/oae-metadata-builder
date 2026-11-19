import { ROUTE, waitForRoute } from "./fixtures/app";
import { expect, test } from "./fixtures/test";

test.describe("Project URLs", () => {
  test("use human IDs, survive reloads, redirect old paths and report missing IDs", async ({
    page,
  }) => {
    await page.goto("/overview");
    const firstProject = page.getByRole("button", { name: "Create your first project" });
    await waitForRoute(firstProject);
    await firstProject.click();
    await expect(page).toHaveURL(ROUTE.metadata);

    // Typing a project ID moves the URL onto it.
    await page
      .getByLabel(/Project ID/)
      .first()
      .fill("KIEL-2025");
    await expect(page).toHaveURL(/\/projects\/KIEL-2025\/metadata$/);

    // Deep links survive a reload.
    await page.reload();
    await expect(page.getByLabel(/Project ID/).first()).toHaveValue("KIEL-2025");
    await expect(page).toHaveURL(/\/projects\/KIEL-2025\/metadata$/);

    // The old paths land on the active project's pages.
    await page.goto("/overview");
    await expect(page).toHaveURL(/\/projects\/KIEL-2025$/);
    await page.goto("/project");
    await expect(page).toHaveURL(/\/projects\/KIEL-2025\/metadata$/);

    // An experiment without an ID uses its internal ID, and its link opens it again.
    await page.goto("/projects/KIEL-2025");
    await page.getByRole("button", { name: /Create.*Experiment/i }).click();
    await expect(page).toHaveURL(ROUTE.experiment);
    const experimentUrl = page.url();
    await page.goto("/projects/KIEL-2025");
    await page.goto(experimentUrl);
    await expect(page).toHaveURL(experimentUrl);

    // IDs that match nothing get a 404 naming the ID.
    await page.goto("/projects/NOPE");
    await expect(page.getByRole("heading", { name: "Project not found" })).toBeVisible();
    await expect(page.getByText('Project ID "NOPE" can\'t be found')).toBeVisible();

    await page.goto("/projects/KIEL-2025/experiments/GONE");
    await expect(page.getByRole("heading", { name: "Experiment not found" })).toBeVisible();
    await page.getByRole("button", { name: "Back to project" }).click();
    await expect(page).toHaveURL(/\/projects\/KIEL-2025$/);

    await page.goto("/no/such/page");
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  });

  test("keep duplicate local drafts on internal-ID URLs", async ({ page }) => {
    await page.goto("/overview");
    const switcher = page.getByRole("button", { name: /Current project:/ });
    const firstProject = page.getByRole("button", { name: "Create your first project" });
    await waitForRoute(firstProject);
    await firstProject.click();
    await page.getByLabel(/Project Name/).fill("First");
    await page
      .getByLabel(/Project ID/)
      .first()
      .fill("DUP");
    await expect(page).toHaveURL(/\/projects\/DUP\/metadata$/);

    await switcher.click();
    await page.getByRole("menuitem", { name: "New project" }).click();
    await expect(page).toHaveURL(ROUTE.metadata);
    await page.getByLabel(/Project Name/).fill("Second");
    await page
      .getByLabel(/Project ID/)
      .first()
      .fill("DUP");
    await expect(page).not.toHaveURL(/\/projects\/DUP\/metadata$/);
    await expect(switcher).toHaveText("Second");
    const secondUrl = page.url();

    // Both drafts remain directly addressable, including after a reload.
    await switcher.click();
    await page.getByRole("menuitem", { name: /All projects/ }).click();
    await page.getByRole("button", { name: "Open First" }).click();
    await expect(page).not.toHaveURL(/\/projects\/DUP$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("First");
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("First");
    await page.goto("/projects/DUP");
    await expect(page.getByRole("heading", { name: "Project not found" })).toBeVisible();

    await page.goto(secondUrl);
    await page.getByRole("button", { name: "Click to edit", exact: true }).click();
    await page
      .getByLabel(/Project ID/)
      .first()
      .fill("");
    await expect(page).toHaveURL(secondUrl);
    await page.goto("/projects/DUP");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("First");
  });
});
