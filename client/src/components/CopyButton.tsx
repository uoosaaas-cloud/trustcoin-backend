"use client";

import { useState } from "react";

interface CopyButtonProps {
  value: string;
  label: string;
  copiedLabel: string;
  className?: string;
}

/** A small button that copies `value` to the clipboard and briefly confirms it. */
export function CopyButton({ value, label, copiedLabel, className = "" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Clipboard API can be unavailable (e.g. insecure context) — fail silently,
      // the address is still selectable/visible for manual copying.
      return;
    }

    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-green-300 hover:bg-green-50 hover:text-green-700 ${className}`}
    >
      <span aria-hidden>{copied ? "✓" : "📋"}</span>
      {copied ? copiedLabel : label}
    </button>
  );
}
