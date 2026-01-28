import { Page, Locator, expect } from "@playwright/test";
import { BasePage } from "./base-page";

/**
 * Page object for the Experiment form page.
 */
export class ExperimentPage extends BasePage {
  readonly dosingLocationField: Locator;
  readonly dosingLocationEditButton: Locator;

  constructor(page: Page) {
    super(page);

    // Dosing location field
    this.dosingLocationField = page.locator("text=Dosing Location").locator("..");
    this.dosingLocationEditButton = page.locator("text=Dosing Location").locator("..").locator("[aria-label='Edit location']");
  }

  /**
   * Navigate to experiment page
   */
  async goto() {
    await super.goto("/experiment");
  }

  /**
   * Open dosing location map modal
   */
  async openDosingLocationModal() {
    const mapField = this.page.locator("text=Click to set dosing location").first();
    // Wait for mini map to be ready before clicking
    await this.waitForMapLibre();
    await mapField.click();
  }

  /**
   * Check if dosing location has a value set
   */
  async hasDosingLocationValue(): Promise<boolean> {
    // Look for coordinate display
    const noValue = this.page.locator("text=/Click to set (point|line|dosing) location/");
    return !(await noValue.isVisible());
  }

  /**
   * Select a value from a dropdown by label
   */
  async selectDropdownOption(fieldLabel: string, optionLabel: string) {
    // Find the select/combobox by its label
    const selectContainer = this.page.locator(`text=${fieldLabel}`).locator("..").locator("..");
    const select = selectContainer.locator("[role='combobox'], input[role='searchbox']").first();

    await select.click();

    // Wait for dropdown to open and select option
    await this.page.waitForTimeout(200);
    await this.page.locator(`[role='option']:has-text("${optionLabel}")`).click();
  }

  /**
   * Check if a custom input field is visible (for "other" selections)
   */
  async isCustomInputVisible(fieldLabel: string): Promise<boolean> {
    const customInput = this.page.locator(`input[placeholder*="${fieldLabel}"], input[id*="custom"], input[id*="other"]`);
    return await customInput.isVisible().catch(() => false);
  }

  /**
   * Check if a field with matching text/label exists and is visible
   */
  async isFieldVisible(fieldText: string): Promise<boolean> {
    return await this.page.locator(`text=${fieldText}`).first().isVisible().catch(() => false);
  }

  /**
   * Fill in a custom/other text input
   */
  async fillCustomInput(value: string) {
    // Find the custom input - it's usually an input that appears after selecting "other"
    const customInput = this.page.locator("input").filter({ hasText: "" }).last();
    await customInput.fill(value);
  }
}
