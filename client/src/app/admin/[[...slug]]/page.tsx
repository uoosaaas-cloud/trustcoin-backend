import { notFound } from "next/navigation";

/**
 * Old `/admin` paths are intentionally dead so the panel is only reachable
 * via the obfuscated secret route.
 */
export default function LegacyAdminBlockedPage() {
  notFound();
}
