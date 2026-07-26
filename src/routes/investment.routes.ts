import { Router } from "express";
import * as investmentController from "../controllers/investment.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { validateBody } from "../middlewares/validate.middleware";
import { createInvestmentSchema, purchaseInvestmentSchema } from "../validators/investment.validator";

const router = Router();

router.get("/packages", investmentController.getPackages);
router.get("/my", authMiddleware, investmentController.getMyInvestments);
router.post("/", authMiddleware, validateBody(createInvestmentSchema), investmentController.createInvestment);
router.post(
  "/purchase",
  authMiddleware,
  validateBody(purchaseInvestmentSchema),
  investmentController.purchaseInvestment
);

export default router;
