import { z } from "zod";

export const distributeGiftsSchema = z
  .object({
    amount: z
      .union([z.string(), z.number()])
      .transform((value) => String(value).trim())
      .refine((value) => Number(value) > 0, "Gift amount must be greater than zero")
      .refine((value) => Number(value) <= 100_000, "Gift amount cannot exceed 100000 USDT"),
    note: z.string().trim().max(240).optional(),
    scope: z.enum(["ALL_EXCEPT_ADMIN", "SELECTED"]),
    userIds: z.array(z.string().uuid()).max(500).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.scope === "SELECTED" && (!data.userIds || data.userIds.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["userIds"],
        message: "Select at least one user",
      });
    }
  });

export type DistributeGiftsInput = z.infer<typeof distributeGiftsSchema>;
