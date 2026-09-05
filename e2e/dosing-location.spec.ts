import type { Page } from "@playwright/test";
import { createFromOverview, waitForRoute } from "./fixtures/app";
import { DosingLocationModal } from "./fixtures/map-modal";
import { expect, test } from "./fixtures/test";

const ORDER_ERROR = "North latitude must be greater than South latitude";

test.describe("Dosing Location Field", () => {
  let dosingModal: DosingLocationModal;

  test.beforeEach(async ({ page }) => {
    dosingModal = new DosingLocationModal(page);

    await createFromOverview(page, "Experiment");

    // The dosing location field only renders for an intervention experiment.
    const experimentTypes = page.locator("#root_experiment_types");
    await waitForRoute(experimentTypes);
    await experimentTypes.click();
    await page.getByRole("option", { name: "Intervention" }).click();
    await expect(page.getByText("Click to set dosing location")).toBeVisible();
  });

  async function openModal(page: Page) {
    await page.getByText("Click to set dosing location").click();
    await dosingModal.waitForMapLoad();
  }

  test("displays empty state with prompt to set location", async ({ page }) => {
    await expect(page.getByText("Click to set dosing location")).toBeVisible();
  });

  test("opens modal when clicking on the field", async ({ page }) => {
    await page.getByText("Click to set dosing location").click();
    await expect(dosingModal.heading).toBeVisible();
  });

  test("shows mode selector with three options", async ({ page }) => {
    await openModal(page);

    await dosingModal.modeSelect.click();

    await expect(page.getByRole("option", { name: "Fixed Point" })).toBeVisible();
    await expect(page.getByRole("option", { name: "Line" })).toBeVisible();
    await expect(page.getByRole("option", { name: "Provided as a file" })).toBeVisible();
  });

  test("Fixed Point mode: can enter coordinates manually", async ({ page }) => {
    await openModal(page);
    await dosingModal.selectMode("Fixed Point");

    await page.getByLabel("Latitude").fill("47.5");
    await page.getByLabel("Longitude").fill("-122.3");
    await dosingModal.confirm();

    // Verify coordinates are displayed on the field
    await expect(page.getByText(/47\.5.*-122\.3/)).toBeVisible();
  });

  test("Line mode: can enter coordinates manually", async ({ page }) => {
    await openModal(page);
    await dosingModal.selectMode("Line");

    // Mantine NumberInput converts on blur, so type each value then leave the field.
    const latInputs = page.locator("input[placeholder='Latitude']");
    const lonInputs = page.locator("input[placeholder='Longitude']");

    await latInputs.first().fill("47");
    await latInputs.first().blur();
    await lonInputs.first().fill("-123");
    await lonInputs.first().blur();
    await latInputs.last().fill("48");
    await latInputs.last().blur();
    await lonInputs.last().fill("-122");
    await lonInputs.last().blur();

    await dosingModal.confirm();
  });

  test("Box mode: shows file location input", async ({ page }) => {
    await openModal(page);
    await dosingModal.selectMode("Provided as a file");

    await expect(dosingModal.fileLocationInput()).toBeVisible();
  });

  // The globe default repeats the world at the edges. A click on a repeated copy
  // must still store a longitude the schema accepts.
  test("Fixed Point mode: a click on a repeated world stays within range", async ({ page }) => {
    await openModal(page);
    await dosingModal.selectMode("Fixed Point");

    const box = await dosingModal.mapCanvas.boundingBox();
    if (!box) throw new Error("Map canvas not found");

    // At the default zoom the whole canvas can sit inside the primary world, so
    // step out one level with the map's own keyboard handler. Zoom 0 makes the
    // world exactly 512px wide, which lets the expected longitude be computed.
    await dosingModal.mapCanvas.focus();
    await page.keyboard.press("-");
    await dosingModal.map.waitForZoom(0);

    const clickOffset = box.width / 2 - 8;
    const rawLon = (clickOffset / 512) * 360;
    // Would be pointless if the click were still in the primary world.
    expect(rawLon).toBeGreaterThan(180);
    await page.mouse.click(box.x + box.width - 8, box.y + box.height / 2);

    await expect(page.getByLabel("Longitude")).not.toHaveValue("");
    const lonText = await page.getByLabel("Longitude").inputValue();
    const latText = await page.getByLabel("Latitude").inputValue();
    expect(lonText).not.toBe("");
    expect(latText).not.toBe("");
    const lon = Number(lonText);
    const lat = Number(latText);
    expect(lon).toBeGreaterThanOrEqual(-180);
    expect(lon).toBeLessThanOrEqual(180);
    expect(Math.abs(lon - (rawLon - 360))).toBeLessThan(2);
    expect(lat).toBeGreaterThanOrEqual(-90);
    expect(lat).toBeLessThanOrEqual(90);
  });

  test("Box mode: flags north below south and blocks save", async ({ page }) => {
    await openModal(page);
    await dosingModal.selectMode("Provided as a file");
    await dosingModal.fillFileLocation("data/dosing.geojson");

    await dosingModal.fillBounds({ north: "40", south: "50", east: "-122", west: "-123" });
    await expect(page.getByText(ORDER_ERROR)).toBeVisible();
    await expect(dosingModal.confirmButton).toBeDisabled();

    await dosingModal.edge("north").fill("60");
    await expect(page.getByText(ORDER_ERROR)).toHaveCount(0);
    await expect(page.getByText("Decimal degrees")).toBeVisible();
    await expect(dosingModal.confirmButton).toBeEnabled();
  });

  test("Box mode: requires file location to save", async ({ page }) => {
    await openModal(page);
    await dosingModal.selectMode("Provided as a file");

    // Coordinates only, no file
    await dosingModal.fillBounds({ north: "48", south: "47", east: "-122", west: "-123" });
    await expect(dosingModal.confirmButton).toBeDisabled();

    await dosingModal.fillFileLocation("data/dosing.geojson");
    await expect(dosingModal.confirmButton).toBeEnabled();
  });

  // Switching modes rebuilds the map. The replacement has to be drawable, or
  // the draw hook keeps a handle on the disposed instance.
  test("can still draw after switching dosing modes", async ({ page }) => {
    await openModal(page);

    // Land on one mode first so the map is built, then switch.
    await dosingModal.selectMode("Line");
    await dosingModal.selectMode("Provided as a file");

    await dosingModal.startDrawing();
    await dosingModal.dragBoundingBox(-80, -40, 80, 40);

    for (const edge of ["north", "south", "east", "west"] as const) {
      await expect(dosingModal.edge(edge)).not.toHaveValue("");
    }
  });

  test("cancel button closes modal without saving", async ({ page }) => {
    await openModal(page);
    await dosingModal.selectMode("Fixed Point");

    await page.getByLabel("Latitude").fill("47.5");
    await page.getByLabel("Longitude").fill("-122.3");
    await dosingModal.cancel();

    // Verify the field still shows empty state
    await expect(page.getByText("Click to set dosing location")).toBeVisible();
  });

  test("map is disabled until mode is selected", async ({ page }) => {
    await openModal(page);

    await expect(page.getByText("Select location type to activate map")).toBeVisible();
  });
});
