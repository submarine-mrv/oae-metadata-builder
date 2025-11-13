import { Button, Modal, Text, Group } from "@mantine/core";
import { useState, useRef } from "react";
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
  const hiddenSubmitRef = useRef<HTMLButtonElement>(null);

  // Generate warning message based on metadataType
  const warningMessage = metadataType
    ? `This will only download ${metadataType}-level metadata. To download all metadata, click export metadata button in the upper right corner.`
    : "This will only download metadata. To download all metadata, click export metadata button in the upper right corner.";

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
