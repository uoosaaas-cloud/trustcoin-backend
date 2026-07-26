import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

/**
 * Shape of every response returned by the TrustCoin backend
 * (see src/utils/apiResponse.ts on the server).
 */
export interface ApiSuccessResponse<T = unknown> {
  success: true;
  message: string;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  messageKey?: string | null;
  details?: unknown;
}

export const AUTH_TOKEN_STORAGE_KEY = "trustcoin_token";

export function getStoredAuthToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
}

export function setStoredAuthToken(token: string | null): void {
  if (typeof window === "undefined") {
    return;
  }
  if (token) {
    window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
  } else {
    window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  }
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1";

/**
 * Shared Axios instance for every request to the TrustCoin backend.
 * - Automatically attaches the JWT (`Authorization: Bearer <token>`) once the
 *   user is logged in.
 * - Forwards the active UI language via the `x-lang` header so the backend
 *   returns messages (and OTP emails) in the same language as the UI.
 */
export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getStoredAuthToken();

  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }

  // FormData must keep the browser-generated multipart boundary.
  if (typeof FormData !== "undefined" && config.data instanceof FormData) {
    config.headers.delete("Content-Type");
  }

  if (typeof document !== "undefined") {
    const lang = document.documentElement.lang;
    if (lang) {
      config.headers.set("x-lang", lang);
    }
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorResponse>) => {
    const status = error.response?.status;
    const messageKey = error.response?.data?.messageKey ?? "";

    // Clear session on invalid token, or when the account is blocked/pending
    // so a frozen user cannot keep using a stale UI session.
    if (
      status === 401 ||
      (status === 403 &&
        (messageKey === "auth.account_suspended" || messageKey === "auth.account_pending"))
    ) {
      setStoredAuthToken(null);
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("trustcoin_user");
      }
    }

    return Promise.reject(error);
  }
);

/**
 * Message shown when a request never reached the backend at all (server
 * down, wrong port, no network, etc.) — as opposed to a request that *did*
 * reach the server but was rejected (invalid credentials, validation, ...).
 * Mirrors `common.backendUnreachable` in the translation files; duplicated
 * here because this is a plain module function with no access to the
 * request-scoped i18n context that React components use.
 */
const BACKEND_UNREACHABLE_MESSAGE: Record<string, string> = {
  en: "Could not reach the server. Please check your connection and try again.",
  ar: "تعذر الوصول إلى الخادم. يرجى التحقق من اتصالك والمحاولة مرة أخرى.",
};

function getBackendUnreachableMessage(): string {
  const lang = typeof document !== "undefined" ? document.documentElement.lang : "en";
  return BACKEND_UNREACHABLE_MESSAGE[lang] ?? BACKEND_UNREACHABLE_MESSAGE.en;
}

/** Extracts a human-readable, already-translated message from an Axios error. */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ApiErrorResponse | undefined;
    if (data?.message) {
      return data.message;
    }

    // The request was sent but no response ever came back (server down,
    // network dropped, CORS block, timeout, ...) — a generic "unexpected
    // error" message here is misleading, since the app itself didn't fail.
    if (error.request) {
      return getBackendUnreachableMessage();
    }
  }
  return fallback;
}

/** Stable backend message key when present (e.g. `auth.account_not_verified`). */
export function getApiErrorKey(error: unknown): string | null {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ApiErrorResponse | undefined;
    return data?.messageKey ?? null;
  }
  return null;
}
