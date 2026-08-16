import { z } from "zod";

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

function normalizeAmountInput(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value !== "string") {
    return "";
  }

  const mapped = value
    .trim()
    .replace(/[٠-٩]/g, (digit) => String(ARABIC_DIGITS.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String(PERSIAN_DIGITS.indexOf(digit)))
    .replace(/\s+/g, "")
    .replace(/[^\d.,-]/g, "");

  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(mapped)) {
    return mapped.replace(/,/g, "");
  }

  if (/^\d+,\d+$/.test(mapped)) {
    return mapped.replace(",", ".");
  }

  return mapped;
}

function normalizeScope(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (normalized === "ALL" || normalized === "ALL_USERS" || normalized === "EVERYONE") {
    return "ALL_EXCEPT_ADMIN";
  }
  if (normalized === "SOME" || normalized === "USERS" || normalized === "ON") {
    return "SELECTED";
  }
  return normalized;
}

function normalizeUserIds(value: unknown): string[] | undefined {
  if (value == null || value === "") return undefined;
  const list = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,\s]+/)
      : [];
  const ids = list
    .map((id) => (typeof id === "string" ? id.trim() : ""))
    .filter((id) => id.length > 0 && id !== "undefined" && id !== "null");
  return ids.length ? ids : undefined;
}

export const distributeGiftsSchema = z.preprocess(
  (raw) => {
    if (!raw || typeof raw !== "object") return raw;
    const body = raw as Record<string, unknown>;
    const note = body.note;
    return {
      amount: normalizeAmountInput(body.amount),
      note: typeof note === "string" ? note : undefined,
      scope: normalizeScope(body.scope),
      userIds: normalizeUserIds(body.userIds ?? body.user_ids),
    };
  },
  z
    .object({
      amount: z
        .string()
        .min(1, "Gift amount is required")
        .refine((value) => Number(value) > 0, "Gift amount must be greater than zero")
        .refine((value) => Number(value) <= 100_000, "Gift amount cannot exceed 100000 USDT"),
      note: z.string().trim().max(500).optional(),
      scope: z.enum(["ALL_EXCEPT_ADMIN", "SELECTED"]),
      userIds: z.array(z.string().min(1).max(64)).max(500).optional(),
    })
    .superRefine((data, ctx) => {
      if (data.scope === "SELECTED" && (!data.userIds || data.userIds.length === 0)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["userIds"],
          message: "Select at least one user",
        });
      }
    })
);

export type DistributeGiftsInput = {
  amount: string;
  note?: string;
  scope: "ALL_EXCEPT_ADMIN" | "SELECTED";
  userIds?: string[];
};
