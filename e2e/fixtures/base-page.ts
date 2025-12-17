import { Page, Locator, expect } from "@playwright/test";

/**
 * Base page object with common functionality across all form pages.
 */
export class BasePage {
  readonly page: Page;
  readonly navigation: Locator;
  readonly hamburgerMenu: Locator;
  readonly jsonPreviewToggle: Locator;
  readonly jsonPreviewSidebar: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navigation = page.locator("nav, header").first();
    this.hamburgerMenu = page.getByRole("button", { name: /menu/i });
    this.jsonPreviewToggle = page.getByRole("switch", { name: /json preview/i });
    this.jsonPreviewSidebar = page.locator('[data-testid="json-preview"]');
  }

  /**
   * Navigate to a page and wait for it to load
   */
  async goto(path: string) {
    await this.page.goto(path);
    await this.page.waitForLoadState("networkidle");
  }

  /**
   * Open the hamburger menu
   */
  async openHamburgerMenu() {
    await this.hamburgerMenu.click();
    await this.page.waitForTimeout(200); // Wait for menu animation
  }

  /**
   * Toggle JSON preview sidebar via hamburger menu
   */
  async toggleJsonPreview() {
    await this.openHamburgerMenu();
    await this.jsonPreviewToggle.click();
    await this.page.waitForTimeout(200); // Wait for sidebar animation
  }

  /**
   * Get the current form data from JSON preview
   */
  async getJsonPreviewData(): Promise<object> {
    // Ensure JSON preview is visible
    const sidebar = this.page.locator("pre").filter({ hasText: "{" });
    await expect(sidebar).toBeVisible({ timeout: 5000 });

    const jsonText = await sidebar.textContent();
    if (!jsonText) {
      throw new Error("JSON preview is empty");
    }

    return JSON.parse(jsonText);
  }

  /**
   * Wait for map library to load
   */
  async waitForMapLibre() {
    await this.page.waitForFunction(() => {
      return typeof (window as any).maplibregl !== "undefined";
    }, { timeout: 10000 });
  }

  /**
   * Navigate to project page
   */
  async goToProject() {
    await this.page.click("text=Project");
    await this.page.waitForURL("**/project");
  }

  /**
   * Navigate to experiment page
   */
  async goToExperiment() {
    await this.page.click("text=Experiment");
    await this.page.waitForURL("**/experiment");
  }
}
