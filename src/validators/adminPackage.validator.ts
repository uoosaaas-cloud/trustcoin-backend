import { z } from "zod";

const positiveDecimalString = z
  .union([z.string(), z.number()])
  .transform((value) => String(value).trim())
  .refine((value) => Number.isFinite(Number(value)) && Number(value) > 0, "Must be a positive number");

const nonNegativeDecimalString = z
  .union([z.string(), z.number()])
  .transform((value) => String(value).trim())
  .refine((value) => Number.isFinite(Number(value)) && Number(value) >= 0, "Must be a non-negative number");

/** Admin package profit / configuration update body. */
export const updateAdminPackageSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    amount: positiveDecimalString.optional(),
    daily_profit_percent: z
      .union([z.string(), z.number()])
      .transform((value) => String(value).trim())
      .refine(
        (value) => Number.isFinite(Number(value)) && Number(value) > 0 && Number(value) <= 9.9999,
        "Daily profit percent must be between 0 and 9.9999"
      )
      .optional(),
    duration_days: z
      .union([z.string(), z.number()])
      .transform((value) => Number(value))
      .refine((value) => Number.isInteger(value) && value >= 1 && value <= 3650, "Invalid duration")
      .optional(),
    referral_bonus_1m: nonNegativeDecimalString.optional(),
    referral_bonus_3m: nonNegativeDecimalString.optional(),
    referral_bonus_6m: nonNegativeDecimalString.optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: "Provide at least one field to update",
  });

export type UpdateAdminPackageInput = z.infer<typeof updateAdminPackageSchema>;
