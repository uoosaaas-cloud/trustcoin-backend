/**
 * Obfuscated frontend path for the admin panel.
 * Backend API remains at `/api/v1/admin/*` — only the UI routes change.
 *
 * Trailing slashes match `trailingSlash: true` in next.config (static export
 * serves `…/login/index.html`). Links without `/` used to fall through a
 * Render SPA rewrite to the home page.
 */
export const ADMIN_PANEL_BASE = "/secret-admin-portal/";

export const ADMIN_ROUTES = {
  home: ADMIN_PANEL_BASE,
  login: `${ADMIN_PANEL_BASE}login/`,
  withdrawals: `${ADMIN_PANEL_BASE}withdrawals/`,
  users: `${ADMIN_PANEL_BASE}users/`,
  referrals: `${ADMIN_PANEL_BASE}referrals/`,
  packages: `${ADMIN_PANEL_BASE}packages/`,
  deposits: `${ADMIN_PANEL_BASE}deposits/`,
  trades: `${ADMIN_PANEL_BASE}trades/`,
} as const;
