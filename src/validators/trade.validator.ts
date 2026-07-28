import { z } from "zod";

export const createTradeSchema = z.object({
  symbol: z
    .string()
    .trim()
    .min(2)
    .max(32)
    .transform((value) => value.toUpperCase().replace(/\s+/g, "")),
  side: z.enum(["BUY", "SELL"]),
  amount: z.coerce.number().positive().max(1_000_000_000),
  outcome: z.enum(["PROFITABLE", "LOSS", "PENDING"]).default("PROFITABLE"),
  note: z.string().trim().max(255).optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export const updateTradeSchema = z.object({
  symbol: z
    .string()
    .trim()
    .min(2)
    .max(32)
    .transform((value) => value.toUpperCase().replace(/\s+/g, ""))
    .optional(),
  side: z.enum(["BUY", "SELL"]).optional(),
  amount: z.coerce.number().positive().max(1_000_000_000).optional(),
  outcome: z.enum(["PROFITABLE", "LOSS", "PENDING"]).optional(),
  note: z.string().trim().max(255).optional().nullable(),
  isActive: z.boolean().optional(),
});

export type CreateTradeInput = z.infer<typeof createTradeSchema>;
export type UpdateTradeInput = z.infer<typeof updateTradeSchema>;
