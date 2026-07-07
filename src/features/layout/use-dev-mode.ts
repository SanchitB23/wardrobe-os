"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "wardrobeos:dev-mode";

/**
 * Client-only developer-mode flag, persisted in localStorage. Starts `false` on
 * both server and client (so no hydration mismatch), then hydrates from storage
 * after mount. Gates the Developer section in the sidebar.
 */
export function useDevMode(): { devMode: boolean; toggle: () => void } {
  const [devMode, setDevMode] = useState(false);

  useEffect(() => {
    try {
      setDevMode(window.localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      // ignore (private mode / unavailable storage)
    }
  }, []);

  const toggle = useCallback(() => {
    setDevMode((previous) => {
      const next = !previous;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  return { devMode, toggle };
}
