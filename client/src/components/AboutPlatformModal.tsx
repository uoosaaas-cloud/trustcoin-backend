"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";

interface AboutPlatformModalProps {
  open: boolean;
  onClose: () => void;
}

const SECTIONS = [
  {
    key: "axs" as const,
    icon: (
      <path
        d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3zm0 2.2L6.5 8.4v7.2L12 18.8l5.5-3.2V8.4L12 5.2zM12 9l3 1.7v3.4L12 16l-3-1.9v-3.4L12 9z"
        fill="currentColor"
      />
    ),
    accent: "from-blue-500/25 to-cyan-400/10 border-blue-400/30 text-blue-300",
    glow: "bg-blue-400/20",
  },
  {
    key: "precision" as const,
    icon: (
      <path
        d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm0 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm0 3a1 1 0 0 1 1 1v3.6l2.4 2.4a1 1 0 1 1-1.4 1.4l-2.7-2.7A1 1 0 0 1 11 12V8a1 1 0 0 1 1-1z"
        fill="currentColor"
      />
    ),
    accent: "from-emerald-500/25 to-green-400/10 border-emerald-400/30 text-emerald-300",
    glow: "bg-emerald-400/20",
  },
  {
    key: "risk" as const,
    icon: (
      <path
        d="M12 2 3 6v6c0 5 3.8 9.4 9 10 5.2-.6 9-5 9-10V6l-9-4zm0 2.2 7 3.1v4.7c0 3.9-2.8 7.4-7 8.1-4.2-.7-7-4.2-7-8.1V7.3l7-3.1zM11 9h2v5h-2V9zm0 6h2v2h-2v-2z"
        fill="currentColor"
      />
    ),
    accent: "from-amber-500/25 to-orange-400/10 border-amber-400/30 text-amber-300",
    glow: "bg-amber-400/20",
  },
  {
    key: "security" as const,
    icon: (
      <path
        d="M12 2 4 5v6c0 5.2 3.4 9.9 8 11 4.6-1.1 8-5.8 8-11V5l-8-3zm0 2.2 6 2.2v4.6c0 4-2.5 7.6-6 8.7-3.5-1.1-6-4.7-6-8.7V6.4l6-2.2zm-1 5.3h2v2.8l1.8 1.8-1.4 1.4L12 13.6l-1.4 1.4-1.4-1.4 1.8-1.8V9.5z"
        fill="currentColor"
      />
    ),
    accent: "from-rose-500/25 to-brand-400/10 border-rose-400/30 text-rose-300",
    glow: "bg-rose-400/20",
  },
] as const;

const BADGES = [
  { key: "errorRate" as const, tone: "border-emerald-400/35 bg-emerald-400/10 text-emerald-300 shadow-[0_0_18px_rgba(52,211,153,0.2)]" },
  { key: "axsSystem" as const, tone: "border-blue-400/35 bg-blue-400/10 text-blue-300 shadow-[0_0_18px_rgba(96,165,250,0.2)]" },
  { key: "coverage" as const, tone: "border-cyan-400/35 bg-cyan-400/10 text-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.2)]" },
] as const;

export function AboutPlatformModal({ open, onClose }: AboutPlatformModalProps) {
  const t = useTranslations("about");
  const tCommon = useTranslations("common");

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        aria-label={tCommon("back")}
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-platform-title"
        className="about-modal-enter relative z-10 flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-[1.75rem] border border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 shadow-[0_24px_80px_rgba(2,6,23,0.65)] sm:rounded-[1.75rem]"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -end-20 -top-24 h-64 w-64 rounded-full bg-blue-500/25 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-28 -start-16 h-56 w-56 rounded-full bg-emerald-400/15 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-300/60 to-transparent"
        />

        <header className="relative flex items-start justify-between gap-4 border-b border-white/10 px-5 py-5 sm:px-7 sm:py-6">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-300/90">
              {t("eyebrow")}
            </p>
            <h2
              id="about-platform-title"
              className="mt-2 text-xl font-bold tracking-tight text-white sm:text-2xl sm:leading-snug"
            >
              {t("title")}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-slate-300 transition hover:border-white/30 hover:bg-white/10 hover:text-white"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="relative overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
          <div className="flex flex-wrap gap-2">
            {BADGES.map((badge) => (
              <span
                key={badge.key}
                className={`inline-flex items-center rounded-full border px-3 py-1.5 font-mono text-[11px] font-semibold tracking-wide ${badge.tone}`}
              >
                {t(`badges.${badge.key}`)}
              </span>
            ))}
          </div>

          <div className="mt-6 space-y-4">
            {SECTIONS.map((section, index) => (
              <article
                key={section.key}
                className="about-card-enter group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-[0_8px_32px_rgba(2,6,23,0.35)] backdrop-blur-md transition duration-300 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.06] sm:p-5"
                style={{ animationDelay: `${80 + index * 70}ms` }}
              >
                <div
                  aria-hidden
                  className={`pointer-events-none absolute -end-8 -top-10 h-28 w-28 rounded-full blur-3xl opacity-70 transition group-hover:opacity-100 ${section.glow}`}
                />

                <div className="relative flex items-start gap-3.5">
                  <span
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border bg-gradient-to-br ${section.accent}`}
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
                      {section.icon}
                    </svg>
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold tracking-tight text-white sm:text-lg">
                      {t(`sections.${section.key}.title`)}
                    </h3>
                    <p className="mt-2 text-[14px] leading-relaxed text-slate-300 sm:text-[15px]">
                      {t(`sections.${section.key}.body`)}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <p className="mt-6 text-center text-[12px] leading-relaxed text-slate-500">
            {t("footer")}
          </p>
        </div>
      </div>
    </div>
  );
}
