"use client";

import { useEffect, useRef } from "react";

export const SILENT_POLL_INTERVAL_MS = 10_000;

interface UseSilentPollOptions {
  /** When false, the interval is not started. */
  enabled?: boolean;
  /** Poll cadence in ms (default 10s). */
  intervalMs?: number;
  /** Run once immediately when enabled (in addition to the interval). */
  runImmediately?: boolean;
  /** Skip polls while the browser tab is hidden (default true). */
  pauseWhenHidden?: boolean;
}

/**
 * Lightweight background revalidation helper.
 * - Does not manage loading UI — callers update state in place.
 * - Clears the interval on unmount.
 * - Skips overlapping in-flight requests.
 */
export function useSilentPoll(
  fetcher: () => void | Promise<void>,
  {
    enabled = true,
    intervalMs = SILENT_POLL_INTERVAL_MS,
    runImmediately = false,
    pauseWhenHidden = true,
  }: UseSilentPollOptions = {}
): void {
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let inFlight = false;

    async function run() {
      if (cancelled || inFlight) return;
      if (pauseWhenHidden && typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }

      inFlight = true;
      try {
        await fetcherRef.current();
      } catch {
        // Callers own error handling; silent polls must never throw into React.
      } finally {
        inFlight = false;
      }
    }

    if (runImmediately) {
      void run();
    }

    const timerId = window.setInterval(() => {
      void run();
    }, intervalMs);

    function onVisibilityChange() {
      if (!pauseWhenHidden) return;
      if (document.visibilityState === "visible") {
        void run();
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(timerId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [enabled, intervalMs, runImmediately, pauseWhenHidden]);
}
