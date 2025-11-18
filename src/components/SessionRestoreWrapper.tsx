"use client";
import React from "react";
import { useAppState } from "@/contexts/AppStateContext";
import SessionRestoreModal from "./SessionRestoreModal";

export default function SessionRestoreWrapper({
  children
}: {
  children: React.ReactNode;
}) {
  const {
    shouldShowRestoreModal,
    getSavedSession,
    restoreSession,
    dismissRestoreModal
  } = useAppState();

  const savedSession = getSavedSession();

  return (
    <>
      {savedSession && (
        <SessionRestoreModal
          opened={shouldShowRestoreModal}
          onRestore={restoreSession}
          onStartFresh={dismissRestoreModal}
          projectName={savedSession.projectName}
          experimentNames={savedSession.experimentNames}
          savedAt={new Date(savedSession.savedAt)}
        />
      )}
      {children}
    </>
  );
}
