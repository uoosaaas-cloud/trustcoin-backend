import { env } from "./env";

/**
 * Frontend is a static export with `trailingSlash: true`, so public page URLs
 * must be `/path/?query` — `/path?query` 404s on the live host.
 */
export function sitePageUrl(pathname: string, query?: Record<string, string>): string {
  const base = env.APP_BASE_URL.replace(/\/+$/, "");
  const clean = (pathname.startsWith("/") ? pathname : `/${pathname}`).replace(/\/+$/, "");
  const search =
    query && Object.keys(query).length > 0 ? `?${new URLSearchParams(query).toString()}` : "";
  return `${base}${clean}/${search}`;
}
