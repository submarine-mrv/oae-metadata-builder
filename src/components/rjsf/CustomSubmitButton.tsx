import { Button, Modal, Group, Alert } from "@mantine/core";
import { IconAlertTriangle } from "@tabler/icons-react";
import { useState, useRef, useEffect } from "react";
import {
  FormContextType,
  RJSFSchema,
  StrictRJSFSchema,
  SubmitButtonProps
} from "@rjsf/utils";

interface CustomSubmitButtonProps<
  T = any,
  S extends StrictRJSFSchema = RJSFSchema,
  F extends FormContextType = any
> extends SubmitButtonProps<T, S, F> {
  buttonText?: string;
  metadataType?: "project" | "experiment";
}

export default function CustomSubmitButton<
  T = any,
  S extends StrictRJSFSchema = RJSFSchema,
  F extends FormContextType = any
>(props: CustomSubmitButtonProps<T, S, F>) {
  const { buttonText = "Download Metadata File", metadataType } = props;
  const [opened, setOpened] = useState(false);
  const [bypassModal, setBypassModal] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  const submitButtonRef = useRef<HTMLButtonElement>(null);

  // Find the parent form element on mount
  useEffect(() => {
    if (submitButtonRef.current) {
      formRef.current = submitButtonRef.current.closest("form");
    }
  }, []);

  // Generate warning message based on metadataType
  const warningMessage = metadataType
    ? `This will only download ${metadataType}-level metadata. To download all metadata, click export metadata button in the upper right corner.`
    : "This will only download metadata. To download all metadata, click export metadata button in the upper right corner.";

  const handleSubmit = (e: React.MouseEvent<HTMLButtonElement>) => {
    // If we're bypassing the modal (user clicked Continue), let form submit normally
    if (bypassModal) {
      setBypassModal(false);
      return;
    }

    // Otherwise, prevent submission and check validity first
    e.preventDefault();

    // Check if form is valid using HTML5 validation
    const form = formRef.current;
    if (form && !form.checkValidity()) {
      // Form is invalid - trigger native validation UI by submitting
      form.reportValidity();
      return;
    }

    // Form is valid - show the modal
    setOpened(true);
  };

  const handleContinue = () => {
    setOpened(false);
    setBypassModal(true);
    // Trigger the actual form submission
    setTimeout(() => {
      submitButtonRef.current?.click();
    }, 0);
  };

  const handleCancel = () => {
    setOpened(false);
  };

  return (
    <>
      {/* Submit button that shows modal or submits based on state */}
      <Button
        ref={submitButtonRef}
        type="submit"
        variant="filled"
        onClick={handleSubmit}
      >
        {buttonText}
      </Button>

      {/* Confirmation Modal */}
      <Modal
        opened={opened}
        onClose={handleCancel}
        title="Download Metadata"
        centered
      >
        <Alert
          icon={<IconAlertTriangle size={20} />}
          title="Partial Download"
          color="yellow"
          variant="light"
          mb="md"
        >
          {warningMessage}
        </Alert>
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={handleCancel}>
            Cancel
          </Button>
          <Button variant="filled" onClick={handleContinue}>
            Continue
          </Button>
        </Group>
      </Modal>
    </>
  );
}
