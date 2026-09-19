import { z } from "zod";

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export const sendAdminUserEmailSchema = z.preprocess(
  (raw) => {
    if (!raw || typeof raw !== "object") return raw;
    const body = raw as Record<string, unknown>;
    const message =
      typeof body.body === "string"
        ? body.body
        : typeof body.message === "string"
          ? body.message
          : "";
    const email = normalizeOptionalString(body.email);
    return {
      userId: normalizeOptionalString(body.userId ?? body.user_id),
      email: email ? email.toLowerCase() : undefined,
      subject: typeof body.subject === "string" ? body.subject.trim() : "",
      body: typeof message === "string" ? message.trim() : "",
    };
  },
  z
    .object({
      userId: z.string().min(1).max(64).optional(),
      email: z.string().email().max(320).optional(),
      subject: z.string().min(1, "Subject is required").max(200),
      body: z.string().min(1, "Message body is required").max(20_000),
    })
    .superRefine((data, ctx) => {
      if (!data.userId && !data.email) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["email"],
          message: "Select a user or enter their email",
        });
      }
    })
);

export type SendAdminUserEmailInput = {
  userId?: string;
  email?: string;
  subject: string;
  body: string;
};
