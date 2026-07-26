import { z } from "zod";

export const createInvestmentSchema = z.object({
  packageId: z.string().uuid(),
  /** Optional — when omitted, the package's fixed `amount` is used. */
  amount: z
    .union([z.string(), z.number()])
    .transform((value) => String(value))
    .refine((value) => Number(value) > 0, "Amount must be greater than zero")
    .optional(),
});

/** Same payload as `createInvestmentSchema` — used by `POST /investments/purchase`. */
export const purchaseInvestmentSchema = createInvestmentSchema;

export type CreateInvestmentInput = z.infer<typeof createInvestmentSchema>;
export type PurchaseInvestmentInput = z.infer<typeof purchaseInvestmentSchema>;
