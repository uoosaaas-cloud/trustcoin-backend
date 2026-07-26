type BadgeStatus = "PENDING" | "APPROVED" | "REJECTED" | "COMPLETED" | "FAILED";

const STATUS_STYLES: Record<BadgeStatus, string> = {
  PENDING: "bg-blue-100 text-blue-700 border-blue-200",
  APPROVED: "bg-red-100 text-red-700 border-red-200",
  COMPLETED: "bg-green-100 text-green-700 border-green-200",
  REJECTED: "bg-rose-100 text-rose-700 border-rose-200",
  FAILED: "bg-rose-100 text-rose-700 border-rose-200",
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
