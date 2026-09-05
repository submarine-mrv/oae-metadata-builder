import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Bounding box input labels, as rendered by BoundingBoxInputs.
 * Kept here so a wording change updates every spec at once.
 */
export const BOX_LABELS = {
  north: "North edge",
  south: "South edge",
  east: "East edge",
  west: "West edge",
} as const;

/** Names registered by exposeMapForTests (src/utils/mapTestHooks.ts). */
export const MAP_NAMES = {
  spatialModal: "spatial-coverage-modal",
  spatialPreview: "spatial-coverage-preview",
  dosingModal: "dosing-location-modal",
  dosingPreview: "dosing-location-preview",
} as const;

export type MapName = (typeof MAP_NAMES)[keyof typeof MAP_NAMES];

/**
 * Deterministic waits on one MapLibre instance, driven by the container
 * attributes and the dev-only registry that exposeMapForTests maintains.
 */
export class MapState {
  constructor(
    readonly page: Page,
    readonly name: MapName,
  ) {}

  container(): Locator {
    return this.page.locator(`[data-map-name="${this.name}"]`);
  }

  /** Instance counter for this container. Rebuilding the map bumps it. */
  async generation(): Promise<number> {
    return Number((await this.container().getAttribute("data-map-generation")) ?? 0);
  }

  /** MapLibre fired `load` for the current instance. The flag resets on `remove`. */
  async waitForLoad() {
    await expect(this.container()).toHaveAttribute("data-map-loaded", "true");
  }

  /** A new instance replaced the one that had `previous` as its generation, and it has loaded. */
  async waitForRebuild(previous: number) {
    await expect(this.container()).not.toHaveAttribute("data-map-generation", String(previous));
    await this.waitForLoad();
  }

  /** Style and sources loaded, no camera animation in flight. */
  async waitForIdle() {
    await this.page.waitForFunction((name) => {
      const map = (window as any).__oaeMaps?.get(name);
      return Boolean(map) && map.loaded() && !map.isMoving();
    }, this.name);
  }

  async waitForZoom(zoom: number, tolerance = 0.05) {
    await this.page.waitForFunction(
      ([name, target, tol]) => {
        const map = (window as any).__oaeMaps?.get(name);
        return Boolean(map) && !map.isMoving() && Math.abs(map.getZoom() - target) < tol;
      },
      [this.name, zoom, tolerance] as const,
    );
  }

  /** Geometry held by a GeoJSON source, or null when the source is absent. */
  async sourceGeometry(sourceId: string): Promise<unknown> {
    return this.page.evaluate(
      ([name, id]) => {
        const source = (window as any).__oaeMaps?.get(name)?.getSource(id);
        return source?.serialize?.().data?.geometry ?? null;
      },
      [this.name, sourceId] as const,
    );
  }
}

/**
 * Page object for map modal interactions.
 * Shared between SpatialCoverageMapModal and DosingLocationMapModal.
 */
export class MapModal {
  readonly page: Page;
  readonly modal: Locator;
  readonly heading: Locator;
  readonly mapCanvas: Locator;
  readonly prompt: Locator;
  readonly drawButton: Locator;
  readonly confirmButton: Locator;
  readonly cancelButton: Locator;
  readonly map: MapState;

  constructor(page: Page, mapName: MapName = MAP_NAMES.spatialModal) {
    this.page = page;
    this.modal = page
      .locator(".mantine-Modal-root")
      .filter({ hasText: /Select Bounding Box|Set Dosing Location/ });
    this.heading = page.getByRole("heading", { name: /Select Bounding Box|Set Dosing Location/ });
    // MapLibre labels its canvas as an accessible region.
    this.mapCanvas = this.modal.getByRole("region", { name: "Map" });
    this.prompt = this.modal.getByRole("status");
    this.drawButton = this.modal.getByRole("button", { name: /Draw Selection|Drawing\.\.\./ });
    this.confirmButton = this.modal.getByRole("button", { name: /^(Confirm|Save)$/ });
    this.cancelButton = this.modal.getByRole("button", { name: "Cancel" });
    this.map = new MapState(page, mapName);
  }

  /**
   * Heading visible, MapLibre `load` fired, React has seen it (the prompt has
   * moved past "Loading map..."), and the camera is idle.
   */
  async waitForMapLoad() {
    await expect(this.heading).toBeVisible();
    await this.map.waitForLoad();
    await expect(this.prompt).not.toHaveText("Loading map...");
    await this.map.waitForIdle();
  }

  /** Click Draw Selection and wait for the draw hook to arm. */
  async startDrawing() {
    await this.drawButton.click();
    await expect(this.drawButton).toBeDisabled();
  }

  private async canvasPoint(xOffset: number, yOffset: number) {
    const box = await this.mapCanvas.boundingBox();
    if (!box) throw new Error("Map canvas not found or not visible");
    return { x: box.x + box.width / 2 + xOffset, y: box.y + box.height / 2 + yOffset };
  }

  /**
   * Click on the map at a position relative to the map center
   * @param xOffset - Horizontal offset from center (positive = right)
   * @param yOffset - Vertical offset from center (positive = down)
   */
  async clickOnMap(xOffset = 0, yOffset = 0) {
    const { x, y } = await this.canvasPoint(xOffset, yOffset);
    await this.page.mouse.click(x, y);
  }

  /** Move the pointer over the map without clicking, to drive the draw preview. */
  async moveOnMap(xOffset = 0, yOffset = 0) {
    const { x, y } = await this.canvasPoint(xOffset, yOffset);
    await this.page.mouse.move(x, y, { steps: 5 });
  }

  /** Draw a shape with two clicks. The prompt confirms the first click armed it. */
  async drawBoundingBox(x1 = -100, y1 = -50, x2 = 100, y2 = 50) {
    await this.clickOnMap(x1, y1);
    await expect(this.prompt).toHaveText(/Release, or click again/);
    await this.clickOnMap(x2, y2);
  }

  /** Draw a shape by pressing, dragging and releasing. Exercises the rubber-band path. */
  async dragBoundingBox(x1 = -100, y1 = -50, x2 = 100, y2 = 50) {
    const from = await this.canvasPoint(x1, y1);
    const to = await this.canvasPoint(x2, y2);

    await this.page.mouse.move(from.x, from.y);
    await this.page.mouse.down();
    // Intermediate moves so the preview handler actually fires.
    await this.page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 5 });
    await this.page.mouse.move(to.x, to.y, { steps: 5 });
    await this.page.mouse.up();
  }

  /**
   * Draw a bounding box with a single-finger touch drag. Requires a context
   * created with `hasTouch: true`.
   *
   * The draw hook treats mouse events within 700 ms of a touch as replays of
   * it, so don't follow this with a mouse action in the same test.
   */
  async touchDragBoundingBox(x1 = -90, y1 = -50, x2 = 90, y2 = 50) {
    const from = await this.canvasPoint(x1, y1);
    const to = await this.canvasPoint(x2, y2);
    const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };

    const cdp = await this.page.context().newCDPSession(this.page);
    const send = (type: string, pt: { x: number; y: number } | null) =>
      cdp.send("Input.dispatchTouchEvent", {
        type,
        touchPoints: pt ? [{ x: pt.x, y: pt.y, radiusX: 1, radiusY: 1, force: 1 }] : [],
      });

    // Short gaps keep MapLibre's touch handler from coalescing the points.
    await send("touchStart", from);
    await this.page.waitForTimeout(80);
    await send("touchMove", mid);
    await this.page.waitForTimeout(80);
    await send("touchMove", to);
    await this.page.waitForTimeout(80);
    await send("touchEnd", null);
    await cdp.detach();
  }

  /** Geometry of the drawn or previewed shape in the given source. */
  async previewGeometry(sourceId = "bbox") {
    return this.map.sourceGeometry(sourceId);
  }

  /** Locator for one of the four bounding box inputs. */
  edge(name: keyof typeof BOX_LABELS): Locator {
    return this.page.getByLabel(BOX_LABELS[name]);
  }

  /** Fill all four edges at once. */
  async fillBounds(bounds: { north: string; south: string; east: string; west: string }) {
    await this.edge("west").fill(bounds.west);
    await this.edge("south").fill(bounds.south);
    await this.edge("east").fill(bounds.east);
    await this.edge("north").fill(bounds.north);
  }

  /** Confirm the selection and wait for the modal to close. */
  async confirm() {
    await this.confirmButton.click();
    await expect(this.modal).not.toBeVisible();
  }

  /** Cancel and wait for the modal to close. */
  async cancel() {
    await this.cancelButton.click();
    await expect(this.modal).not.toBeVisible();
  }
}

/**
 * Page object for the Dosing Location map modal.
 * Extends MapModal with mode selection.
 */
export class DosingLocationModal extends MapModal {
  readonly modeSelect: Locator;

  constructor(page: Page) {
    super(page, MAP_NAMES.dosingModal);
    this.modeSelect = page.getByRole("textbox", { name: "Dosing Location Type" });
  }

  /**
   * Pick a mode. Every mode change tears the map down and builds a new one, so
   * this resolves only once the replacement has loaded.
   */
  async selectMode(mode: "Fixed Point" | "Line" | "Provided as a file") {
    await this.map.waitForLoad();
    const before = await this.map.generation();

    await this.modeSelect.click();
    await this.page.getByRole("option", { name: mode }).click();
    await expect(this.modeSelect).toHaveValue(mode);

    await this.map.waitForRebuild(before);
    await expect(this.prompt).not.toHaveText("Loading map...");
  }

  async getCurrentMode(): Promise<string> {
    return (await this.modeSelect.inputValue()) || "";
  }

  /** Place a point marker by clicking the map. */
  async placePoint(xOffset = 0, yOffset = 0) {
    await this.clickOnMap(xOffset, yOffset);
  }

  /** Draw a line by clicking two points. */
  async drawLine(x1 = -100, y1 = 0, x2 = 100, y2 = 0) {
    await this.drawBoundingBox(x1, y1, x2, y2);
  }

  /** The file location input, rendered in box mode. */
  fileLocationInput(): Locator {
    return this.page.getByLabel("Dosing Location File");
  }

  async fillFileLocation(path: string) {
    await this.fileLocationInput().fill(path);
  }
}
