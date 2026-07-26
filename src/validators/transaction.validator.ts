import { z } from "zod";

export const createWithdrawalSchema = z.object({
  amount: z
    .union([z.string(), z.number()])
    .transform((value) => String(value))
    .refine((value) => Number(value) > 0, "Amount must be greater than zero"),
  payment_address: z.string().min(1, "Destination address is required"),
  note: z.string().optional(),
  otp_code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "A valid 6-digit OTP code is required"),
});

export type CreateWithdrawalInput = z.infer<typeof createWithdrawalSchema>;
