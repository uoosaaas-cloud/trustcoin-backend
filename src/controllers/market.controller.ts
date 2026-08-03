import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import { translate } from "../utils/i18n";
import { getMarketsOverview } from "../services/market.service";

export const getMarketsOverviewHandler = asyncHandler(async (req: Request, res: Response) => {
  const data = await getMarketsOverview();
  sendSuccess(res, 200, translate("markets.overview_fetched", req.lang), data);
});
