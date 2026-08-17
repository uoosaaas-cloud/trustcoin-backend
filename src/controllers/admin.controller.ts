import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import { translate } from "../utils/i18n";
import * as adminService from "../services/admin.service";
import * as tradeService from "../services/trade.service";
import { getClientIp, recordFailedAdminAttempt, clearFailedAdminAttempts } from "../middlewares/ipGuard.middleware";
import { ApiError } from "../utils/apiError";
import { runDepositSweepJob } from "../jobs/depositSweep.job";
import { distributeGifts } from "../services/gift.service";
import type { TriggerSweepInput } from "../validators/sweep.validator";
import type { DistributeGiftsInput } from "../validators/gift.validator";

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body as { email: string; password: string };
  const ip = getClientIp(req);

  try {
    const challenge = await adminService.loginAdmin(email, password);
    clearFailedAdminAttempts(ip);

    sendSuccess(res, 200, translate("auth.admin_otp_sent", req.lang), challenge);
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 401) {
      await recordFailedAdminAttempt(ip);
    }
    throw error;
  }
});

export const verifyLoginOtp = asyncHandler(async (req: Request, res: Response) => {
  const { email, code } = req.body as { email: string; code: string };
  const ip = getClientIp(req);

  try {
    const { user, token } = await adminService.verifyAdminLoginOtp(email, code);
    clearFailedAdminAttempts(ip);

    sendSuccess(res, 200, translate("auth.login_success", req.lang), {
      token,
      user: { id: user.id, email: user.email, role: user.role },
    });
  } catch (error) {
    if (error instanceof ApiError && (error.statusCode === 401 || error.statusCode === 400)) {
      await recordFailedAdminAttempt(ip);
    }
    throw error;
  }
});

export const getUsers = asyncHandler(async (req: Request, res: Response) => {
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const users = await adminService.listUsers(search, status);
  sendSuccess(res, 200, translate("common.fetched", req.lang), users);
});

export const getUserIdDocument = asyncHandler(async (req: Request, res: Response) => {
  const document = await adminService.getUserIdDocument(req.params.userId);
  res.setHeader("Content-Type", document.mime);
  res.setHeader("Content-Length", String(document.data.length));
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.status(200).end(document.data);
});

export const requestIdDocumentReupload = asyncHandler(async (req: Request, res: Response) => {
  const result = await adminService.requestIdDocumentReupload(req.params.userId, req.user!.id);
  sendSuccess(res, 200, translate("admin.id_reupload_requested", req.lang), result);
});

export const approveUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await adminService.approveUser(req.params.userId, req.user!.id);
  sendSuccess(res, 200, translate("common.action_success", req.lang), user);
});

export const blockUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await adminService.blockUser(req.params.userId, req.user!.id);
  sendSuccess(res, 200, translate("common.action_success", req.lang), user);
});

export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  const result = await adminService.deleteUser(req.params.userId, req.user!.id);
  sendSuccess(res, 200, translate("common.action_success", req.lang), result);
});

export const getReferralOverview = asyncHandler(async (req: Request, res: Response) => {
  const overview = await adminService.getReferralAdminOverview();
  sendSuccess(res, 200, translate("common.fetched", req.lang), overview);
});

export const getOverview = asyncHandler(async (req: Request, res: Response) => {
  const stats = await adminService.getOverviewStats();
  sendSuccess(res, 200, translate("common.fetched", req.lang), stats);
});

export const getAdminLogs = asyncHandler(async (req: Request, res: Response) => {
  const logs = await adminService.listAdminLogs();
  sendSuccess(res, 200, translate("common.fetched", req.lang), logs);
});

export const getBannedIps = asyncHandler(async (req: Request, res: Response) => {
  const ips = await adminService.listBannedIps();
  sendSuccess(res, 200, translate("common.fetched", req.lang), ips);
});

export const unbanIp = asyncHandler(async (req: Request, res: Response) => {
  const { ip } = req.params;
  await adminService.unbanIp(ip);
  sendSuccess(res, 200, translate("common.action_success", req.lang));
});

export const getPendingTransactions = asyncHandler(async (req: Request, res: Response) => {
  const transactions = await adminService.listPendingTransactions();
  sendSuccess(res, 200, translate("common.fetched", req.lang), transactions);
});

export const getPendingWithdrawals = asyncHandler(async (req: Request, res: Response) => {
  const withdrawals = await adminService.listPendingWithdrawals();
  sendSuccess(res, 200, translate("common.fetched", req.lang), withdrawals);
});

export const approveDeposit = asyncHandler(async (req: Request, res: Response) => {
  const { transactionId } = req.params;
  const transaction = await adminService.approveDeposit(transactionId, req.user!.id);
  sendSuccess(res, 200, translate("common.action_success", req.lang), transaction);
});

export const approveWithdrawal = asyncHandler(async (req: Request, res: Response) => {
  const { transactionId } = req.params;
  const transaction = await adminService.approveWithdrawal(transactionId, req.user!.id);
  sendSuccess(res, 200, translate("common.action_success", req.lang), transaction);
});

export const rejectWithdrawal = asyncHandler(async (req: Request, res: Response) => {
  const { transactionId } = req.params;
  const transaction = await adminService.rejectWithdrawal(transactionId, req.user!.id);
  sendSuccess(res, 200, translate("common.action_success", req.lang), transaction);
});

export const getPendingReferralRewards = asyncHandler(async (req: Request, res: Response) => {
  const rewards = await adminService.listPendingReferralRewards();
  sendSuccess(res, 200, translate("common.fetched", req.lang), rewards);
});

export const approveReferralReward = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await adminService.approveReferralReward(id, req.user!.id);
  sendSuccess(res, 200, translate("referrals.approved", req.lang), result);
});

export const rejectReferralReward = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const reward = await adminService.rejectReferralReward(id, req.user!.id);
  sendSuccess(res, 200, translate("referrals.rejected", req.lang), reward);
});

export const triggerDepositSweep = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as TriggerSweepInput;
  const summary = await runDepositSweepJob({
    depositAddressId: input.depositAddressId,
    address: input.address,
    network: input.network,
    dryRun: input.dryRun,
    force: input.force,
  });
  sendSuccess(res, 200, translate("deposits.sweep_triggered", req.lang), summary);
});

export const getPackages = asyncHandler(async (req: Request, res: Response) => {
  const packages = await adminService.listAdminPackages();
  sendSuccess(res, 200, translate("common.fetched", req.lang), packages);
});

export const updatePackage = asyncHandler(async (req: Request, res: Response) => {
  const updated = await adminService.updateAdminPackage(req.params.packageId, req.user!.id, req.body);
  sendSuccess(res, 200, translate("admin.package_updated", req.lang), updated);
});

export const getDepositMonitoring = asyncHandler(async (req: Request, res: Response) => {
  const overview = await adminService.getDepositMonitoringOverview();
  sendSuccess(res, 200, translate("common.fetched", req.lang), overview);
});

export const sendGifts = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as DistributeGiftsInput;
  const result = await distributeGifts(req.user!.id, input);
  sendSuccess(res, 200, translate("admin.gifts_distributed", req.lang), result);
});

export const listTrades = asyncHandler(async (req: Request, res: Response) => {
  const trades = await tradeService.listTradesForAdmin();
  sendSuccess(res, 200, translate("trade.list_fetched", req.lang), trades);
});

export const createTrade = asyncHandler(async (req: Request, res: Response) => {
  const trade = await tradeService.createTrade(req.user!.id, req.body);
  sendSuccess(res, 201, translate("trade.created", req.lang), trade);
});

export const updateTrade = asyncHandler(async (req: Request, res: Response) => {
  const trade = await tradeService.updateTrade(req.user!.id, req.params.tradeId, req.body);
  sendSuccess(res, 200, translate("trade.updated", req.lang), trade);
});

export const deleteTrade = asyncHandler(async (req: Request, res: Response) => {
  const result = await tradeService.deleteTrade(req.user!.id, req.params.tradeId);
  sendSuccess(res, 200, translate("trade.deleted", req.lang), result);
});
