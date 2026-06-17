import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadPublishedTourManifest,
  normalizeTourCode,
  type TourLookupState
} from "./tourLookup";

export function useTourLookup(tourCode: string | string[] | undefined): {
  lookupState: TourLookupState;
  normalizedCode: string;
  retryLookup: () => Promise<void>;
} {
  const normalizedCode = normalizeTourCode(tourCode);
  const isMountedRef = useRef(false);
  const requestIdRef = useRef(0);
  const [lookupState, setLookupState] = useState<TourLookupState>({
    status: "loading"
  });

  const retryLookup = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    setLookupState({ status: "loading" });
    const nextState = await loadPublishedTourManifest(normalizedCode);

    if (isMountedRef.current && requestIdRef.current === requestId) {
      setLookupState(nextState);
    }
  }, [normalizedCode]);

  useEffect(() => {
    isMountedRef.current = true;
    void retryLookup();

    return () => {
      isMountedRef.current = false;
    };
  }, [retryLookup]);

  return {
    lookupState,
    normalizedCode,
    retryLookup
  };
}
