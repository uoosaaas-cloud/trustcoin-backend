import { Router } from "express";
import * as userController from "../controllers/user.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { validateBody } from "../middlewares/validate.middleware";
import { updateLanguageSchema } from "../validators/user.validator";

const router = Router();

router.use(authMiddleware);

router.get("/me", userController.getMyProfile);
router.get("/me/wallet", userController.getMyWallet);
router.patch("/me/language", validateBody(updateLanguageSchema), userController.updateMyLanguage);

export default router;
