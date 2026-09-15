import { useCallback } from "react";
import SessionRestoreModal from "@/components/SessionRestoreModal";
import { useAppState } from "@/contexts/AppStateContext";
import { useSessionPersistence } from "@/hooks/useSessionPersistence";
import { router } from "@/router";

export default function SessionManager() {
  const { state, restoreFullState, setActiveExperiment, setActiveDataset } = useAppState();
  const { savedSession, isRestoreModalOpen, restoreSession, discardSession } =
    useSessionPersistence(state, restoreFullState);
  const handleRestore = useCallback(() => {
    restoreSession();
    // Select the first experiment/dataset so tabs work immediately
    if (savedSession) {
      if (savedSession.experiments.length > 0) {
        setActiveExperiment(savedSession.experiments[0].id);
      }
      if (savedSession.datasets.length > 0) {
        setActiveDataset(savedSession.datasets[0].id);
      }
    }
    void router.navigate({ to: "/overview" });
  }, [restoreSession, savedSession, setActiveExperiment, setActiveDataset]);

  return (
    <>
      {isRestoreModalOpen && savedSession && (
        <SessionRestoreModal
          opened={isRestoreModalOpen}
          session={savedSession}
          onRestore={handleRestore}
          onDiscard={discardSession}
        />
      )}
    </>
  );
}
