import type { Locator, Page } from "@playwright/test";
import { BasePage } from "./base-page";

/**
 * Page object for the Project form page.
 */
export class ProjectPage extends BasePage {
  readonly spatialCoverageEditButton: Locator;

  constructor(page: Page) {
    super(page);
    this.spatialCoverageEditButton = page.getByRole("button", { name: "Edit location" });
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
    await this.page.getByText("Click to set spatial coverage").click();
  }

  /**
   * Check if spatial coverage has a value set
   */
  async hasSpatialCoverageValue(): Promise<boolean> {
    // Look for coordinate text (SOSO format: "minLat minLon maxLat maxLon" like "36.8 -124.5 38.2 -121.9")
    const coordText = this.page.locator(
      "text=/^-?\\d+(\\.\\d+)?\\s+-?\\d+(\\.\\d+)?\\s+-?\\d+(\\.\\d+)?\\s+-?\\d+(\\.\\d+)?$/",
    );
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
