import { Router } from "express";
import * as adminController from "../controllers/admin.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { adminOnlyMiddleware } from "../middlewares/adminOnly.middleware";
import { ipGuardMiddleware } from "../middlewares/ipGuard.middleware";
import { adminActionsRateLimiter, adminLoginRateLimiter } from "../middlewares/rateLimiter.middleware";
import { validateBody } from "../middlewares/validate.middleware";
import { loginSchema, verifyOtpSchema } from "../validators/auth.validator";
import { triggerSweepSchema } from "../validators/sweep.validator";
import { updateAdminPackageSchema } from "../validators/adminPackage.validator";

const router = Router();

// Every admin route is protected from banned IPs first.
router.use(ipGuardMiddleware);

router.post("/login", adminLoginRateLimiter, validateBody(loginSchema), adminController.login);
router.post(
  "/verify-login-otp",
  adminLoginRateLimiter,
  validateBody(verifyOtpSchema),
  adminController.verifyLoginOtp
);

// Everything below requires a valid admin JWT + action throttle.
router.use(authMiddleware, adminOnlyMiddleware, adminActionsRateLimiter);

router.get("/overview", adminController.getOverview);
router.get("/users", adminController.getUsers);
router.post("/users/:userId/approve", adminController.approveUser);
router.post("/users/:userId/block", adminController.blockUser);
router.delete("/users/:userId", adminController.deleteUser);
router.get("/referrals/overview", adminController.getReferralOverview);
router.get("/logs", adminController.getAdminLogs);
router.get("/banned-ips", adminController.getBannedIps);
router.delete("/banned-ips/:ip", adminController.unbanIp);

router.get("/transactions/pending", adminController.getPendingTransactions);
router.get("/withdrawals/pending", adminController.getPendingWithdrawals);
router.post("/transactions/:transactionId/approve-deposit", adminController.approveDeposit);
router.post("/transactions/:transactionId/approve-withdrawal", adminController.approveWithdrawal);
router.post("/transactions/:transactionId/reject-withdrawal", adminController.rejectWithdrawal);

router.get("/referrals/pending", adminController.getPendingReferralRewards);
router.post("/referrals/:id/approve", adminController.approveReferralReward);
router.post("/referrals/:id/reject", adminController.rejectReferralReward);

router.get("/packages", adminController.getPackages);
router.patch(
  "/packages/:packageId",
  validateBody(updateAdminPackageSchema),
  adminController.updatePackage
);

router.get("/deposits/monitoring", adminController.getDepositMonitoring);
router.post("/deposits/trigger-sweep", validateBody(triggerSweepSchema), adminController.triggerDepositSweep);

export default router;
