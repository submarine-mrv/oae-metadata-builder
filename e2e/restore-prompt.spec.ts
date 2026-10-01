import { waitForRoute } from "./fixtures/app";
import { expect, test } from "./fixtures/test";

test.describe("Restore prompt", () => {
  test("a new tab with saved work asks once; starting fresh empties the workspace", async ({
    page,
    context,
  }) => {
    await page.goto("/overview");
    const firstProject = page.getByRole("button", { name: "Create your first project" });
    await waitForRoute(firstProject);
    await firstProject.click();
    await expect(page).toHaveURL(/\/project$/);

    // Reloading the same tab never asks.
    await page.reload();
    await expect(page.getByRole("button", { name: /Current project:/ })).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Restore previous session?" })).toHaveCount(0);

    // A new tab is a new session.
    const tab = await context.newPage();
    await tab.goto("/overview");
    const prompt = tab.getByRole("dialog", { name: "Restore previous session?" });
    await waitForRoute(prompt);
    await expect(prompt).toContainText("1 project saved");
    await expect(prompt).toContainText("Export in the header");

    await tab.getByRole("button", { name: "Start fresh" }).click();
    await expect(tab.getByRole("dialog", { name: "Start fresh?" })).toContainText(
      "removes 1 project",
    );
    await tab.getByRole("button", { name: "Remove all projects" }).click();

    await expect(tab.getByRole("button", { name: "Create your first project" })).toBeVisible();
    await tab.reload();
    await expect(tab.getByRole("button", { name: "Create your first project" })).toBeVisible();
    await expect(tab.getByRole("dialog")).toHaveCount(0);
  });
});
