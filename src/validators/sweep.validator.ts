import { z } from "zod";
import { DEPOSIT_NETWORKS } from "./deposit.validator";

export const triggerSweepSchema = z.object({
  depositAddressId: z.string().uuid().optional(),
  /** On-chain deposit address (e.g. a Tron `T...` address). */
  address: z.string().trim().min(20).max(128).optional(),
  network: z.enum(DEPOSIT_NETWORKS).optional(),
  dryRun: z.boolean().optional().default(false),
  /** Bypass the 24h max-failure backoff for this run. */
  force: z.boolean().optional().default(false),
});

export type TriggerSweepInput = z.infer<typeof triggerSweepSchema>;
