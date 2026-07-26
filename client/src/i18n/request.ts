import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { defaultLocale, isValidLocale, LOCALE_COOKIE_NAME, type Locale } from "./config";

/**
 * Resolves the active locale for the current request without URL-based
 * routing: prefer the `NEXT_LOCALE` cookie (set by the language switcher),
 * then the browser's `Accept-Language` header, then fall back to English.
 */
async function resolveLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE_NAME)?.value;

  if (isValidLocale(cookieLocale)) {
    return cookieLocale;
  }

  const headerStore = await headers();
  const acceptLanguage = headerStore.get("accept-language") ?? "";

  if (acceptLanguage.toLowerCase().startsWith("ar")) {
    return "ar";
  }

  return defaultLocale;
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale();

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
