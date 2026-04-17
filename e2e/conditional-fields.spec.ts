import { test, expect } from "@playwright/test";
import * as path from "path";
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
    await page.locator("#root_experiment_types").click();
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

    test("custom field value is cleared when switching away from 'Other'", async ({ page }) => {
      // Select "Other" and fill in a custom value
      await page.locator("#root_alkalinity_feedstock").click();
      await page.waitForTimeout(200);
      await page.getByRole("option", { name: "Other" }).click();
      await page.waitForTimeout(300);

      const customInput = page.getByLabel("Alkalinity Feedstock (Custom)");
      await customInput.fill("My Custom Feedstock");
      await expect(customInput).toHaveValue("My Custom Feedstock");

      // Switch to a known option
      await page.locator("#root_alkalinity_feedstock").click();
      await page.waitForTimeout(200);
      await page.getByRole("option", { name: "Calcium Carbonate" }).click();
      await page.waitForTimeout(300);

      // Custom field should be hidden and removed from DOM
      await expect(customInput).not.toBeVisible();

      // Verify the custom field is actually not in the DOM (not just hidden)
      const customFieldCount = await page.locator("#root_alkalinity_feedstock_custom").count();
      expect(customFieldCount).toBe(0);

      // Switch back to "Other" - field should appear empty (value was cleared)
      await page.locator("#root_alkalinity_feedstock").click();
      await page.waitForTimeout(200);
      await page.getByRole("option", { name: "Other" }).click();
      await page.waitForTimeout(300);

      // The custom field should be visible again but EMPTY
      await expect(customInput).toBeVisible();
      await expect(customInput).toHaveValue("");
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

test.describe("Import preserves conditional field values", () => {
  const fixturePath = path.resolve(__dirname, "fixtures/conditional-import.json");

  test("alkalinity feedstock and processing custom values survive import", async ({ page }) => {
    // Import the fixture file
    await page.goto("/overview");
    await page.waitForLoadState("networkidle");

    // Dismiss session restore modal if it appears
    const startFresh = page.getByRole("button", { name: /Start Fresh/i });
    if (await startFresh.isVisible({ timeout: 1000 }).catch(() => false)) {
      await startFresh.click();
      await page.waitForTimeout(300);
    }

    // Open hamburger menu and trigger import
    await page.locator("button.mantine-Burger-burger, [aria-label='Menu']").first().click();
    await page.waitForTimeout(300);

    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.getByText("Import").click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(fixturePath);
    await page.waitForTimeout(1000);

    // Import preview modal — click Import
    const importButton = page.getByRole("button", { name: /Import \d+ item/i });
    await expect(importButton).toBeVisible({ timeout: 3000 });
    await importButton.click();
    await page.waitForTimeout(500);
    await page.waitForURL("**/overview");
    await page.waitForLoadState("networkidle");

    // Navigate to the first experiment (intervention with feedstock customs)
    await page.getByText("Conditional Fields Test").click();
    await page.waitForURL("**/experiment");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);

    // Verify alkalinity_feedstock_custom survived import
    const feedstockCustom = page.getByLabel("Alkalinity Feedstock (Custom)");
    await expect(feedstockCustom).toBeVisible({ timeout: 5000 });
    await expect(feedstockCustom).toHaveValue("Magnesium Oxide");

    // Verify alkalinity_feedstock_processing_custom survived import
    const processingCustom = page.getByLabel("Alkalinity Feedstock Processing (Custom)");
    await expect(processingCustom).toBeVisible({ timeout: 5000 });
    await expect(processingCustom).toHaveValue("Electrochemical Processing");
  });

  test("tracer form custom value survives import", async ({ page }) => {
    // Import the fixture file
    await page.goto("/overview");
    await page.waitForLoadState("networkidle");

    const startFresh = page.getByRole("button", { name: /Start Fresh/i });
    if (await startFresh.isVisible({ timeout: 1000 }).catch(() => false)) {
      await startFresh.click();
      await page.waitForTimeout(300);
    }

    await page.locator("button.mantine-Burger-burger, [aria-label='Menu']").first().click();
    await page.waitForTimeout(300);

    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.getByText("Import").click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(fixturePath);
    await page.waitForTimeout(1000);

    const importButton = page.getByRole("button", { name: /Import \d+ item/i });
    await expect(importButton).toBeVisible({ timeout: 3000 });
    await importButton.click();
    await page.waitForTimeout(500);
    await page.waitForURL("**/overview");
    await page.waitForLoadState("networkidle");

    // Navigate to the second experiment (tracer study with tracer_form_custom)
    await page.getByText("Tracer Conditional Test").click();
    await page.waitForURL("**/experiment");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);

    // Verify tracer_form_custom survived import
    const tracerCustom = page.getByLabel("Tracer Form (Custom)");
    await expect(tracerCustom).toBeVisible({ timeout: 5000 });
    await expect(tracerCustom).toHaveValue("Custom Tracer Compound");
  });
});
