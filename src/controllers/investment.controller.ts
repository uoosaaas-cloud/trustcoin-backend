import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import { translate } from "../utils/i18n";
import * as investmentService from "../services/investment.service";
import { getWalletBalanceSummary } from "../services/wallet.service";
import type { CreateInvestmentInput, PurchaseInvestmentInput } from "../validators/investment.validator";

export const getPackages = asyncHandler(async (req: Request, res: Response) => {
  const packages = await investmentService.listPackages();
  sendSuccess(res, 200, translate("investments.packages_fetched", req.lang), packages);
});

export const getMyInvestments = asyncHandler(async (req: Request, res: Response) => {
  const investments = await investmentService.listUserInvestments(req.user!.id);
  sendSuccess(res, 200, translate("investments.list_fetched", req.lang), investments);
});

export const createInvestment = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as CreateInvestmentInput;
  const investment = await investmentService.purchaseInvestment(req.user!.id, input);

  sendSuccess(res, 201, translate("investments.created", req.lang), investment);
});

export const purchaseInvestment = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as PurchaseInvestmentInput;
  const investment = await investmentService.purchaseInvestment(req.user!.id, input);
  const wallet = await getWalletBalanceSummary(req.user!.id);

  sendSuccess(res, 201, translate("investments.purchased", req.lang), { investment, wallet });
});
