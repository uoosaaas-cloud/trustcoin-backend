import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import { validateBody } from "../middlewares/validate.middleware";
import {
  registerSchema,
  loginSchema,
  verifyOtpSchema,
  resendOtpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "../validators/auth.validator";
import { authRateLimiter, resendOtpRateLimiter } from "../middlewares/rateLimiter.middleware";
import { idDocumentUpload } from "../utils/upload";

const router = Router();

router.post(
  "/register",
  authRateLimiter,
  idDocumentUpload.single("idDocument"),
  validateBody(registerSchema),
  authController.register
);
router.post("/verify-otp", authRateLimiter, validateBody(verifyOtpSchema), authController.verifyOtp);
router.post(
  "/resend-otp",
  resendOtpRateLimiter,
  validateBody(resendOtpSchema),
  authController.resendOtp
);
router.post("/login", authRateLimiter, validateBody(loginSchema), authController.login);
router.post(
  "/forgot-password",
  authRateLimiter,
  validateBody(forgotPasswordSchema),
  authController.forgotPassword
);
router.post(
  "/reset-password",
  authRateLimiter,
  validateBody(resetPasswordSchema),
  authController.resetPassword
);
router.post(
  "/resubmit-id-document",
  authRateLimiter,
  idDocumentUpload.single("idDocument"),
  validateBody(loginSchema),
  authController.resubmitIdDocument
);

export default router;
