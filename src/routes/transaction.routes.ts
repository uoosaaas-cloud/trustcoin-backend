import { Router } from "express";
import * as transactionController from "../controllers/transaction.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { validateBody } from "../middlewares/validate.middleware";
import { createWithdrawalSchema } from "../validators/transaction.validator";

const router = Router();

router.use(authMiddleware);

router.get("/", transactionController.getMyTransactions);
router.post("/withdraw/send-otp", transactionController.sendWithdrawalOtp);
router.post("/withdraw", validateBody(createWithdrawalSchema), transactionController.createWithdrawal);

export default router;
