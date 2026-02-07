import { test, expect } from "@playwright/test";
import { ProjectPage } from "./fixtures/project-page";
import { MapModal } from "./fixtures/map-modal";

test.describe("Spatial Coverage Field", () => {
  let projectPage: ProjectPage;
  let mapModal: MapModal;

  test.beforeEach(async ({ page }) => {
    projectPage = new ProjectPage(page);
    mapModal = new MapModal(page);

    // Navigate to overview and create a project first
    await page.goto("/overview");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: /Create.*Project/i }).click();
    await page.waitForURL("**/project");
    await page.waitForLoadState("networkidle");
  });

  test("displays empty state with prompt to click map", async ({ page }) => {
    // Verify the empty state message is shown
    await expect(page.locator("text=Click to set spatial coverage")).toBeVisible();

    // Verify no coordinates are displayed yet
    const coordDisplay = page.locator("text=Click the map to set bounding box");
    await expect(coordDisplay).toBeVisible();
  });

  test("opens map modal when clicking on the field", async ({ page }) => {
    // Click on the spatial coverage area
    await projectPage.openSpatialCoverageModal();

    // Verify modal is open
    await expect(page.locator("text=Select Bounding Box")).toBeVisible();

    // Verify map canvas is present
    await mapModal.waitForMapLoad();
    await expect(mapModal.mapCanvas).toBeVisible();
  });

  test("can draw bounding box by clicking two points", async ({ page }) => {
    // Open the modal
    await projectPage.openSpatialCoverageModal();
    await mapModal.waitForMapLoad();

    // Click the Draw Selection button
    await page.click("button:has-text('Draw Selection')");

    // Verify the instruction text
    await expect(page.locator("text=Click first point to start selection")).toBeVisible();

    // Draw a bounding box
    await mapModal.drawBoundingBox(-100, -50, 100, 50);

    // Wait for coordinates to be calculated
    await page.waitForTimeout(500);

    // Verify coordinate inputs have values
    const northInput = page.locator("input").filter({ has: page.locator("[for]") }).first();
    await expect(page.getByLabel("°N (max latitude)")).not.toHaveValue("");
  });

  test("can enter coordinates manually", async ({ page }) => {
    await projectPage.openSpatialCoverageModal();
    await mapModal.waitForMapLoad();

    // Fill in coordinate inputs
    await page.getByLabel("°W (west edge)").fill("-125");
    await page.getByLabel("°S (min latitude)").fill("32");
    await page.getByLabel("°E (east edge)").fill("-117");
    await page.getByLabel("°N (max latitude)").fill("42");

    // Confirm the selection
    await page.click("button:has-text('Confirm')");

    // Verify modal is closed
    await expect(page.getByRole("heading", { name: "Select Bounding Box" })).not.toBeVisible();

    // Verify coordinates are displayed - empty state prompt should be hidden
    await expect(page.locator("text=Click to set spatial coverage")).not.toBeVisible();
  });

  test("validates north must be greater than south", async ({ page }) => {
    await projectPage.openSpatialCoverageModal();
    await mapModal.waitForMapLoad();

    // Enter invalid coordinates where north < south
    await page.getByLabel("°S (min latitude)").fill("50");
    await page.getByLabel("°N (max latitude)").fill("30");

    // Verify error message appears
    await expect(page.locator("text=North latitude must be greater than South latitude")).toBeVisible();

    // Verify confirm button is disabled
    const confirmButton = page.locator("button:has-text('Confirm')");
    await expect(confirmButton).toBeDisabled();
  });

  test("cancel button closes modal without saving", async ({ page }) => {
    await projectPage.openSpatialCoverageModal();
    await mapModal.waitForMapLoad();

    // Enter some coordinates
    await page.getByLabel("°W (west edge)").fill("-125");
    await page.getByLabel("°S (min latitude)").fill("32");
    await page.getByLabel("°E (east edge)").fill("-117");
    await page.getByLabel("°N (max latitude)").fill("42");

    // Cancel
    await page.click("button:has-text('Cancel')");

    // Verify modal is closed
    await expect(page.locator("text=Select Bounding Box")).not.toBeVisible();

    // Verify the field still shows empty state
    await expect(page.locator("text=Click the map to set bounding box")).toBeVisible();
  });

  test("preserves existing bounds when reopening modal", async ({ page }) => {
    // First set some coordinates
    await projectPage.openSpatialCoverageModal();
    await mapModal.waitForMapLoad();

    await page.getByLabel("°W (west edge)").fill("-125");
    await page.getByLabel("°S (min latitude)").fill("32");
    await page.getByLabel("°E (east edge)").fill("-117");
    await page.getByLabel("°N (max latitude)").fill("42");
    await page.click("button:has-text('Confirm')");
    await page.waitForTimeout(500);

    // Reopen the modal by clicking on the map region within the Spatial Coverage field
    await page.getByRole("region", { name: "Map" }).first().click();
    await mapModal.waitForMapLoad();

    // Verify the coordinates are preserved
    await expect(page.getByLabel("°W (west edge)")).toHaveValue("-125");
    await expect(page.getByLabel("°S (min latitude)")).toHaveValue("32");
    await expect(page.getByLabel("°E (east edge)")).toHaveValue("-117");
    await expect(page.getByLabel("°N (max latitude)")).toHaveValue("42");

    await page.click("button:has-text('Cancel')");
  });

  test("updates mini map preview when coordinates are set", async ({ page }) => {
    // Wait for mini map to load
    await projectPage.waitForMapLibre();

    // Set coordinates
    await projectPage.openSpatialCoverageModal();
    await mapModal.waitForMapLoad();

    await page.getByLabel("°W (west edge)").fill("-125");
    await page.getByLabel("°S (min latitude)").fill("32");
    await page.getByLabel("°E (east edge)").fill("-117");
    await page.getByLabel("°N (max latitude)").fill("42");
    await page.click("button:has-text('Confirm')");

    // Wait for mini map to update
    await page.waitForTimeout(1000);

    // Verify the overlay "Click to set" is hidden (meaning the mini map shows the selection)
    await expect(page.locator("text=Click to set spatial coverage")).not.toBeVisible();
  });
});
