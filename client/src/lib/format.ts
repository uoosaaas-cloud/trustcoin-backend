/** Always format with Western (ASCII) digits, regardless of UI language. */
const NUMBER_LOCALE = "en-US";

export function formatUsdt(value: string | number): string {
  const num = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(num)) return String(value);
  return num.toLocaleString(NUMBER_LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
}

export function formatInteger(value: string | number): string {
  const num = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(num)) return String(value);
  return num.toLocaleString(NUMBER_LOCALE, { maximumFractionDigits: 0 });
}

export function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(NUMBER_LOCALE, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(NUMBER_LOCALE, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}
