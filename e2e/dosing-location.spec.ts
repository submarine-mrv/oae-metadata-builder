import { test, expect } from "@playwright/test";
import { DosingLocationModal } from "./fixtures/map-modal";

test.describe("Dosing Location Field", () => {
  let dosingModal: DosingLocationModal;

  test.beforeEach(async ({ page }) => {
    dosingModal = new DosingLocationModal(page);

    // Navigate to overview and create an experiment
    await page.goto("/overview");
    await page.waitForLoadState("networkidle");

    // Create a new experiment
    await page.getByRole("button", { name: /Create.*Experiment/i }).click();
    await page.waitForURL("**/experiment");
    await page.waitForLoadState("networkidle");

    // Select "Intervention" experiment type to get dosing location field
    await page.locator("#root_experiment_type").click();
    await page.waitForTimeout(200);
    await page.getByRole("option", { name: "Intervention" }).click();
    await page.waitForTimeout(500);
  });

  test("displays empty state with prompt to set location", async ({ page }) => {
    // Check for the prompt text in the dosing location field
    const prompt = page.locator("text=Click to set dosing location");
    await expect(prompt).toBeVisible({ timeout: 10000 });
  });

  test("opens modal when clicking on the field", async ({ page }) => {
    // Click on the dosing location field
    await page.locator("text=Click to set dosing location").click();

    // Verify modal is open - use heading to be specific
    await expect(page.getByRole("heading", { name: "Set Dosing Location" })).toBeVisible();
  });

  test("shows mode selector with three options", async ({ page }) => {
    await page.locator("text=Click to set dosing location").click();
    await dosingModal.waitForMapLoad();

    // Click on the mode selector (use textbox role to be specific)
    await page.getByRole("textbox", { name: "Dosing Location Type" }).click();

    // Verify all three options are available
    await expect(page.getByRole("option", { name: "Fixed Point" })).toBeVisible();
    await expect(page.getByRole("option", { name: "Line" })).toBeVisible();
    await expect(page.getByRole("option", { name: "Provided as a file" })).toBeVisible();
  });

  test("Fixed Point mode: can enter coordinates manually", async ({ page }) => {
    await page.locator("text=Click to set dosing location").click();
    await dosingModal.waitForMapLoad();

    // Select Fixed Point mode
    await dosingModal.selectMode("Fixed Point");
    await page.waitForTimeout(300);

    // Enter coordinates
    await page.getByLabel("Latitude").fill("47.5");
    await page.getByLabel("Longitude").fill("-122.3");

    // Save
    await page.click("button:has-text('Save')");

    // Verify modal closes
    await expect(page.getByRole("heading", { name: "Set Dosing Location" })).not.toBeVisible();

    // Verify coordinates are displayed on the field
    await expect(page.locator("text=/47\\.5.*-122\\.3/")).toBeVisible();
  });

  test("Line mode: can enter coordinates manually", async ({ page }) => {
    await page.locator("text=Click to set dosing location").click();
    await dosingModal.waitForMapLoad();

    // Select Line mode
    await dosingModal.selectMode("Line");
    await page.waitForTimeout(300);

    // Fill in Point 1 and Point 2 coordinates using the placeholder selectors
    // Mantine NumberInput needs proper interaction to convert string to number
    const latInputs = page.locator("input[placeholder='Latitude']");
    const lonInputs = page.locator("input[placeholder='Longitude']");

    // Clear and type each value, then blur to trigger number conversion
    await latInputs.first().click();
    await latInputs.first().fill("47");
    await latInputs.first().blur();

    await lonInputs.first().click();
    await lonInputs.first().fill("-123");
    await lonInputs.first().blur();

    await latInputs.last().click();
    await latInputs.last().fill("48");
    await latInputs.last().blur();

    await lonInputs.last().click();
    await lonInputs.last().fill("-122");
    await lonInputs.last().blur();

    // Wait for state updates
    await page.waitForTimeout(300);

    // Save
    await page.click("button:has-text('Save')");
    await expect(page.getByRole("heading", { name: "Set Dosing Location" })).not.toBeVisible();
  });

  test("Box mode: shows file location input", async ({ page }) => {
    await page.locator("text=Click to set dosing location").click();
    await dosingModal.waitForMapLoad();

    // Select Box mode (Provided as a file)
    await page.getByRole("textbox", { name: "Dosing Location Type" }).click();
    await page.waitForTimeout(200);
    await page.getByRole("option", { name: "Provided as a file" }).click();
    await page.waitForTimeout(300);

    // Verify file location input is visible
    await expect(page.getByLabel("Dosing Location File")).toBeVisible();
  });

  test("Box mode: requires file location to save", async ({ page }) => {
    await page.locator("text=Click to set dosing location").click();
    await dosingModal.waitForMapLoad();

    // Select Box mode (Provided as a file)
    await page.getByRole("textbox", { name: "Dosing Location Type" }).click();
    await page.waitForTimeout(200);
    await page.getByRole("option", { name: "Provided as a file" }).click();
    await page.waitForTimeout(300);

    // Fill in coordinates only (no file)
    await page.getByLabel("°N (max latitude)").fill("48");
    await page.getByLabel("°S (min latitude)").fill("47");
    await page.getByLabel("°E (max longitude)").fill("-122");
    await page.getByLabel("°W (min longitude)").fill("-123");

    // Verify save button is disabled without file
    await expect(page.locator("button:has-text('Save')")).toBeDisabled();

    // Add file location
    await page.getByLabel("Dosing Location File").fill("data/dosing.geojson");

    // Now save should be enabled
    await expect(page.locator("button:has-text('Save')")).toBeEnabled();
  });

  test("cancel button closes modal without saving", async ({ page }) => {
    await page.locator("text=Click to set dosing location").click();
    await dosingModal.waitForMapLoad();

    // Enter some data
    await dosingModal.selectMode("Fixed Point");
    await page.waitForTimeout(300);
    await page.getByLabel("Latitude").fill("47.5");
    await page.getByLabel("Longitude").fill("-122.3");

    // Cancel
    await page.click("button:has-text('Cancel')");

    // Verify modal is closed
    await expect(page.getByRole("heading", { name: "Set Dosing Location" })).not.toBeVisible();

    // Verify the field still shows empty state
    await expect(page.locator("text=Click to set dosing location")).toBeVisible();
  });

  test("map is disabled until mode is selected", async ({ page }) => {
    await page.locator("text=Click to set dosing location").click();
    await dosingModal.waitForMapLoad();

    // Verify the overlay message
    await expect(page.locator("text=Select location type to activate map")).toBeVisible();
  });
});
