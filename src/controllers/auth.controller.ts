import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import { translate } from "../utils/i18n";
import { isProduction } from "../config/env";
import { ApiError } from "../utils/apiError";
import { buildIdDocumentUrl, readUploadedImage } from "../utils/upload";
import * as authService from "../services/auth.service";
import type {
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResendOtpInput,
  ResetPasswordInput,
  VerifyOtpInput,
} from "../validators/auth.validator";

export const register = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    throw ApiError.badRequest("auth.id_document_required");
  }

  const uploaded = readUploadedImage(req.file);
  const parsed = req.body as Omit<RegisterInput, "idDocumentPath" | "idDocumentMime" | "idDocumentData">;
  const input: RegisterInput = {
    ...parsed,
    idDocumentPath: buildIdDocumentUrl(uploaded.filename),
    idDocumentMime: uploaded.mime,
    idDocumentData: uploaded.data,
  };

  const { user, otpCode } = await authService.registerUser(input);

  sendSuccess(res, 201, translate("auth.register_success", req.lang), {
    userId: user.id,
    email: user.email,
    language: user.language,
    status: user.status,
    ...(isProduction ? {} : { otpCode }),
  });
});

export const verifyOtp = asyncHandler(async (req: Request, res: Response) => {
  const { email, code } = req.body as VerifyOtpInput;
  const user = await authService.verifyOtp(email, code);

  sendSuccess(res, 200, translate("auth.otp_verified", req.lang), {
    userId: user.id,
    email: user.email,
    is_verified: user.is_verified,
    status: user.status,
  });
});

export const resendOtp = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body as ResendOtpInput;
  const otpCode = await authService.resendOtp(email, req.lang);

  sendSuccess(res, 200, translate("auth.otp_sent", req.lang), {
    email,
    ...(isProduction ? {} : { otpCode }),
  });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as LoginInput;
  const { user, token } = await authService.loginUser(input);

  sendSuccess(res, 200, translate("auth.login_success", req.lang), {
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      balance: user.balance,
      language: user.language,
      status: user.status,
    },
  });
});

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body as ForgotPasswordInput;
  const result = await authService.requestPasswordReset(email);

  sendSuccess(res, 200, translate("auth.forgot_password_sent", req.lang), {
    email,
    ...result,
  });
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as ResetPasswordInput;
  await authService.resetPasswordWithToken(input);

  sendSuccess(res, 200, translate("auth.reset_password_success", req.lang));
});

export const resubmitIdDocument = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    throw ApiError.badRequest("auth.id_document_required");
  }

  const { email, password } = req.body as LoginInput;
  const uploaded = readUploadedImage(req.file);
  const result = await authService.resubmitIdDocument(email, password, uploaded);
  sendSuccess(res, 200, translate("auth.id_document_updated", req.lang), result);
});
