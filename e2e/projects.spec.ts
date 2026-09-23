import { waitForRoute } from "./fixtures/app";
import { expect, test } from "./fixtures/test";

test.describe("Multiple projects", () => {
  test("first run, naming, switching, and deleting down to the welcome screen", async ({
    page,
  }) => {
    await page.goto("/overview");
    const switcher = page.getByRole("button", { name: /Current project:/ });
    const firstProject = page.getByRole("button", { name: "Create your first project" });

    // Empty workspace: welcome screen; no switcher, Export or tabs.
    await waitForRoute(firstProject);
    await expect(page.getByRole("link", { name: "OAE Metadata Builder" })).toBeVisible();
    await expect(switcher).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Export" })).toHaveCount(0);
    await expect(page.getByRole("radio", { name: "Experiments" })).toHaveCount(0);
    await expect(page).toHaveTitle("OAE Metadata Builder");

    // Form routes redirect while empty.
    await page.goto("/experiment");
    await expect(page).toHaveURL(/\/overview$/);

    // First project lands on the form; the crumb and tab title follow the name as it's typed.
    await firstProject.click();
    await expect(page).toHaveURL(/\/project$/);
    await expect(switcher).toHaveText("Unnamed Project");
    await page.getByLabel(/Research Project/).fill("Kiel trial");
    await expect(page).toHaveTitle("Kiel trial · OAE Metadata Builder");
    await expect(switcher).toHaveText("Kiel trial");

    // With a single project, the overview is headed by its name.
    await page
      .locator("label")
      .filter({ hasText: /^Overview$/ })
      .click();
    await expect(page).toHaveURL(/\/overview$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Kiel trial");

    // A second project from the menu starts unnamed on the project form.
    await switcher.click();
    await page.getByRole("menuitem", { name: "New project" }).click();
    await expect(page).toHaveURL(/\/project$/);
    await expect(switcher).toHaveText("Unnamed Project");

    // Switching from the menu lands on the other project's overview.
    await switcher.click();
    await page.getByRole("menuitem", { name: "Kiel trial" }).click();
    await expect(page).toHaveURL(/\/overview$/);
    await expect(switcher).toHaveText("Kiel trial");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Kiel trial");
    await switcher.click();
    await page.getByRole("menuitem", { name: "Unnamed Project" }).click();
    await expect(switcher).toHaveText("Unnamed Project");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Unnamed Project");

    // Both are listed; opening the first lands on its overview, headed by its name.
    await switcher.click();
    await page.getByRole("menuitem", { name: /All projects/ }).click();
    await expect(page).toHaveURL(/\/projects$/);
    await expect(page.getByRole("button", { name: /^Open / })).toHaveCount(2);
    await page.getByRole("button", { name: "Open Kiel trial" }).click();
    await expect(page).toHaveURL(/\/overview$/);
    await expect(switcher).toHaveText("Kiel trial");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Kiel trial");

    // Persists across a reload.
    await page.reload();
    await waitForRoute(switcher);
    await expect(switcher).toHaveText("Kiel trial");

    // Delete the unnamed one from the list; the crumb still names the remaining project.
    await page.goto("/projects");
    await page.getByRole("button", { name: "Delete Unnamed Project" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete project" }).click();
    await expect(page.getByRole("button", { name: /^Open / })).toHaveCount(1);
    await expect(switcher).toHaveText("Kiel trial");

    // Delete the last one: the list is gone and the welcome screen is back.
    await page.getByRole("button", { name: "Delete Kiel trial" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete project" }).click();
    await expect(page).toHaveURL(/\/overview$/);
    await expect(firstProject).toBeVisible();
    await expect(switcher).toHaveCount(0);

    // Deleting from the overview with two projects lands on the other one's overview.
    await firstProject.click();
    await expect(page).toHaveURL(/\/project$/);
    await page.getByLabel(/Research Project/).fill("Bergen trial");
    await expect(switcher).toHaveText("Bergen trial");
    await switcher.click();
    await page.getByRole("menuitem", { name: "New project" }).click();
    await expect(switcher).toHaveText("Unnamed Project");
    await page.goto("/overview");
    await page.getByRole("button", { name: "Delete project" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete project" }).click();
    await expect(page).toHaveURL(/\/overview$/);
    await expect(switcher).toHaveText("Bergen trial");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bergen trial");

    // Deleting the last one from its overview returns to the welcome screen.
    await page.getByRole("button", { name: "Delete project" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete project" }).click();
    await expect(firstProject).toBeVisible();
  });
});
