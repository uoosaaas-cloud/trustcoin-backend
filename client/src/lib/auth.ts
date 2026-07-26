import { api, setStoredAuthToken, type ApiSuccessResponse } from "./api";

export interface RegisterPayload {
  email: string;
  password: string;
  language: "en" | "ar";
  referralCode?: string;
  idPassportNumber: string;
  idDocument: File;
}

export interface RegisterResponseData {
  userId: string;
  email: string;
  language: string;
  status: string;
  /** Only present outside production, when the backend has no SMTP configured. */
  otpCode?: string;
}

export interface VerifyOtpPayload {
  email: string;
  code: string;
}

export interface VerifyOtpResponseData {
  userId: string;
  email: string;
  is_verified: boolean;
  status: string;
}

export interface ResendOtpPayload {
  email: string;
}

export interface ResendOtpResponseData {
  email: string;
  otpCode?: string;
}

export async function registerUser(payload: RegisterPayload) {
  const formData = new FormData();
  formData.set("email", payload.email);
  formData.set("password", payload.password);
  formData.set("language", payload.language);
  formData.set("idPassportNumber", payload.idPassportNumber);
  if (payload.referralCode) {
    formData.set("referralCode", payload.referralCode);
  }
  formData.set("idDocument", payload.idDocument);

  // Let the browser set multipart boundary (same pattern as deposit uploads).
  const { data } = await api.post<ApiSuccessResponse<RegisterResponseData>>("/auth/register", formData);
  return data;
}

export async function verifyOtp(payload: VerifyOtpPayload) {
  const { data } = await api.post<ApiSuccessResponse<VerifyOtpResponseData>>("/auth/verify-otp", payload);
  return data;
}

export async function resendOtp(payload: ResendOtpPayload) {
  const { data } = await api.post<ApiSuccessResponse<ResendOtpResponseData>>("/auth/resend-otp", payload);
  return data;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthUser {
  id: string;
  email: string;
  role: "USER" | "ADMIN";
  balance: string;
  language: string;
}

export interface LoginResponseData {
  token: string;
  user: AuthUser;
}

export async function loginUser(payload: LoginPayload) {
  const { data } = await api.post<ApiSuccessResponse<LoginResponseData>>("/auth/login", payload);
  return data;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface ForgotPasswordResponseData {
  email: string;
  /** Present only outside production for local testing. */
  resetLink?: string;
}

export interface ResetPasswordPayload {
  token: string;
  newPassword: string;
}

export async function forgotPassword(payload: ForgotPasswordPayload) {
  const { data } = await api.post<ApiSuccessResponse<ForgotPasswordResponseData>>(
    "/auth/forgot-password",
    payload
  );
  return data;
}

export async function resetPassword(payload: ResetPasswordPayload) {
  const { data } = await api.post<ApiSuccessResponse<null>>("/auth/reset-password", payload);
  return data;
}

const AUTH_USER_STORAGE_KEY = "trustcoin_user";

/** Reads the cached profile of the currently logged-in user (if any). */
export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(AUTH_USER_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

function setStoredUser(user: AuthUser | null): void {
  if (typeof window === "undefined") {
    return;
  }

  if (user) {
    window.localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user));
  } else {
    window.localStorage.removeItem(AUTH_USER_STORAGE_KEY);
  }
}

/** Persists the full authenticated session (JWT + user profile) after a successful login. */
export function persistAuthSession(data: LoginResponseData): void {
  setStoredAuthToken(data.token);
  setStoredUser(data.user);
}

/** Clears the authenticated session — use when logging out or on a 401. */
export function clearAuthSession(): void {
  setStoredAuthToken(null);
  setStoredUser(null);
}
