import { Router } from "express";
import * as referralController from "../controllers/referral.controller";
import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router();

router.use(authMiddleware);

router.get("/stats", referralController.getMyReferralStats);

export default router;
