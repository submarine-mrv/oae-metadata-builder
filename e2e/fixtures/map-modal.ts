import { Page, Locator, expect } from "@playwright/test";

/**
 * Page object for map modal interactions.
 * Shared between SpatialCoverageMapModal and DosingLocationMapModal.
 */
export class MapModal {
  readonly page: Page;
  readonly modal: Locator;
  readonly mapCanvas: Locator;
  readonly confirmButton: Locator;
  readonly cancelButton: Locator;
  readonly clearButton: Locator;

  constructor(page: Page) {
    this.page = page;

    // Modal container - look for visible modal with content
    this.modal = page.locator(".mantine-Modal-root").filter({ hasText: /Select Bounding Box|Set Dosing Location/ });

    // Map canvas (MapLibre renders to a canvas element)
    this.mapCanvas = this.modal.locator("canvas").first();

    // Buttons
    this.confirmButton = this.modal.getByRole("button", { name: /confirm|save|apply/i });
    this.cancelButton = this.modal.getByRole("button", { name: /cancel|close/i });
    this.clearButton = this.modal.getByRole("button", { name: /clear/i });
  }

  /**
   * Wait for the map modal to be visible and loaded
   */
  async waitForMapLoad() {
    // Wait for the modal heading to be visible (more reliable than modal container)
    const modalHeading = this.page.getByRole("heading", { name: /Select Bounding Box|Set Dosing Location/i });
    await expect(modalHeading).toBeVisible({ timeout: 5000 });

    // Wait for the map to finish loading
    await this.page.waitForFunction(() => {
      const canvas = document.querySelector(".mantine-Modal-root canvas");
      return canvas && (canvas as HTMLCanvasElement).width > 0;
    }, { timeout: 10000 });

    // Give map tiles a moment to load
    await this.page.waitForTimeout(500);
  }

  /**
   * Click on the map at a specific position relative to the map center
   * @param xOffset - Horizontal offset from center (positive = right)
   * @param yOffset - Vertical offset from center (positive = down)
   */
  async clickOnMap(xOffset: number = 0, yOffset: number = 0) {
    const box = await this.mapCanvas.boundingBox();
    if (!box) {
      throw new Error("Map canvas not found or not visible");
    }

    const clickX = box.x + box.width / 2 + xOffset;
    const clickY = box.y + box.height / 2 + yOffset;

    await this.page.mouse.click(clickX, clickY);
    await this.page.waitForTimeout(200); // Wait for click handler
  }

  /**
   * Draw a bounding box on the map by clicking two points
   * @param x1 - First corner X offset from center
   * @param y1 - First corner Y offset from center
   * @param x2 - Second corner X offset from center
   * @param y2 - Second corner Y offset from center
   */
  async drawBoundingBox(
    x1: number = -100,
    y1: number = -50,
    x2: number = 100,
    y2: number = 50
  ) {
    // Click first corner
    await this.clickOnMap(x1, y1);

    // Wait a moment for the first click to register
    await this.page.waitForTimeout(300);

    // Click second corner
    await this.clickOnMap(x2, y2);
  }

  /**
   * Confirm the selection and close the modal
   */
  async confirm() {
    await this.confirmButton.click();
    await expect(this.modal).not.toBeVisible({ timeout: 3000 });
  }

  /**
   * Cancel and close the modal
   */
  async cancel() {
    await this.cancelButton.click();
    await expect(this.modal).not.toBeVisible({ timeout: 3000 });
  }

  /**
   * Clear the current selection
   */
  async clear() {
    await this.clearButton.click();
    await this.page.waitForTimeout(200);
  }

  /**
   * Check if the modal is visible
   */
  async isVisible(): Promise<boolean> {
    return await this.modal.isVisible();
  }

  /**
   * Get coordinate inputs if they exist in the modal
   */
  getCoordinateInputs() {
    return {
      west: this.modal.locator("input").filter({ has: this.page.locator("text=West, label=West") }).first(),
      south: this.modal.locator("input").filter({ has: this.page.locator("text=South, label=South") }).first(),
      east: this.modal.locator("input").filter({ has: this.page.locator("text=East, label=East") }).first(),
      north: this.modal.locator("input").filter({ has: this.page.locator("text=North, label=North") }).first(),
    };
  }

  /**
   * Fill coordinate inputs directly
   */
  async fillCoordinates(west: number, south: number, east: number, north: number) {
    await this.modal.getByLabel("West").fill(String(west));
    await this.modal.getByLabel("South").fill(String(south));
    await this.modal.getByLabel("East").fill(String(east));
    await this.modal.getByLabel("North").fill(String(north));
  }
}

/**
 * Page object for Dosing Location map modal.
 * Extends MapModal with mode selection functionality.
 */
export class DosingLocationModal extends MapModal {
  constructor(page: Page) {
    super(page);
  }

  /**
   * Select the dosing location mode
   */
  async selectMode(mode: "Fixed Point" | "Line" | "Bounding Box") {
    // Use textbox role which is more reliable for Mantine Select
    await this.page.getByRole("textbox", { name: "Dosing Location Type" }).click();
    await this.page.waitForTimeout(200);
    await this.page.getByRole("option", { name: mode }).click();
    await this.page.waitForTimeout(200);
  }

  /**
   * Get the currently selected mode
   */
  async getCurrentMode(): Promise<string> {
    const select = this.page.getByRole("textbox", { name: "Dosing Location Type" });
    const text = await select.inputValue();
    return text || "";
  }

  /**
   * Place a point marker by clicking the map
   */
  async placePoint(xOffset: number = 0, yOffset: number = 0) {
    await this.clickOnMap(xOffset, yOffset);
  }

  /**
   * Draw a line by clicking two points
   */
  async drawLine(
    x1: number = -100,
    y1: number = 0,
    x2: number = 100,
    y2: number = 0
  ) {
    await this.clickOnMap(x1, y1);
    await this.page.waitForTimeout(300);
    await this.clickOnMap(x2, y2);
  }

  /**
   * Get the file location input (only visible in box mode)
   */
  getFileLocationInput(): Locator {
    return this.modal.locator("input[placeholder*='file'], input[id*='file']").first();
  }

  /**
   * Fill the file location input
   */
  async fillFileLocation(path: string) {
    await this.getFileLocationInput().fill(path);
  }
}
