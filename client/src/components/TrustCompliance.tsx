"use client";

/**
 * Regulatory trust strip — always English, regardless of UI language.
 * Shown on auth screens and trading-room chrome for compliance signaling.
 */
const REGULATORS = [
  {
    title: "AVSP & VAPA",
    detail: "Licensed & Regulated · Dubai",
    accent: "from-blue-400/25 via-transparent to-transparent",
    ring: "border-blue-400/30 shadow-blue-500/10",
    glow: "bg-blue-400/20",
  },
  {
    title: "ADGM",
    detail: "Regulated · Abu Dhabi Global Market",
    accent: "from-cyan-400/25 via-transparent to-transparent",
    ring: "border-cyan-400/30 shadow-cyan-500/10",
    glow: "bg-cyan-400/20",
  },
  {
    title: "CBB",
    detail: "Licensed · Central Bank of Bahrain",
    accent: "from-emerald-400/25 via-transparent to-transparent",
    ring: "border-emerald-400/30 shadow-emerald-500/10",
    glow: "bg-emerald-400/20",
  },
  {
    title: "OAM",
    detail: "Mediated by Agent Mediator",
    accent: "from-sky-400/25 via-transparent to-transparent",
    ring: "border-sky-400/30 shadow-sky-500/10",
    glow: "bg-sky-400/20",
  },
] as const;

export function AiTradingBadge({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-blue-300/50 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 text-white shadow-[0_8px_32px_rgba(37,99,235,0.18),0_2px_8px_rgba(15,23,42,0.12)] ${
        compact ? "px-5 py-4 sm:px-6 sm:py-5" : "px-6 py-5 sm:px-8 sm:py-6"
      }`}
      dir="ltr"
      lang="en"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,transparent_40%,rgba(96,165,250,0.12)_50%,transparent_60%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -end-8 -top-10 h-36 w-36 rounded-full bg-blue-400/30 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-10 -start-6 h-28 w-28 rounded-full bg-emerald-400/25 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-300/70 to-transparent"
      />

      <div className="relative flex items-start gap-3.5">
        <span
          aria-hidden
          className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-400/40 bg-cyan-400/100/15 text-sm font-bold tracking-tight text-blue-100 shadow-[0_0_20px_rgba(59,130,246,0.35)]"
        >
          AI
        </span>
        <div className="min-w-0">
          <p
            className={`font-semibold uppercase tracking-[0.2em] text-blue-200 ${
              compact ? "text-[11px] sm:text-xs" : "text-xs sm:text-[13px]"
            }`}
          >
            AI-Powered Markets
          </p>
          <p
            className={`relative mt-1.5 font-semibold tracking-tight text-white ${
              compact ? "text-base leading-snug sm:text-lg" : "text-lg leading-snug sm:text-xl"
            }`}
          >
            Trading in Crypto & Forex via Advanced AI Bots
          </p>
        </div>
      </div>
    </div>
  );
}

export function TrustRegulators({ compact = false }: { compact?: boolean }) {
  return (
    <section
      className={`relative overflow-hidden rounded-2xl border border-white/14 bg-white/[0.08] shadow-[0_8px_28px_rgba(0,0,0,0.22)] backdrop-blur-sm ${
        compact ? "p-4 sm:p-5" : "p-5 sm:p-6"
      }`}
      dir="ltr"
      lang="en"
      aria-label="Regulatory compliance"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent"
      />

      <p
        className={`font-semibold uppercase tracking-[0.22em] text-cyan-300/90 ${
          compact ? "text-[11px] sm:text-xs" : "text-xs sm:text-[13px]"
        }`}
      >
        Licensed & Regulated
      </p>

      <ul
        className={`mt-4 grid gap-3 ${
          compact ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
        }`}
      >
        {REGULATORS.map((item) => (
          <li
            key={item.title}
            className={`relative overflow-hidden rounded-xl border bg-gradient-to-br from-white/[0.06] via-[#0c1524]/80 to-[#0a1220] px-4 py-3.5 shadow-[0_4px_18px_rgba(0,0,0,0.25)] transition duration-200 hover:-translate-y-0.5 hover:border-cyan-300/30 ${item.ring}`}
          >
            <div
              aria-hidden
              className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${item.accent}`}
            />
            <div
              aria-hidden
              className={`pointer-events-none absolute -end-4 -top-4 h-16 w-16 rounded-full blur-2xl ${item.glow}`}
            />
            <p
              className={`relative font-semibold tracking-tight text-white ${
                compact ? "text-base sm:text-[17px]" : "text-lg"
              }`}
            >
              {item.title}
            </p>
            <p
              className={`relative mt-1.5 leading-snug text-slate-400 ${
                compact ? "text-xs sm:text-[13px]" : "text-sm"
              }`}
            >
              {item.detail}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function TrustComplianceBlock({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`space-y-4 ${compact ? "" : "sm:space-y-5"}`} dir="ltr" lang="en">
      <AiTradingBadge compact={compact} />
      <TrustRegulators compact={compact} />
    </div>
  );
}
