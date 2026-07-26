import path from "path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Pin the workspace root explicitly: the backend's package-lock.json one
  // level up would otherwise make Next.js guess (and warn about) the root.
  turbopack: {
    root: path.join(__dirname),
  },
  // Hide the floating Next.js "N" dev indicator in the corner.
  devIndicators: false,
  // Allow the dev server to be reached from these origins (LAN IP + alternate
  // local ports) without Next.js logging a cross-origin request warning.
  allowedDevOrigins: ["192.168.1.216", "localhost:3001", "localhost:3000"],
};

export default withNextIntl(nextConfig);
