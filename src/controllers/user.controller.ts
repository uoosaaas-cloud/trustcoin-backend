import { Request, Response } from "express";
import { prisma } from "../config/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import { translate } from "../utils/i18n";
import { ApiError } from "../utils/apiError";
import { getWalletBalanceSummary } from "../services/wallet.service";

export const getMyProfile = asyncHandler(async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });

  if (!user) {
    throw ApiError.notFound();
  }

  const wallet = await getWalletBalanceSummary(user.id);

  sendSuccess(res, 200, translate("user.profile_fetched", req.lang), {
    id: user.id,
    email: user.email,
    /** @deprecated Prefer `wallet.availableBalance` — kept for older clients. */
    balance: wallet.availableBalance,
    wallet,
    is_verified: user.is_verified,
    role: user.role,
    status: user.status,
    language: user.language,
    referral_code: user.referral_code,
    referralCode: user.referral_code,
    referred_by_id: user.referred_by_id,
    referredBy: user.referred_by_id,
    referrals_count: user.referrals_count,
    referralsCount: user.referrals_count,
    created_at: user.created_at,
  });
});

export const getMyWallet = asyncHandler(async (req: Request, res: Response) => {
  const wallet = await getWalletBalanceSummary(req.user!.id);
  sendSuccess(res, 200, translate("user.wallet_fetched", req.lang), wallet);
});

export const updateMyLanguage = asyncHandler(async (req: Request, res: Response) => {
  const { language } = req.body as { language: "en" | "ar" };

  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: { language },
  });

  sendSuccess(res, 200, translate("user.language_updated", req.lang), { language: user.language });
});
