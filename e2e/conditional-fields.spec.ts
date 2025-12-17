import { test, expect } from "@playwright/test";
import { ExperimentPage } from "./fixtures/experiment-page";

test.describe("Conditional Dropdown Fields", () => {
  let experimentPage: ExperimentPage;

  test.beforeEach(async ({ page }) => {
    experimentPage = new ExperimentPage(page);

    // Navigate to overview and create an experiment
    await page.goto("/overview");
    await page.waitForLoadState("networkidle");

    // Create a new experiment
    await page.getByRole("button", { name: /Create.*Experiment/i }).click();
    await page.waitForURL("**/experiment");
    await page.waitForLoadState("networkidle");

    // Select "Intervention" experiment type to get alkalinity feedstock fields
    await page.locator("#root_experiment_type").click();
    await page.waitForTimeout(200);
    await page.getByRole("option", { name: "Intervention" }).click();
    await page.waitForTimeout(500);
  });

  test.describe("Alkalinity Feedstock", () => {
    test("custom field is hidden by default", async ({ page }) => {
      // The custom field should not be visible initially
      const customInput = page.getByLabel("Alkalinity Feedstock (Custom)");
      await expect(customInput).not.toBeVisible();
    });

    test("selecting 'Other' shows custom input field", async ({ page }) => {
      // Click on the alkalinity feedstock dropdown
      await page.locator("#root_alkalinity_feedstock").click();
      await page.waitForTimeout(200);

      // Select "Other" option
      await page.getByRole("option", { name: "Other" }).click();
      await page.waitForTimeout(300);

      // Now the custom field should be visible
      const customInput = page.getByLabel("Alkalinity Feedstock (Custom)");
      await expect(customInput).toBeVisible({ timeout: 5000 });
    });

    test("can enter custom feedstock value", async ({ page }) => {
      // Select "Other"
      await page.locator("#root_alkalinity_feedstock").click();
      await page.waitForTimeout(200);
      await page.getByRole("option", { name: "Other" }).click();
      await page.waitForTimeout(300);

      // Fill in custom value
      const customInput = page.getByLabel("Alkalinity Feedstock (Custom)");
      await customInput.fill("Custom Mineral Compound");

      // Verify value is entered
      await expect(customInput).toHaveValue("Custom Mineral Compound");
    });

    test("switching away from 'Other' hides custom field", async ({ page }) => {
      // Select "Other" first
      await page.locator("#root_alkalinity_feedstock").click();
      await page.waitForTimeout(200);
      await page.getByRole("option", { name: "Other" }).click();
      await page.waitForTimeout(300);

      // Verify custom field is visible
      const customInput = page.getByLabel("Alkalinity Feedstock (Custom)");
      await expect(customInput).toBeVisible();

      // Fill in a value
      await customInput.fill("Custom Value");

      // Now switch to a different option (e.g., "Lime")
      await page.locator("#root_alkalinity_feedstock").click();
      await page.waitForTimeout(200);
      await page.getByRole("option", { name: "Lime" }).click();
      await page.waitForTimeout(300);

      // Custom field should now be hidden
      await expect(customInput).not.toBeVisible();
    });
  });

  test.describe("Alkalinity Feedstock Processing", () => {
    test("custom field is hidden by default", async ({ page }) => {
      const customInput = page.getByLabel("Alkalinity Feedstock Processing (Custom)");
      await expect(customInput).not.toBeVisible();
    });

    test("selecting 'Other' shows custom processing field", async ({ page }) => {
      // Click on the processing dropdown
      await page.locator("#root_alkalinity_feedstock_processing").click();
      await page.waitForTimeout(200);

      // Select "Other"
      await page.getByRole("option", { name: "Other" }).click();
      await page.waitForTimeout(300);

      // Custom field should be visible
      const customInput = page.getByLabel("Alkalinity Feedstock Processing (Custom)");
      await expect(customInput).toBeVisible({ timeout: 5000 });
    });

    test("can enter custom processing value", async ({ page }) => {
      // Select "Other"
      await page.locator("#root_alkalinity_feedstock_processing").click();
      await page.waitForTimeout(200);
      await page.getByRole("option", { name: "Other" }).click();
      await page.waitForTimeout(300);

      // Fill in custom value
      const customInput = page.getByLabel("Alkalinity Feedstock Processing (Custom)");
      await customInput.fill("Electrochemical Processing");

      // Verify value
      await expect(customInput).toHaveValue("Electrochemical Processing");
    });
  });

  // Note: JSON Preview tests are skipped as the toggle isn't currently exposed in the UI
  // These can be added once the JSON Preview toggle is available in the hamburger menu
});
