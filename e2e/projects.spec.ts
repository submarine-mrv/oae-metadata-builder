import { createFromOverview, waitForRoute } from "./fixtures/app";
import { expect, test } from "./fixtures/test";

test.describe("Multiple projects", () => {
  test("names follow the form, switching changes the overview, deleting removes a project", async ({
    page,
  }) => {
    await page.goto("/overview");
    const switcher = page.getByRole("button", { name: /Current project:/ });
    // No project yet: the brand reads as before and only the projects menu chevron shows.
    await waitForRoute(page.getByRole("button", { name: "Projects" }));
    await expect(page.getByRole("link", { name: "OAE Metadata Builder" })).toBeVisible();
    await expect(switcher).toHaveCount(0);

    // One project: still no crumb, whatever it's called.
    await createFromOverview(page, "Project");
    await page.getByLabel(/Research Project/).fill("Kiel trial");
    await expect(switcher).toHaveCount(0);

    // A second project from the menu starts unnamed on the project form, and the crumb appears.
    await page.getByRole("button", { name: "Projects" }).click();
    await page.getByRole("menuitem", { name: "New project" }).click();
    await expect(page).toHaveURL(/\/project$/);
    await expect(switcher).toHaveText("Unnamed Project");

    // Both are listed; opening the first lands on its overview.
    await switcher.click();
    await page.getByRole("menuitem", { name: /All projects/ }).click();
    await expect(page).toHaveURL(/\/projects$/);
    await expect(page.getByRole("button", { name: /^Open / })).toHaveCount(2);
    await page.getByRole("button", { name: "Open Kiel trial" }).click();
    await expect(page).toHaveURL(/\/overview$/);
    await expect(switcher).toHaveText("Kiel trial");

    // Persists across a reload.
    await page.reload();
    await waitForRoute(switcher);
    await expect(switcher).toHaveText("Kiel trial");

    // Delete the unnamed one from the list.
    await page.goto("/projects");
    await page.getByRole("button", { name: "Delete Unnamed Project" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete project" }).click();
    await expect(page.getByRole("button", { name: /^Open / })).toHaveCount(1);
    // Back to one project: the crumb goes away again.
    await expect(switcher).toHaveCount(0);
  });
});
