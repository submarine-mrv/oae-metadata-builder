import { Button, Modal, Text, Group } from "@mantine/core";
import { useState, useRef } from "react";
import {
  FormContextType,
  RJSFSchema,
  StrictRJSFSchema,
  SubmitButtonProps
} from "@rjsf/utils";

export default function CustomSubmitButton<
  T = any,
  S extends StrictRJSFSchema = RJSFSchema,
  F extends FormContextType = any
>(props: SubmitButtonProps<T, S, F>) {
  const { uiSchema } = props;
  const [opened, setOpened] = useState(false);
  const hiddenSubmitRef = useRef<HTMLButtonElement>(null);

  // Get custom config from uiSchema
  const buttonText = uiSchema?.["ui:submitButtonText"] || "Download Metadata File";
  const warningMessage = uiSchema?.["ui:submitWarningMessage"] ||
    "This will only download metadata. To download all metadata, click export metadata button in the upper right corner.";

  const handleVisibleButtonClick = () => {
    setOpened(true);
  };

  const handleContinue = () => {
    setOpened(false);
    // Trigger the actual form submission by clicking the hidden submit button
    setTimeout(() => {
      hiddenSubmitRef.current?.click();
    }, 0);
  };

  const handleCancel = () => {
    setOpened(false);
  };

  return (
    <>
      {/* Visible button that shows modal */}
      <Button type="button" variant="filled" onClick={handleVisibleButtonClick}>
        {buttonText}
      </Button>

      {/* Hidden submit button that actually submits the form */}
      <button
        ref={hiddenSubmitRef}
        type="submit"
        style={{ display: "none" }}
        aria-hidden="true"
      />

      {/* Confirmation Modal */}
      <Modal
        opened={opened}
        onClose={handleCancel}
        title="Download Metadata"
        centered
      >
        <Text mb="md">{warningMessage}</Text>
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
