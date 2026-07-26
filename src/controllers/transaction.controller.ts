import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import { translate } from "../utils/i18n";
import { isProduction } from "../config/env";
import * as transactionService from "../services/transaction.service";
import type { CreateWithdrawalInput } from "../validators/transaction.validator";

export const getMyTransactions = asyncHandler(async (req: Request, res: Response) => {
  const transactions = await transactionService.listUserTransactions(req.user!.id);
  sendSuccess(res, 200, translate("transactions.list_fetched", req.lang), transactions);
});

export const createWithdrawal = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as CreateWithdrawalInput;
  const transaction = await transactionService.createWithdrawal(req.user!.id, input);

  sendSuccess(res, 201, translate("transactions.withdrawal_created", req.lang), transaction);
});

export const sendWithdrawalOtp = asyncHandler(async (req: Request, res: Response) => {
  const otpCode = await transactionService.sendWithdrawalOtp(req.user!.id);

  sendSuccess(res, 200, translate("auth.otp_sent", req.lang), {
    email: req.user!.email,
    ...(isProduction ? {} : { otpCode }),
  });
});
