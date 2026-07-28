type BadgeStatus = "PENDING" | "APPROVED" | "REJECTED" | "COMPLETED" | "FAILED";

const STATUS_STYLES: Record<BadgeStatus, string> = {
  PENDING: "bg-cyan-400/15 text-cyan-300 border-cyan-400/30",
  APPROVED: "bg-emerald-400/15 text-emerald-300 border-emerald-400/30",
  COMPLETED: "bg-emerald-400/15 text-emerald-300 border-emerald-400/30",
  REJECTED: "bg-rose-400/15 text-rose-300 border-rose-400/30",
  FAILED: "bg-rose-400/15 text-rose-300 border-rose-400/30",
};

export function StatusBadge({ status, label }: { status: BadgeStatus; label: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[status]}`}
    >
      {label}
    </span>
  );
}
