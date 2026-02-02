import { useState, useRef, useCallback } from "react";

interface ValidationResult {
  errorCount: number;
}

interface UseSingleItemDownloadOptions {
  /** Function that validates the data and returns error count */
  validate: () => ValidationResult;
  /** Function that exports/downloads the data */
  export: () => void;
}

interface UseSingleItemDownloadReturn {
  // Modal state
  showModal: boolean;
  errorCount: number;
  closeModal: () => void;

  // Error display state for RJSF
  showErrorList: boolean;

  // Refs
  /** Ref for the RJSF Form component */
  formRef: React.RefObject<any>;
  /** Ref for the scrollable container div */
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;

  // Handlers
  /** Click handler for the download button - validates and either downloads or shows modal */
  handleDownloadClick: () => void;
  /** Handler for modal's download button */
  handleDownload: () => void;
  /** Handler for modal's "Go Back" button - closes modal and triggers validation display */
  handleGoBack: () => void;
  /** Handler for modal exit transition - triggers RJSF validation after modal closes */
  handleModalExitComplete: () => void;
}

/**
 * Custom hook for single-item download functionality.
 *
 * Encapsulates the pattern of:
 * 1. Validating data when download is clicked
 * 2. Downloading directly if no errors
 * 3. Showing modal if there are errors
 * 4. "Go Back" triggers RJSF validation and scrolls to errors
 *
 * @example
 * ```tsx
 * const download = useSingleItemDownload({
 *   validate: () => validateProject(projectData),
 *   export: () => exportProject(projectData),
 * });
 *
 * // In JSX:
 * <div ref={download.scrollContainerRef}>
 *   <Form
 *     ref={download.formRef}
 *     showErrorList={download.showErrorList ? "top" : false}
 *   />
 *   <Button onClick={download.handleDownloadClick}>Download</Button>
 * </div>
 *
 * <SingleItemDownloadModal
 *   opened={download.showModal}
 *   onClose={download.closeModal}
 *   onDownload={download.handleDownload}
 *   errorCount={download.errorCount}
 *   onGoBack={download.handleGoBack}
 *   onExitTransitionEnd={download.handleModalExitComplete}
 * />
 * ```
 */
export function useSingleItemDownload({
  validate,
  export: exportFn
}: UseSingleItemDownloadOptions): UseSingleItemDownloadReturn {
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [errorCount, setErrorCount] = useState(0);

  // Controls whether RJSF shows the error list
  const [showErrorList, setShowErrorList] = useState(false);

  // Tracks whether validation should run after modal closes
  const [pendingValidation, setPendingValidation] = useState(false);

  // Refs
  const formRef = useRef<any>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const closeModal = useCallback(() => {
    setShowModal(false);
  }, []);

  const handleDownloadClick = useCallback(() => {
    const validationResult = validate();

    if (validationResult.errorCount === 0) {
      // No errors - download directly without showing modal
      // Also clear any previously shown error list
      setShowErrorList(false);
      exportFn();
    } else {
      // Has errors - show modal
      setErrorCount(validationResult.errorCount);
      setShowModal(true);
    }
  }, [validate, exportFn]);

  const handleDownload = useCallback(() => {
    // Clear any previously shown error list when downloading
    setShowErrorList(false);
    exportFn();
  }, [exportFn]);

  /**
   * Handle "Go Back" click from download modal.
   * Closes modal, enables error display, and sets pending validation flag.
   * Actual validation runs after modal exit transition completes.
   */
  const handleGoBack = useCallback(() => {
    setShowModal(false);
    setShowErrorList(true);
    setPendingValidation(true);
  }, []);

  /**
   * Callback for when modal exit transition completes.
   * Triggers validation if pending (from Go Back click).
   */
  const handleModalExitComplete = useCallback(() => {
    if (!pendingValidation) return;
    setPendingValidation(false);

    // Query the form element directly from DOM
    const formElement = document.querySelector("form") as HTMLFormElement | null;

    // reportValidity() shows browser validation bubbles and returns validity status
    const html5Valid = formElement?.reportValidity() ?? true;

    if (html5Valid && formRef.current) {
      // HTML5 validation passed - trigger RJSF/JSON schema validation
      formRef.current.submit();

      // Scroll to error list for JSON schema errors
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [pendingValidation]);

  return {
    showModal,
    errorCount,
    closeModal,
    showErrorList,
    formRef,
    scrollContainerRef,
    handleDownloadClick,
    handleDownload,
    handleGoBack,
    handleModalExitComplete
  };
}
