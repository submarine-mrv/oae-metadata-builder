import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import type React from "react";
import { describe, expect, it, vi } from "vitest";
import type { ImportItem } from "@/hooks/useImportPreview";
import ImportPreviewModal from "../ImportPreviewModal";

function experiment(key: string, id: string, conflict: ImportItem["conflict"]): ImportItem {
  return {
    key,
    type: "experiment",
    id,
    name: `Experiment ${id}`,
    data: { experiment_id: id },
    selected: true,
    conflict,
    conflictReason: "",
  } as ImportItem;
}

function renderModal(props: Partial<React.ComponentProps<typeof ImportPreviewModal>> = {}) {
  const onImport = vi.fn();
  render(
    <MantineProvider>
      <ImportPreviewModal
        opened
        onClose={vi.fn()}
        filename="export.json"
        items={[experiment("experiment-0", "exp-1", null)]}
        onToggleItem={vi.fn()}
        onSetDatasetLinking={vi.fn()}
        getExperimentLinkOptions={() => []}
        duplicateExperimentIdError={null}
        onImport={onImport}
        importMode="merge"
        onImportModeChange={vi.fn()}
        canMerge
        currentProjectName="Kiel trial"
        {...props}
      />
    </MantineProvider>,
  );
  return { onImport };
}

describe("ImportPreviewModal", () => {
  it("blocks import on duplicate experiment ids in new mode", async () => {
    const error = "Cannot import: multiple experiments have the same experiment_id (exp-1)";
    renderModal({
      importMode: "new",
      items: [experiment("experiment-0", "exp-1", null), experiment("experiment-1", "exp-1", null)],
      duplicateExperimentIdError: error,
    });
    expect(await screen.findByText(error)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Import 2 items/ })).toBeDisabled();
    expect(screen.getByRole("radio", { name: /Kiel trial/ })).toBeInTheDocument();
    expect(screen.queryByText(/loaded successfully/)).not.toBeInTheDocument();
  });

  it("shows overwrite icons only for override conflicts", async () => {
    renderModal({
      items: [
        experiment("experiment-0", "exp-1", "override"),
        experiment("experiment-1", "exp-2", "add-new"),
      ],
    });
    const rows = await screen.findAllByRole("row");
    const overrideRow = rows.find((r) => r.textContent?.includes("exp-1"));
    const newRow = rows.find((r) => r.textContent?.includes("exp-2"));
    expect(overrideRow?.querySelector("svg.tabler-icon-alert-triangle")).not.toBeNull();
    expect(newRow?.querySelector("svg.tabler-icon-alert-triangle")).toBeNull();
  });

  it("hides the mode control when there is nothing to merge into", async () => {
    renderModal({ canMerge: false, importMode: "new" });
    expect(await screen.findByRole("button", { name: /Import 1 item/ })).toBeEnabled();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });
});
