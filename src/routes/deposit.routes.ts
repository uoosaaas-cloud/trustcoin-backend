import { Router } from "express";
import * as depositController from "../controllers/deposit.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { validateQuery } from "../middlewares/validate.middleware";
import { getDepositAddressQuerySchema } from "../validators/deposit.validator";

const router = Router();

router.use(authMiddleware);

router.get("/networks", depositController.getDepositNetworks);
router.get("/address", validateQuery(getDepositAddressQuerySchema), depositController.getMyDepositAddress);
router.get("/history", depositController.getMyDepositHistory);

export default router;
