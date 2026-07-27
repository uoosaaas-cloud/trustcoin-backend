import { notFound } from "next/navigation";

/** Pre-render legacy `/admin` paths for static export (all resolve to 404). */
export function generateStaticParams() {
  return [{ slug: [] as string[] }, { slug: ["login"] }, { slug: ["dashboard"] }];
}

/**
 * Old `/admin` paths are intentionally dead so the panel is only reachable
 * via the obfuscated secret route.
 */
export default function LegacyAdminBlockedPage() {
  notFound();
}
