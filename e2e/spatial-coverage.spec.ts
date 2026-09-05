import { createFromOverview, waitForRoute } from "./fixtures/app";
import { MAP_NAMES, MapModal, MapState } from "./fixtures/map-modal";
import { ProjectPage } from "./fixtures/project-page";
import { expect, test } from "./fixtures/test";

test.describe("Spatial Coverage Field", () => {
  let projectPage: ProjectPage;
  let mapModal: MapModal;

  test.beforeEach(async ({ page }) => {
    projectPage = new ProjectPage(page);
    mapModal = new MapModal(page);

    await createFromOverview(page, "Project");
    await waitForRoute(page.getByText("Click to set spatial coverage"));
  });

  test("displays empty state with prompt to click map", async ({ page }) => {
    // Verify the empty state message is shown
    await expect(page.getByText("Click to set spatial coverage")).toBeVisible();

    // Verify no coordinates are displayed yet
    await expect(page.getByText("Click the map to set bounding box")).toBeVisible();
  });

  test("opens map modal when clicking on the field", async () => {
    await projectPage.openSpatialCoverageModal();

    await expect(mapModal.heading).toBeVisible();
    await mapModal.waitForMapLoad();
    await expect(mapModal.mapCanvas).toBeVisible();
  });

  test("can draw bounding box by clicking two points", async () => {
    await projectPage.openSpatialCoverageModal();
    await mapModal.waitForMapLoad();

    await mapModal.startDrawing();
    await expect(mapModal.prompt).toHaveText("Drag a box on the map, or click each corner.");

    await mapModal.drawBoundingBox(-100, -50, 100, 50);

    // Verify coordinate inputs have values
    await expect(mapModal.edge("north")).not.toHaveValue("");
  });

  test("shows a live preview between the two clicks", async () => {
    await projectPage.openSpatialCoverageModal();
    await mapModal.waitForMapLoad();
    await mapModal.startDrawing();

    // First corner only — the box should already be on the map.
    await mapModal.clickOnMap(-100, -50);
    await mapModal.moveOnMap(60, 40);
    // The prompt flips only once a start point is held, so the shape is being sized.
    await expect(mapModal.prompt).toHaveText("Release, or click again to complete the box.");

    // The preview is pushed into the map's bbox source, so moving the pointer
    // must change its geometry. Without this the test would pass even if
    // onPreview were never wired to the map.
    const before = await mapModal.previewGeometry();
    expect(before).not.toBeNull();
    await mapModal.moveOnMap(140, 90);
    await expect.poll(() => mapModal.previewGeometry()).not.toEqual(before);

    // Closing click commits it.
    await mapModal.clickOnMap(100, 50);
    await expect(mapModal.edge("north")).not.toHaveValue("");
  });

  for (const width of [320, 360, 390]) {
    test.describe(`${width}px viewport`, () => {
      test.use({ viewport: { width, height: 844 } });

      test("compass inputs fit the viewport", async () => {
        await projectPage.openSpatialCoverageModal();
        await mapModal.waitForMapLoad();

        // Every input must sit inside the viewport; the east one is the last to overflow.
        for (const edge of ["north", "south", "east", "west"] as const) {
          const box = await mapModal.edge(edge).boundingBox();
          expect(box, `${edge} edge is rendered`).not.toBeNull();
          expect(box!.x).toBeGreaterThanOrEqual(0);
          expect(box!.x + box!.width).toBeLessThanOrEqual(width);
        }
      });
    });
  }

  test.describe("touch", () => {
    // Touch emulation is a context option, so it needs its own describe.
    test.use({ hasTouch: true });

    test("can draw a bounding box by touch drag", async () => {
      await projectPage.openSpatialCoverageModal();
      await mapModal.waitForMapLoad();
      await mapModal.startDrawing();

      await mapModal.touchDragBoundingBox(-90, -50, 90, 50);

      for (const edge of ["north", "south", "east", "west"] as const) {
        await expect(mapModal.edge(edge)).not.toHaveValue("");
      }
    });
  });

  test("can draw a bounding box by dragging", async () => {
    await projectPage.openSpatialCoverageModal();
    await mapModal.waitForMapLoad();
    await mapModal.startDrawing();

    await mapModal.dragBoundingBox(-120, -60, 120, 60);

    for (const edge of ["north", "south", "east", "west"] as const) {
      await expect(mapModal.edge(edge)).not.toHaveValue("");
    }
    // Drawing has ended, so the button is offered again.
    await expect(mapModal.drawButton).toBeEnabled();
  });

  test("can enter coordinates manually", async ({ page }) => {
    await projectPage.openSpatialCoverageModal();
    await mapModal.waitForMapLoad();

    await mapModal.fillBounds({ west: "-125", south: "32", east: "-117", north: "42" });
    await mapModal.confirm();

    // Verify coordinates are displayed - empty state prompt should be hidden
    await expect(page.getByText("Click to set spatial coverage")).not.toBeVisible();
  });

  test("validates north must be greater than south", async ({ page }) => {
    await projectPage.openSpatialCoverageModal();
    await mapModal.waitForMapLoad();

    // Enter invalid coordinates where north < south
    await mapModal.edge("south").fill("50");
    await mapModal.edge("north").fill("30");

    await expect(
      page.getByText("North latitude must be greater than South latitude"),
    ).toBeVisible();
    await expect(mapModal.confirmButton).toBeDisabled();
  });

  test("cancel button closes modal without saving", async ({ page }) => {
    await projectPage.openSpatialCoverageModal();
    await mapModal.waitForMapLoad();

    await mapModal.fillBounds({ west: "-125", south: "32", east: "-117", north: "42" });
    await mapModal.cancel();

    // Verify the field still shows empty state
    await expect(page.getByText("Click the map to set bounding box")).toBeVisible();
  });

  test("preserves existing bounds when reopening modal", async ({ page }) => {
    await projectPage.openSpatialCoverageModal();
    await mapModal.waitForMapLoad();

    await mapModal.fillBounds({ west: "-125", south: "32", east: "-117", north: "42" });
    await mapModal.confirm();

    // Reopen the modal by clicking on the map region within the Spatial Coverage field
    await page.getByRole("region", { name: "Map" }).first().click();
    await mapModal.waitForMapLoad();

    // Verify the coordinates are preserved
    await expect(mapModal.edge("west")).toHaveValue("-125");
    await expect(mapModal.edge("south")).toHaveValue("32");
    await expect(mapModal.edge("east")).toHaveValue("-117");
    await expect(mapModal.edge("north")).toHaveValue("42");

    await mapModal.cancel();
  });

  test("updates mini map preview when coordinates are set", async ({ page }) => {
    await new MapState(page, MAP_NAMES.spatialPreview).waitForLoad();

    await projectPage.openSpatialCoverageModal();
    await mapModal.waitForMapLoad();

    await mapModal.fillBounds({ west: "-125", south: "32", east: "-117", north: "42" });
    await mapModal.confirm();

    // The overlay only shows while the field has no value.
    await expect(page.getByText("Click to set spatial coverage")).not.toBeVisible();
  });
});
