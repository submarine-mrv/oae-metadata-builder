import { test, expect } from "@playwright/test";
import path from "path";

/**
 * Regression test for the mcdr_forcing_description conditional field restore bug.
 *
 * Bug: When restoring a session (import) with a ModelOutputDataset that has
 * simulation_type=["perturbation"] and mcdr_forcing_description set, the
 * mcdr_forcing_description field renders as raw key-value additionalProperties
 * ("mcdr_forcing_description Key" / value) instead of a proper labeled input.
 *
 * Root cause: Race condition between useState(isInitialLoad) + setTimeout
 * and RJSF's onChange reconciliation during form data restore.
 *
 * Fix: useRef for isInitialLoad (synchronous reads) + RJSF 6.4 upgrade.
 */
test.describe("Dataset Conditional Field Restore", () => {
  const fixtureFile = path.join(
    __dirname,
    "fixtures",
    "dataset-conditional-import.json"
  );

  test("mcdr_forcing_description renders as proper field after import, not as additionalProperties", async ({
    page,
  }) => {
    // 1. Navigate to overview
    await page.goto("/overview");
    await page.waitForLoadState("networkidle");

    // 2. Import the fixture file
    await page
      .locator("button.mantine-Burger-burger, [aria-label='Menu']")
      .first()
      .click();
    await page.waitForTimeout(300);

    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.getByText("Import").click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(fixtureFile);
    await page.waitForTimeout(1000);

    // 3. Import preview — click Import button
    const importButton = page.getByRole("button", {
      name: /Import \d+ item/i,
    });
    await expect(importButton).toBeVisible({ timeout: 5000 });
    await importButton.click();
    await page.waitForTimeout(500);
    await page.waitForURL("**/overview");
    await page.waitForLoadState("networkidle");

    // 4. Click the imported dataset to navigate to dataset page
    const datasetLink = page.getByText("Dataset 1").first();
    await expect(datasetLink).toBeVisible({ timeout: 5000 });
    await datasetLink.click();
    await page.waitForURL("**/dataset");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);

    // 5. KEY ASSERTIONS:

    // The bug symptom: "mcdr_forcing_description Key" text appears when
    // the field renders as raw additionalProperties instead of a proper input.
    const rawKeyLabel = page.getByText("mcdr_forcing_description Key");
    await expect(rawKeyLabel).not.toBeVisible({ timeout: 3000 });

    // The field should render with its proper schema title (label contains
    // "mCDR Forcing" text, possibly split across child elements with * and ⓘ)
    const properField = page.locator("text=mCDR Forcing");
    await expect(properField.first()).toBeVisible({ timeout: 3000 });

    // The imported value should be present in the input/textarea
    const fieldInput = page.locator(
      '[id*="mcdr_forcing_description"]'
    ).first();
    await expect(fieldInput).toBeVisible({ timeout: 3000 });
    await expect(fieldInput).toHaveValue(
      "CO2 removal forcing applied to surface layer"
    );
  });

  test("mcdr_forcing_description persists after navigating away and back", async ({
    page,
  }) => {
    // 1. Import fixture
    await page.goto("/overview");
    await page.waitForLoadState("networkidle");

    await page
      .locator("button.mantine-Burger-burger, [aria-label='Menu']")
      .first()
      .click();
    await page.waitForTimeout(300);

    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.getByText("Import").click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(fixtureFile);
    await page.waitForTimeout(1000);

    const importButton = page.getByRole("button", {
      name: /Import \d+ item/i,
    });
    await expect(importButton).toBeVisible({ timeout: 5000 });
    await importButton.click();
    await page.waitForTimeout(500);
    await page.waitForURL("**/overview");
    await page.waitForLoadState("networkidle");

    // 2. Navigate to dataset
    const datasetLink = page.getByText("Dataset 1").first();
    await expect(datasetLink).toBeVisible({ timeout: 5000 });
    await datasetLink.click();
    await page.waitForURL("**/dataset");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);

    // 3. Navigate AWAY via nav bar (client-side, preserves React state)
    await page.getByText("Overview", { exact: true }).click();
    await page.waitForURL("**/overview");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(300);

    // 4. Navigate BACK to dataset (triggers the activeDatasetId useEffect again)
    const datasetLink2 = page.getByText("Dataset 1").first();
    await datasetLink2.click();
    await page.waitForURL("**/dataset");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);

    // 5. Assert: field still renders properly, not as raw key-value
    const rawKeyLabel = page.getByText("mcdr_forcing_description Key");
    await expect(rawKeyLabel).not.toBeVisible({ timeout: 3000 });

    const properField = page.locator("text=mCDR Forcing");
    await expect(properField.first()).toBeVisible({ timeout: 3000 });

    const fieldInput = page.locator(
      '[id*="mcdr_forcing_description"]'
    ).first();
    await expect(fieldInput).toBeVisible({ timeout: 3000 });
    await expect(fieldInput).toHaveValue(
      "CO2 removal forcing applied to surface layer"
    );
  });

  test("conditional field survives slow isInitialLoad guard (race condition stress test)", async ({
    page,
  }) => {
    // This test artificially widens the race condition window by making
    // setTimeout(..., 0) callbacks fire 500ms late. On the buggy code path
    // (useState + setTimeout), this means isInitialLoad stays true longer,
    // causing RJSF's onChange to be suppressed during reconciliation, which
    // drops conditional field values.
    //
    // With the fix (useRef), onChange reads the ref synchronously — no
    // callback timing matters.

    // Monkey-patch setTimeout BEFORE navigation to dataset page
    await page.goto("/overview");
    await page.waitForLoadState("networkidle");

    // Import fixture
    await page
      .locator("button.mantine-Burger-burger, [aria-label='Menu']")
      .first()
      .click();
    await page.waitForTimeout(300);

    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.getByText("Import").click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(fixtureFile);
    await page.waitForTimeout(1000);

    const importButton = page.getByRole("button", {
      name: /Import \d+ item/i,
    });
    await expect(importButton).toBeVisible({ timeout: 5000 });
    await importButton.click();
    await page.waitForTimeout(500);
    await page.waitForURL("**/overview");
    await page.waitForLoadState("networkidle");

    // Navigate to dataset first time (establishes activeDatasetId)
    const datasetLink = page.getByText("Dataset 1").first();
    await expect(datasetLink).toBeVisible({ timeout: 5000 });
    await datasetLink.click();
    await page.waitForURL("**/dataset");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);

    // Navigate away
    await page.getByText("Overview", { exact: true }).click();
    await page.waitForURL("**/overview");
    await page.waitForLoadState("networkidle");

    // NOW inject the slow setTimeout before navigating back.
    // This widens the race: isInitialLoad stays true for 500ms after
    // setFormData, giving RJSF's onChange time to fire while guarded.
    await page.evaluate(() => {
      const origSetTimeout = window.setTimeout;
      window.setTimeout = function (fn: TimerHandler, delay?: number, ...args: unknown[]) {
        // Only slow down zero-delay timers (the isInitialLoad pattern)
        if (delay === 0 || delay === undefined) {
          return origSetTimeout.call(window, fn, 500, ...args);
        }
        return origSetTimeout.call(window, fn, delay, ...args);
      } as typeof window.setTimeout;
    });

    // Navigate back — triggers the activeDatasetId useEffect with slow guard
    const datasetLink2 = page.getByText("Dataset 1").first();
    await datasetLink2.click();
    await page.waitForURL("**/dataset");
    await page.waitForLoadState("networkidle");
    // Wait long enough for the slowed setTimeout to fire
    await page.waitForTimeout(1000);

    // Assert: field renders properly despite the slow guard
    const rawKeyLabel = page.getByText("mcdr_forcing_description Key");
    await expect(rawKeyLabel).not.toBeVisible({ timeout: 3000 });

    const properField = page.locator("text=mCDR Forcing");
    await expect(properField.first()).toBeVisible({ timeout: 3000 });

    const fieldInput = page.locator(
      '[id*="mcdr_forcing_description"]'
    ).first();
    await expect(fieldInput).toBeVisible({ timeout: 3000 });
    await expect(fieldInput).toHaveValue(
      "CO2 removal forcing applied to surface layer"
    );
  });
});
