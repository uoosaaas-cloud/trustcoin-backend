"use client";

export function AuthLoading({ label }: { label?: string }) {
  return (
    <div className="page-shell flex min-h-[50vh] flex-col items-center justify-center px-4">
      <div
        className="h-10 w-10 animate-spin rounded-full border-2 border-cyan-300/30 border-t-cyan-300"
        aria-hidden
      />
      {label ? <p className="mt-4 text-sm text-slate-400">{label}</p> : null}
    </div>
  );
}
