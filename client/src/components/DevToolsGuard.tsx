"use client";

import { useEffect } from "react";

/**
 * Lightweight client-side obfuscation: discourages casual inspection via
 * right-click and common DevTools shortcuts. Real security remains on the backend.
 */
export function DevToolsGuard() {
  useEffect(() => {
    function onContextMenu(event: MouseEvent) {
      event.preventDefault();
    }

    function onKeyDown(event: KeyboardEvent) {
      const key = event.key.toLowerCase();
      const isDevtoolsShortcut =
        event.key === "F12" ||
        (event.ctrlKey && event.shiftKey && (key === "i" || key === "j" || key === "c")) ||
        (event.metaKey && event.altKey && (key === "i" || key === "j" || key === "c")) ||
        (event.ctrlKey && key === "u") ||
        (event.metaKey && key === "u");

      if (isDevtoolsShortcut) {
        event.preventDefault();
        event.stopPropagation();
      }
    }

    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, []);

  return null;
}
