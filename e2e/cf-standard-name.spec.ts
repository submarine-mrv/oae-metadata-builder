import { expect, type Download, type Page, test } from "@playwright/test";
import * as fs from "fs";

/**
 * CF Standard Name picker.
 *
 * Covers the two modes (locked shortlist for pH/TA/DIC/CO₂, full searchable list
 * for everything else), what a selection prefills, and that a user-typed unit goes
 * straight into `units` with no `_custom` sibling.
 */

const CF_PICKER = 'button[aria-label="CF standard name"]';

async function createDataset(page: Page) {
  await page.goto("/overview");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /Create.*Dataset/i }).click();
  await page.waitForURL("**/dataset");
  await page.waitForLoadState("networkidle");
}

async function openVariableModal(page: Page) {
  await page.locator("button:not([disabled])", { hasText: "Add Variable" }).click();
  await page.waitForTimeout(300);
}

async function chooseType(page: Page, type: string, genesis?: string, sampling?: string) {
  await page.getByRole("textbox", { name: "What is the variable type?" }).click();
  await page.getByRole("option", { name: type, exact: true }).click();
  await page.waitForTimeout(200);

  if (genesis) {
    await page.getByRole("textbox", { name: /measured.*calculated|variable.*produced/i }).click();
    await page.getByRole("option", { name: genesis }).click();
    await page.waitForTimeout(200);
  }
  if (sampling) {
    await page.getByRole("textbox", { name: /discrete.*continuous|measurement type/i }).click();
    await page.getByRole("option", { name: sampling }).click();
    await page.waitForTimeout(200);
  }
  await expect(page.getByLabel("Variable full name")).toBeVisible({ timeout: 3000 });
}

/**
 * Opens the picker and returns its option list, waiting for the lazy CF index.
 *
 * `aria-controls` names the listbox, not the whole dropdown, so the search box is a
 * sibling of what this returns and has to be located from the page.
 */
async function openPicker(page: Page) {
  const trigger = page.locator(CF_PICKER);
  await trigger.click();
  const dropdownId = await trigger.getAttribute("aria-controls");
  const options = page.locator(`#${dropdownId}`);
  await expect(options.getByRole("option").first()).toBeVisible({ timeout: 10_000 });
  return options;
}

const cfSearch = (page: Page) => page.getByPlaceholder("Search CF standard names…");

/**
 * Switches the dataset to model output, which swaps the variable type vocabulary to
 * ModelVariableType. The select has no accessible name of its own — FieldLabel
 * renders the label as a sibling paragraph — so it is reached by its RJSF id.
 */
async function selectModelOutput(page: Page) {
  await page.locator("#root_dataset_type").click();
  await page.getByRole("option", { name: "Model Output", exact: true }).click();
  await page.waitForTimeout(500);
}

test.describe("CF Standard Name", () => {
  test("restricts pH to its shortlist and prefills from the selection", async ({ page }) => {
    await createDataset(page);
    await openVariableModal(page);
    await chooseType(page, "pH", "Measured", "Discrete");

    const dropdown = await openPicker(page);
    // The one curated pH name plus the always-present "Other".
    await expect(dropdown.getByRole("option")).toHaveCount(2);

    await dropdown.getByRole("option").first().click();

    await expect(page.locator(CF_PICKER)).toHaveText("sea_water_ph_reported_on_total_scale");
    await expect(page.getByLabel("Variable full name")).toHaveValue("pH");

    // Units are suggested, never filled in: pH is reported on a named scale, not
    // CF's dimensionless canonical "1".
    await expect(page.getByRole("textbox", { name: "Unit *" })).toHaveValue("");

    // Never prefilled — it names a column in the user's own data file.
    await expect(page.getByRole("textbox", { name: "Dataset variable name *" })).toHaveValue("");

    await expect(page.getByRole("link", { name: /View on NERC NVS/ })).toHaveAttribute(
      "href",
      "http://vocab.nerc.ac.uk/collection/P07/current/CF14N56/",
    );
  });

  test("sets concentration_basis from the DIC name", async ({ page }) => {
    await createDataset(page);
    await openVariableModal(page);
    await chooseType(page, "Dissolved Inorganic Carbon (DIC)", "Measured", "Discrete");

    const dropdown = await openPicker(page);
    // Two curated DIC names plus the always-present "Other".
    await expect(dropdown.getByRole("option")).toHaveCount(3);
    await dropdown.getByRole("option", { name: /per_unit_mass/ }).click();

    await expect(
      page.getByRole("textbox", { name: "Per-volume vs per-mass based units *" }),
    ).toHaveValue("Per Mass");

    // The unit is offered, not applied.
    await expect(page.getByRole("textbox", { name: "Unit *" })).toHaveValue("");
    await page.getByRole("textbox", { name: "Unit *" }).click();
    await expect(page.getByRole("option", { name: "umol kg-1", exact: true })).toBeVisible();
  });

  test("drops a standard name the new variable type does not allow", async ({ page }) => {
    await createDataset(page);
    await openVariableModal(page);
    await chooseType(page, "pH", "Measured", "Discrete");

    const dropdown = await openPicker(page);
    await dropdown.getByRole("option").first().click();
    await expect(page.getByLabel("Variable full name")).toHaveValue("pH");

    // Switch to DIC, which has its own shortlist and does not include the pH name.
    await page.locator(".mantine-Accordion-item", { hasText: "Variable Type" }).click();
    await chooseType(page, "Dissolved Inorganic Carbon (DIC)", "Measured", "Discrete");

    await expect(page.locator(CF_PICKER)).toHaveText("Select a CF standard name…");
    await expect(page.getByLabel("Variable full name")).toHaveValue("");
  });

  test("offers model-only quantities their own suggestions", async ({ page }) => {
    await createDataset(page);
    await selectModelOutput(page);
    await openVariableModal(page);

    await page.getByRole("textbox", { name: "What is the variable type?" }).click();
    // Model-mode options append a "required by the OAE Data Protocol" note.
    await page.getByRole("option", { name: /^Salinity/ }).click();
    await expect(page.getByLabel("Variable full name")).toBeVisible({ timeout: 3000 });

    const dropdown = await openPicker(page);
    await expect(dropdown.getByRole("option", { name: /sea_water_absolute_salinity/ })).toBeVisible();
    await expect(dropdown.getByRole("option", { name: /sea_water_practical_salinity/ })).toBeVisible();
    await dropdown.getByRole("option", { name: /sea_water_absolute_salinity/ }).click();

    await expect(page.getByLabel("Variable full name")).toHaveValue("absolute salinity");
    await page.getByRole("textbox", { name: "Unit *" }).click();
    await expect(page.getByRole("option", { name: "g kg-1", exact: true })).toBeVisible();
  });

  test("switches a shortlist into the full table and back", async ({ page }) => {
    await createDataset(page);
    await openVariableModal(page);
    await chooseType(page, "pH", "Measured", "Discrete");

    const dropdown = await openPicker(page);
    await expect(page.getByText("Suggested for pH")).toBeVisible();

    await page.getByRole("button", { name: /Search all standard names/ }).click();
    await expect(cfSearch(page)).toBeVisible();
    await expect(page.getByText(/Showing 100 of \d{4} matches/)).toBeVisible();

    await page.getByRole("button", { name: /Back to suggested names/ }).click();
    await expect(page.getByText("Suggested for pH")).toBeVisible();
    await expect(cfSearch(page)).toBeHidden();
  });

  test("Other records no standard name at all", async ({ page }) => {
    await createDataset(page);
    await openVariableModal(page);
    await chooseType(page, "pH", "Measured", "Discrete");

    const dropdown = await openPicker(page);
    await dropdown.getByRole("option").first().click();
    await expect(page.locator(CF_PICKER)).toHaveText("sea_water_ph_reported_on_total_scale");

    await openPicker(page);
    await page.getByRole("option", { name: /Other \(no standard name listed\)/ }).click();
    await expect(page.locator(CF_PICKER)).toHaveText("Other (no standard name listed)");

    await page.getByLabel("Variable full name").fill("Bottle pH");
    await page.getByRole("textbox", { name: "Unit *" }).fill("Total Scale");
    await page.getByRole("textbox", { name: "Dataset variable name *" }).fill("pH_total");
    await page
      .locator(".mantine-Modal-root")
      .getByRole("button", { name: /Add Variable|Save/i })
      .click();
    await page.waitForTimeout(500);

    await page.getByRole("button", { name: /Export/i }).click();
    await page.waitForTimeout(500);
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /Download Anyway/i }).click();
    const download: Download = await downloadPromise;
    const exported = JSON.parse(fs.readFileSync((await download.path())!, "utf-8"));

    expect(exported.datasets[0].variables[0]).not.toHaveProperty("standard_identifier");
  });

  test("searches the whole CF table for a type with no shortlist", async ({ page }) => {
    await createDataset(page);
    await openVariableModal(page);
    await chooseType(page, "Sediment", "Measured", "Discrete");

    const dropdown = await openPicker(page);
    await expect(page.getByText(/Showing 100 of \d{4} matches/)).toBeVisible();

    // Words the user actually types, not the connecting words CF puts between them.
    await cfSearch(page).fill("organic carbon sea floor sediment");
    const option = dropdown.getByRole("option", {
      name: /mass_concentration_of_organic_carbon_in_sea_floor_sediment/,
    });
    await expect(option).toBeVisible();
    await option.click();

    await expect(page.getByLabel("Variable full name")).toHaveValue(
      "mass concentration of organic carbon in sea floor sediment",
    );
    // Suggestions come from the lazily-loaded index, not the shortlist, for this type.
    await expect(page.getByRole("textbox", { name: "Unit *" })).toHaveValue("");
    await page.getByRole("textbox", { name: "Unit *" }).click();
    await expect(page.getByRole("option", { name: "kg m-3", exact: true })).toBeVisible();
  });

  test("exports a typed unit and a complete standard identifier", async ({ page }) => {
    await createDataset(page);
    await openVariableModal(page);
    await chooseType(page, "pH", "Measured", "Discrete");

    const dropdown = await openPicker(page);
    await dropdown.getByRole("option").first().click();

    // A unit outside the suggestions must land in `units` itself.
    await page.getByRole("textbox", { name: "Unit *" }).fill("total scale");
    await page.getByRole("textbox", { name: "Dataset variable name *" }).fill("pH_total");

    await page
      .locator(".mantine-Modal-root")
      .getByRole("button", { name: /Add Variable|Save/i })
      .click();
    await page.waitForTimeout(500);

    await page.getByRole("button", { name: /Export/i }).click();
    await page.waitForTimeout(500);
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /Download Anyway/i }).click();
    const download: Download = await downloadPromise;
    const exported = JSON.parse(fs.readFileSync((await download.path())!, "utf-8"));

    const variable = exported.datasets[0].variables[0];
    expect(variable.standard_identifier).toEqual({
      term: "sea_water_ph_reported_on_total_scale",
      uri: "http://vocab.nerc.ac.uk/collection/P07/current/CF14N56/",
    });
    expect(variable.units).toBe("total scale");
    expect(variable.long_name).toBe("pH");
    expect(variable.dataset_variable_name).toBe("pH_total");
    expect(variable).not.toHaveProperty("units_custom");
  });
});
