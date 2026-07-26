import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import { translate } from "../utils/i18n";
import * as referralService from "../services/referral.service";
import { referralStatsQuerySchema } from "../validators/referral.validator";

export const getMyReferralStats = asyncHandler(async (req: Request, res: Response) => {
  const query = referralStatsQuerySchema.parse(req.query);
  const stats = await referralService.getReferralStats(req.user!.id, query);
  sendSuccess(res, 200, translate("referrals.stats_fetched", req.lang), stats);
});
