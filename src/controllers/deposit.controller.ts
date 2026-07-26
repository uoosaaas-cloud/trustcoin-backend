import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import { translate } from "../utils/i18n";
import * as depositService from "../services/deposit.service";
import type { GetDepositAddressQuery } from "../validators/deposit.validator";

export const getDepositNetworks = asyncHandler(async (req: Request, res: Response) => {
  const networks = depositService.getDepositNetworks();
  sendSuccess(res, 200, translate("deposits.networks_fetched", req.lang), networks);
});

export const getMyDepositAddress = asyncHandler(async (req: Request, res: Response) => {
  const { network } = req.query as unknown as GetDepositAddressQuery;
  const address = await depositService.getUserDepositAddress(req.user!.id, network);
  sendSuccess(res, 200, translate("deposits.address_fetched", req.lang), address);
});

export const getMyDepositHistory = asyncHandler(async (req: Request, res: Response) => {
  const history = await depositService.listUserDepositRequests(req.user!.id);
  sendSuccess(res, 200, translate("deposits.history_fetched", req.lang), history);
});
