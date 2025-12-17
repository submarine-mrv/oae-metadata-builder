import { Page, Locator, expect } from "@playwright/test";
import { BasePage } from "./base-page";

/**
 * Page object for the Project form page.
 */
export class ProjectPage extends BasePage {
  readonly spatialCoverageField: Locator;
  readonly spatialCoverageEditButton: Locator;
  readonly spatialCoverageCoordinateDisplay: Locator;

  constructor(page: Page) {
    super(page);

    // Spatial coverage field - the map preview area
    this.spatialCoverageField = page.locator("text=Spatial coverage").locator("..").locator("..").locator("[style*='height: 300px']");
    this.spatialCoverageEditButton = page.locator("[aria-label='Edit location']").first();
    this.spatialCoverageCoordinateDisplay = page.locator("text=Spatial coverage").locator("..").locator("..").locator("text=/^-?\\d+\\.\\d+/");
  }

  /**
   * Navigate to project page
   */
  async goto() {
    await super.goto("/project");
  }

  /**
   * Click on the spatial coverage field to open the map modal
   */
  async openSpatialCoverageModal() {
    // Find the map container by its content
    const mapField = this.page.locator("text=Click to set spatial coverage").first();
    await mapField.click();
  }

  /**
   * Check if spatial coverage has a value set
   */
  async hasSpatialCoverageValue(): Promise<boolean> {
    // Look for coordinate text (format: "W S E N" like "-180 -90 180 90")
    const coordText = this.page.locator("text=/^-?\\d+(\\.\\d+)?\\s+-?\\d+(\\.\\d+)?\\s+-?\\d+(\\.\\d+)?\\s+-?\\d+(\\.\\d+)?$/");
    return await coordText.isVisible();
  }

  /**
   * Get the current spatial coverage value
   */
  async getSpatialCoverageValue(): Promise<string | null> {
    const coordText = this.page.locator("[style*='font-family: monospace']").first();
    const text = await coordText.textContent();
    return text && text.trim() !== "Click the map to set bounding box" ? text : null;
  }
}
