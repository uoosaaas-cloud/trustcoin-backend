import { z } from "zod";

export const referralStatsQuerySchema = z.object({
  limit: z
    .union([z.string(), z.number()])
    .optional()
    .transform((value) => {
      if (value === undefined) return 50;
      const n = Number(value);
      if (!Number.isFinite(n) || n < 1) return 50;
      return Math.min(Math.floor(n), 100);
    }),
  offset: z
    .union([z.string(), z.number()])
    .optional()
    .transform((value) => {
      if (value === undefined) return 0;
      const n = Number(value);
      if (!Number.isFinite(n) || n < 0) return 0;
      return Math.floor(n);
    }),
});

export type ReferralStatsQuery = z.infer<typeof referralStatsQuerySchema>;
