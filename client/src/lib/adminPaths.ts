/**
 * Obfuscated frontend path for the admin panel.
 * Backend API remains at `/api/v1/admin/*` — only the UI routes change.
 */
export const ADMIN_PANEL_BASE = "/secret-admin-portal";

export const ADMIN_ROUTES = {
  home: ADMIN_PANEL_BASE,
  login: `${ADMIN_PANEL_BASE}/login`,
  withdrawals: `${ADMIN_PANEL_BASE}/withdrawals`,
  users: `${ADMIN_PANEL_BASE}/users`,
  referrals: `${ADMIN_PANEL_BASE}/referrals`,
  packages: `${ADMIN_PANEL_BASE}/packages`,
  deposits: `${ADMIN_PANEL_BASE}/deposits`,
} as const;
