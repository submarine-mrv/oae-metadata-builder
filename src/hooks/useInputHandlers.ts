import { useCallback, FocusEvent } from "react";

interface UseInputHandlersReturn {
  handleBlur: (event: FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  handleFocus: (event: FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
}

export function useInputHandlers(
  id: string,
  onBlur?: (id: string, value: any) => void,
  onFocus?: (id: string, value: any) => void
): UseInputHandlersReturn {
  const handleBlur = useCallback(
    (event: FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      if (onBlur) {
        onBlur(id, event.target.value);
      }
    },
    [onBlur, id]
  );

  const handleFocus = useCallback(
    (event: FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      if (onFocus) {
        onFocus(id, event.target.value);
      }
    },
    [onFocus, id]
  );

  return { handleBlur, handleFocus };
}
