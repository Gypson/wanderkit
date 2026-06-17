import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadPublishedTourManifest,
  normalizeTourCode,
  type TourLookupState
} from "./tourLookup";

export type TourLookupRefreshState =
  | { status: "idle" }
  | { status: "refreshing" }
  | { message: string; status: "success" }
  | { message: string; status: "error" };

export function useTourLookup(tourCode: string | string[] | undefined): {
  lookupState: TourLookupState;
  normalizedCode: string;
  refreshLookup: () => Promise<void>;
  refreshState: TourLookupRefreshState;
  retryLookup: () => Promise<void>;
} {
  const normalizedCode = normalizeTourCode(tourCode);
  const isMountedRef = useRef(false);
  const requestIdRef = useRef(0);
  const [lookupState, setLookupState] = useState<TourLookupState>({
    status: "loading"
  });
  const [refreshState, setRefreshState] = useState<TourLookupRefreshState>({
    status: "idle"
  });

  const retryLookup = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    setRefreshState({ status: "idle" });
    setLookupState({ status: "loading" });
    const nextState = await loadPublishedTourManifest(normalizedCode);

    if (isMountedRef.current && requestIdRef.current === requestId) {
      setLookupState(nextState);
    }
  }, [normalizedCode]);

  const refreshLookup = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    setRefreshState({ status: "refreshing" });

    try {
      const nextState = await loadPublishedTourManifest(normalizedCode);

      if (!isMountedRef.current || requestIdRef.current !== requestId) {
        return;
      }

      setLookupState(nextState);

      if (nextState.status === "success") {
        setRefreshState({
          message: "You are back online. Updated tour loaded.",
          status: "success"
        });
        return;
      }

      if (nextState.status === "cached") {
        setRefreshState({
          message: "Still using saved copy. Could not reach Supabase.",
          status: "error"
        });
        return;
      }

      setRefreshState({
        message: formatRefreshErrorMessage(nextState),
        status: "error"
      });
    } catch (error) {
      if (isMountedRef.current && requestIdRef.current === requestId) {
        setRefreshState({
          message:
            error instanceof Error
              ? error.message
              : "Tour updates could not be checked.",
          status: "error"
        });
      }
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
    refreshLookup,
    refreshState,
    retryLookup
  };
}

function formatRefreshErrorMessage(state: TourLookupState): string {
  if (state.status === "config-missing") {
    return "Still using saved copy. Supabase is not configured.";
  }

  if (state.status === "error") {
    return state.message;
  }

  if (state.status === "invalid") {
    return "Latest tour data is invalid. Still using saved copy.";
  }

  if (state.status === "not-found") {
    return "Latest tour data was not found. Still using saved copy.";
  }

  return "Tour updates could not be checked.";
}
