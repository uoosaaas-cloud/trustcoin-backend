"use client";

import { useEffect, useRef } from "react";

/**
 * Runs `load` immediately when `enabled`, then every `intervalMs` (default 10s).
 * Used by admin pages to keep live data fresh.
 */
export function usePollingReload(
  load: () => void | Promise<void>,
  enabled: boolean,
  intervalMs = 10_000
): void {
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    async function tick() {
      if (cancelled) return;
      await loadRef.current();
    }

    void tick();
    const id = window.setInterval(() => {
      void tick();
    }, intervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [enabled, intervalMs]);
}
