import en from "../locales/en.json";
import ar from "../locales/ar.json";
import { env } from "../config/env";

type Dictionary = typeof en;

const dictionaries: Record<string, Dictionary> = { en, ar };

export function isSupportedLanguage(lang: string): boolean {
  return env.SUPPORTED_LANGUAGES.includes(lang);
}

/**
 * Resolves a dot-notated message key (e.g. "auth.login_success") for the
 * given language. Optional `params` are interpolated into the resolved
 * string by replacing `{{paramName}}` placeholders, e.g.
 * `translate("auth.otp_resend_cooldown", "en", { seconds: 42 })`.
 */
export function translate(
  messageKey: string,
  lang: string = env.DEFAULT_LANGUAGE,
  params?: Record<string, string | number>
): string {
  const dictionary = dictionaries[lang] ?? dictionaries[env.DEFAULT_LANGUAGE];
  const value = messageKey
    .split(".")
    .reduce<unknown>((acc, key) => (typeof acc === "object" && acc !== null ? (acc as Record<string, unknown>)[key] : undefined), dictionary);

  if (typeof value !== "string") {
    return messageKey;
  }

  if (!params) {
    return value;
  }

  return Object.entries(params).reduce(
    (result, [key, paramValue]) => result.replace(new RegExp(`{{${key}}}`, "g"), String(paramValue)),
    value
  );
}
