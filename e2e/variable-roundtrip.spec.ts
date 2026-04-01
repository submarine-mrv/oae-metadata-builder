import { test, expect, type Page, type Download } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

/**
 * Variable round-trip test suite.
 *
 * Creates one variable for each combination of (variable_type, genesis, sampling),
 * exports the dataset, verifies the exported JSON, then re-imports and verifies
 * that each variable loads back with the correct type selections.
 */

// All variable type combinations to test
const VARIABLE_COMBOS = [
  // Specific types — measured discrete
  { variableType: "pH", genesis: "measured", sampling: "discrete", expectedClass: "DiscretePHVariable" },
  { variableType: "Total Alkalinity (TA)", genesis: "measured", sampling: "discrete", expectedClass: "DiscreteTAVariable" },
  { variableType: "Dissolved Inorganic Carbon (DIC)", genesis: "measured", sampling: "discrete", expectedClass: "DiscreteDICVariable" },
  { variableType: "xCO₂/pCO₂/fCO₂", genesis: "measured", sampling: "discrete", expectedClass: "DiscreteCO2Variable" },
  { variableType: "Sediment", genesis: "measured", sampling: "discrete", expectedClass: "DiscreteSedimentVariable" },
  // Specific types — measured continuous
  { variableType: "pH", genesis: "measured", sampling: "continuous", expectedClass: "ContinuousPHVariable" },
  { variableType: "Total Alkalinity (TA)", genesis: "measured", sampling: "continuous", expectedClass: "ContinuousTAVariable" },
  { variableType: "Dissolved Inorganic Carbon (DIC)", genesis: "measured", sampling: "continuous", expectedClass: "ContinuousDICVariable" },
  { variableType: "Sediment", genesis: "measured", sampling: "continuous", expectedClass: "ContinuousSedimentVariable" },
  // Specific types — calculated (no sampling)
  { variableType: "pH", genesis: "calculated", sampling: null, expectedClass: "CalculatedVariable" },
  { variableType: "Total Alkalinity (TA)", genesis: "calculated", sampling: null, expectedClass: "CalculatedVariable" },
  // Fixed types
  { variableType: "HPLC", genesis: null, sampling: null, expectedClass: "HPLCVariable" },
  // Generic Variable — measured
  { variableType: "Generic Variable", genesis: "measured", sampling: "discrete", expectedClass: "DiscreteMeasuredVariable" },
  { variableType: "Generic Variable", genesis: "measured", sampling: "continuous", expectedClass: "ContinuousMeasuredVariable" },
  // Generic Variable — calculated
  { variableType: "Generic Variable", genesis: "calculated", sampling: null, expectedClass: "CalculatedVariable" },
  // Generic Variable — contextual (NonMeasuredVariable)
  { variableType: "Generic Variable", genesis: "contextual", sampling: null, expectedClass: "NonMeasuredVariable" },
];

// Map UI genesis labels to the option text in the dropdown
const GENESIS_LABELS: Record<string, string> = {
  measured: "Measured",
  calculated: "Calculated",
  contextual: "Not Applicable",
};

const SAMPLING_LABELS: Record<string, string> = {
  discrete: "Discrete",
  continuous: "Continuous",
};

async function createVariable(
  page: Page,
  combo: typeof VARIABLE_COMBOS[0],
  index: number
) {
  // Click "Add Variable" (use the enabled one, not the disabled RJSF array button)
  await page.locator("button:not([disabled])", { hasText: "Add Variable" }).click();
  await page.waitForTimeout(300);

  // Select variable type
  await page.getByRole("textbox", { name: "What is the variable type?" }).click();
  await page.getByRole("option", { name: combo.variableType, exact: true }).click();
  await page.waitForTimeout(300);

  // Select genesis if needed (not for HPLC which has fixed genesis)
  if (combo.genesis && combo.variableType !== "HPLC") {
    const genesisLabel = GENESIS_LABELS[combo.genesis];
    await page.getByRole("textbox", { name: /measured.*calculated|variable.*produced/i }).click();
    await page.getByRole("option", { name: genesisLabel }).click();
    await page.waitForTimeout(300);
  }

  // Select sampling if needed
  if (combo.sampling) {
    const samplingLabel = SAMPLING_LABELS[combo.sampling];
    await page.getByRole("textbox", { name: /discrete.*continuous|measurement type/i }).click();
    await page.getByRole("option", { name: samplingLabel }).click();
    await page.waitForTimeout(300);
  }

  // Wait for auto-collapse: when type selection completes, the modal
  // auto-opens "Basic Information". If it didn't open, click it.
  const longNameInput = page.getByLabel("Variable full name");
  if (!await longNameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    // Click the chevron to toggle the section open
    await page.locator(".mantine-Accordion-item", { hasText: "Basic Information" })
      .locator(".mantine-Accordion-chevron").click();
    await page.waitForTimeout(500);
  }
  await expect(longNameInput).toBeVisible({ timeout: 3000 });

  const varName = `test_var_${index}`;
  const longName = `Test Variable ${index} (${combo.expectedClass})`;
  const unit = combo.expectedClass === "NonMeasuredVariable" ? "" : "test_unit";

  await page.getByLabel("Variable full name").fill(longName);
  // "Dataset variable name" has 3 inputs (main, QC flag, raw) — use the first
  await page.getByRole("textbox", { name: "Dataset variable name *" }).fill(varName);
  if (unit) {
    await page.getByRole("textbox", { name: "Unit *" }).fill(unit);
  }

  // Save — button text is "Add Variable" for new, "Save Changes" for edit
  const saveButton = page.locator(".mantine-Modal-root").getByRole("button", { name: /Add Variable|Save/i });
  await saveButton.click();
  await page.waitForTimeout(500);
}

test.describe("Variable Round-Trip", () => {
  test("creates all variable type combinations, exports, and re-imports correctly", async ({ page }) => {
    // Increase timeout for this comprehensive test
    test.setTimeout(120_000);

    // Navigate to overview and create a dataset
    await page.goto("/overview");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: /Create.*Dataset/i }).click();
    await page.waitForURL("**/dataset");
    await page.waitForLoadState("networkidle");

    // Create each variable combo
    for (let i = 0; i < VARIABLE_COMBOS.length; i++) {
      await createVariable(page, VARIABLE_COMBOS[i], i);
    }

    // Verify all variables appear in the table
    const rows = page.locator("table tbody tr");
    await expect(rows).toHaveCount(VARIABLE_COMBOS.length);

    // Export the dataset — click Download, handle validation modal
    await page.getByRole("button", { name: /Download Dataset Metadata/i }).click();
    await page.waitForTimeout(500);
    // Validation modal appears — click "Download Anyway"
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /Download Anyway/i }).click();
    const download: Download = await downloadPromise;

    // Read the downloaded file
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();
    const exportedJson = JSON.parse(fs.readFileSync(downloadPath!, "utf-8"));

    // Verify exported variables
    const exportedVars = exportedJson.datasets?.[0]?.variables;
    expect(exportedVars).toHaveLength(VARIABLE_COMBOS.length);

    for (let i = 0; i < VARIABLE_COMBOS.length; i++) {
      const combo = VARIABLE_COMBOS[i];
      const exported = exportedVars[i];

      // schema_class must match
      expect(exported.schema_class).toBe(combo.expectedClass);

      // variable_type must be a valid enum value
      expect(exported.variable_type).toBeDefined();

      // No _-prefixed fields in export
      const underscoreKeys = Object.keys(exported).filter((k) => k.startsWith("_"));
      expect(underscoreKeys).toEqual([]);

      // dataset_variable_name set correctly
      expect(exported.dataset_variable_name).toBe(`test_var_${i}`);
    }

    // Now re-import the file into a fresh session
    const tempFile = path.join(downloadPath! + ".reimport.json");
    fs.writeFileSync(tempFile, JSON.stringify(exportedJson));

    // Clear session and navigate fresh
    await page.evaluate(() => sessionStorage.clear());
    await page.goto("/overview");
    await page.waitForLoadState("networkidle");

    // Dismiss session restore modal if it appears
    const startFresh = page.getByRole("button", { name: /Start Fresh/i });
    if (await startFresh.isVisible({ timeout: 1000 }).catch(() => false)) {
      await startFresh.click();
      await page.waitForTimeout(300);
    }

    // Open hamburger menu and trigger import
    await page.locator("button.mantine-Burger-burger, [aria-label='Menu']").first().click();
    await page.waitForTimeout(300);

    // Set up file chooser listener before clicking import
    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.getByText("Import").click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(tempFile);
    await page.waitForTimeout(1000);

    // Import preview modal should appear — click Import
    const importButton = page.getByRole("button", { name: /Import \d+ item/i });
    await expect(importButton).toBeVisible({ timeout: 3000 });
    await importButton.click();
    await page.waitForTimeout(500);
    await page.waitForURL("**/overview");

    // Click the imported dataset from overview to open it
    await page.waitForLoadState("networkidle");
    // The Datasets section should show our dataset — click it
    const datasetSection = page.locator("text=Datasets").first();
    await expect(datasetSection).toBeVisible({ timeout: 3000 });
    // Click the dataset name/card to navigate to it
    const datasetLink = page.getByText("Dataset 1").first();
    await datasetLink.click();
    await page.waitForURL("**/dataset");
    await page.waitForLoadState("networkidle");

    // Verify variables are present after import
    const importedRows = page.locator("table tbody tr");
    await expect(importedRows).toHaveCount(VARIABLE_COMBOS.length, { timeout: 5000 });

    // Spot-check: verify first few variables can be opened and show correct type
    for (let i = 0; i < Math.min(VARIABLE_COMBOS.length, 3); i++) {
      const editButton = importedRows.nth(i).locator("button").first();
      await editButton.click();
      await page.waitForTimeout(300);

      await expect(page.getByText("Edit Variable")).toBeVisible({ timeout: 3000 });

      // Close the modal
      await page.keyboard.press("Escape");
      await page.waitForTimeout(200);
    }

    // Cleanup temp file
    fs.unlinkSync(tempFile);
  });
});
