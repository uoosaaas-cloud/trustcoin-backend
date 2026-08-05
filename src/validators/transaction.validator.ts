import { z } from "zod";
import { DEPOSIT_NETWORKS } from "./deposit.validator";

const TRON_ADDRESS_RE = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export const createWithdrawalSchema = z
  .object({
    amount: z
      .union([z.string(), z.number()])
      .transform((value) => String(value))
      .refine((value) => Number(value) > 0, "Amount must be greater than zero"),
    network: z.enum(DEPOSIT_NETWORKS),
    payment_address: z.string().min(1, "Destination address is required"),
    note: z.string().optional(),
    otp_code: z
      .string()
      .trim()
      .regex(/^\d{6}$/, "A valid 6-digit OTP code is required"),
  })
  .superRefine((data, ctx) => {
    const address = data.payment_address.trim();
    const network = data.network;

    if (network === "TRC20") {
      if (!TRON_ADDRESS_RE.test(address)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["payment_address"],
          message: "Invalid TRC20 (TRON) wallet address",
        });
      }
      return;
    }

    if (!EVM_ADDRESS_RE.test(address)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["payment_address"],
        message: `Invalid ${network} (EVM) wallet address`,
      });
    }
  });

export type CreateWithdrawalInput = z.infer<typeof createWithdrawalSchema>;
