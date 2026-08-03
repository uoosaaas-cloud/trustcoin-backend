import { Router } from "express";
import authRoutes from "./auth.routes";
import userRoutes from "./user.routes";
import investmentRoutes from "./investment.routes";
import transactionRoutes from "./transaction.routes";
import adminRoutes from "./admin.routes";
import referralRoutes from "./referral.routes";
import depositRoutes from "./deposit.routes";
import marketRoutes from "./market.routes";

const router = Router();

router.get("/health", (_req, res) => {
  res.status(200).json({ success: true, message: "TrustCoin API is running." });
});

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/investments", investmentRoutes);
router.use("/transactions", transactionRoutes);
router.use("/admin", adminRoutes);
router.use("/referrals", referralRoutes);
router.use("/deposit", depositRoutes);
router.use("/markets", marketRoutes);

export default router;
