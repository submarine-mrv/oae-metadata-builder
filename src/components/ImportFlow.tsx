import ImportPreviewModal from "@/components/ImportPreviewModal";
import type { ImportFlowHandle } from "@/hooks/useImportFlow";

/** The hidden file input and preview modal behind `useImportFlow`. */
export default function ImportFlow({ flow }: { flow: ImportFlowHandle }) {
  return (
    <>
      <input
        ref={flow.inputProps.ref}
        type="file"
        accept=".json,application/json"
        onChange={flow.inputProps.onChange}
        style={{ display: "none" }}
      />
      <ImportPreviewModal {...flow.previewProps} />
    </>
  );
}
