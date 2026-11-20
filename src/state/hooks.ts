import { type Atom, atom, useAtomValue } from "jotai";
import { useMemo } from "react";
import { datasetsAtom, experimentsAtom } from "./atoms";

/** One record from `list`; re-renders only when that record changes. */
function useRecord<T extends { id: string }>(list: Atom<T[]>, id: string | null): T | undefined {
  const selected = useMemo(
    () => atom((get) => (id === null ? undefined : get(list).find((r) => r.id === id))),
    [list, id],
  );
  return useAtomValue(selected);
}

export const useExperiment = (id: string | null) => useRecord(experimentsAtom, id);
export const useDataset = (id: string | null) => useRecord(datasetsAtom, id);
