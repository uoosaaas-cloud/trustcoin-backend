"use client";

import { NextIntlClientProvider } from "next-intl";
import { useEffect, useState } from "react";
import arMessages from "../../messages/ar.json";
import enMessages from "../../messages/en.json";
import { defaultLocale, isRtl, isValidLocale, LOCALE_COOKIE_NAME, type Locale } from "@/i18n/config";

function readLocaleCookie(): Locale {
  if (typeof document === "undefined") {
    return defaultLocale;
  }

  const match = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE_NAME}=([^;]*)`));
  const value = match?.[1] ? decodeURIComponent(match[1]) : undefined;
  return isValidLocale(value) ? value : defaultLocale;
}

/** Applies cookie-based locale + RTL after hydration (required for `output: "export"`). */
export function ClientIntlProvider({
  children,
  initialLocale,
}: {
  children: React.ReactNode;
  initialLocale: Locale;
}) {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const messages = locale === "ar" ? arMessages : enMessages;

  useEffect(() => {
    const cookieLocale = readLocaleCookie();
    setLocale(cookieLocale);
    document.documentElement.lang = cookieLocale;
    document.documentElement.dir = isRtl(cookieLocale) ? "rtl" : "ltr";
  }, []);

  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      timeZone="UTC"
      now={new Date(0)}
    >
      {children}
    </NextIntlClientProvider>
  );
}
