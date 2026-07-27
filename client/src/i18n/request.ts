import { getRequestConfig } from "next-intl/server";
import { defaultLocale } from "./config";

/** Static export: locale is resolved on the client from the NEXT_LOCALE cookie. */
export default getRequestConfig(async () => ({
  locale: defaultLocale,
  timeZone: "UTC",
  now: new Date(0),
  messages: (await import(`../../messages/${defaultLocale}.json`)).default,
}));
