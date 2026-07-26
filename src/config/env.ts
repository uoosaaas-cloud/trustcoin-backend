import dotenv from "dotenv";

dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: Number(process.env.PORT ?? 4000),

  DATABASE_URL: required("DATABASE_URL"),

  JWT_SECRET: required("JWT_SECRET"),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? "7d",

  BCRYPT_SALT_ROUNDS: Number(process.env.BCRYPT_SALT_ROUNDS ?? 12),

  DEFAULT_LANGUAGE: process.env.DEFAULT_LANGUAGE ?? "en",
  SUPPORTED_LANGUAGES: (process.env.SUPPORTED_LANGUAGES ?? "en,ar").split(","),

  /**
   * Browser CORS allow-list. In production set to the exact frontend origin
   * (e.g. https://app.example.com). Default "*" is for local development only.
   */
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? "*",

  /** When true (or "1"), Express trusts X-Forwarded-* from a reverse proxy. */
  TRUST_PROXY: (process.env.TRUST_PROXY ?? "false") === "true" || process.env.TRUST_PROXY === "1",

  // Public-facing frontend base URL, used to build shareable referral links.
  // FRONTEND_URL is accepted as an alias of APP_BASE_URL.
  APP_BASE_URL: process.env.FRONTEND_URL ?? process.env.APP_BASE_URL ?? "http://localhost:3000",

  RATE_LIMIT_WINDOW_MS: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 15 * 60 * 1000),
  // Dev/testing default is generous; production stays stricter unless overridden.
  RATE_LIMIT_MAX: Number(
    process.env.RATE_LIMIT_MAX ??
      ((process.env.NODE_ENV ?? "development") === "production" ? 200 : 1000)
  ),

  OTP_EXPIRY_MINUTES: Number(process.env.OTP_EXPIRY_MINUTES ?? 10),
  OTP_RESEND_COOLDOWN_SECONDS: Number(process.env.OTP_RESEND_COOLDOWN_SECONDS ?? 60),

  /** How long a password-reset email link remains valid. */
  PASSWORD_RESET_EXPIRY_MINUTES: Number(process.env.PASSWORD_RESET_EXPIRY_MINUTES ?? 30),

  ADMIN_MAX_FAILED_ATTEMPTS: Number(process.env.ADMIN_MAX_FAILED_ATTEMPTS ?? 5),

  // Cron expression controlling when the daily ROI distribution job runs (default: every day at 00:00 server time).
  DAILY_ROI_CRON_SCHEDULE: process.env.DAILY_ROI_CRON_SCHEDULE ?? "0 0 * * *",

  // --- Email (Resend primary; SMTP kept as legacy fallback for mailer.ts) ---
  RESEND_API_KEY: process.env.RESEND_API_KEY ?? "",
  EMAIL_FROM: process.env.EMAIL_FROM ?? "TrustCoin <onboarding@resend.dev>",
  /** Inbox for new-withdrawal admin alerts (falls back to ADMIN_EMAIL). */
  ADMIN_ALERT_EMAIL: (process.env.ADMIN_ALERT_EMAIL ?? process.env.ADMIN_EMAIL ?? "").trim(),

  // Legacy Nodemailer / Mailtrap (unused when RESEND_API_KEY is set).
  SMTP_HOST: process.env.SMTP_HOST ?? "sandbox.smtp.mailtrap.io",
  SMTP_PORT: Number(process.env.SMTP_PORT ?? 2525),
  SMTP_SECURE: (process.env.SMTP_SECURE ?? "false") === "true",
  SMTP_USER: process.env.SMTP_USER ?? "",
  SMTP_PASSWORD: process.env.SMTP_PASS ?? process.env.SMTP_PASSWORD ?? "",
  MAIL_FROM_NAME: process.env.MAIL_FROM_NAME ?? "TrustCoin",
  MAIL_FROM_ADDRESS: process.env.MAIL_FROM_ADDRESS ?? "onboarding@resend.dev",

  // --- Deposits ---
  // Admin master wallet addresses — the final destination once a user's
  // unique deposit address (see DEPOSIT_HD_MNEMONIC below) is swept. No
  // longer shown directly to users; each user gets their own unique address
  // per network instead (src/services/depositAddress.service.ts).
  DEPOSIT_WALLET_TRC20: (process.env.DEPOSIT_WALLET_TRC20 ?? "TQn9Y2khEsLMG21TvYzQnE5dnUUvzz5PZg").trim(),
  DEPOSIT_WALLET_BEP20: (process.env.DEPOSIT_WALLET_BEP20 ?? "0x0000000000000000000000000000000000000000").trim(),
  DEPOSIT_WALLET_ERC20: (process.env.DEPOSIT_WALLET_ERC20 ?? "0x0000000000000000000000000000000000000000").trim(),
  // Maximum accepted upload size (MB) for the optional deposit proof image.
  DEPOSIT_PROOF_MAX_FILE_SIZE_MB: Number(process.env.DEPOSIT_PROOF_MAX_FILE_SIZE_MB ?? 5),

  // BIP-39 mnemonic seeding the HD wallet every per-user, per-network deposit
  // address is deterministically derived from (see src/utils/depositWallet.ts).
  // The default below is the well-known, publicly-shared Hardhat/Ganache test
  // mnemonic — perfectly fine for local dev (never holds real funds) but MUST
  // be overridden with a freshly generated, secret mnemonic in any
  // environment that will actually receive on-chain deposits.
  DEPOSIT_HD_MNEMONIC:
    process.env.DEPOSIT_HD_MNEMONIC ?? "test test test test test test test test test test test junk",
  // 32-byte (64 hex chars) key used to AES-256-GCM-encrypt derived deposit
  // address private keys at rest. MUST be overridden in any real deployment.
  DEPOSIT_ADDRESS_ENCRYPTION_KEY:
    process.env.DEPOSIT_ADDRESS_ENCRYPTION_KEY ??
    "d1e63412b3b7d0fea3751ece358aff62ee2ec64a3b058b1180c957f0eac715f6",

  // --- Deposit sweep worker ---
  // When false, the cron job is not scheduled (manual admin/CLI trigger still works).
  // Default on — deposits auto-credit; sweep aggregates USDT to master without admin.
  DEPOSIT_SWEEP_ENABLED: (process.env.DEPOSIT_SWEEP_ENABLED ?? "true") === "true",
  // Default: every 5 minutes.
  /** Default every 30 seconds so on-chain deposits are detected quickly. */
  DEPOSIT_SWEEP_CRON_SCHEDULE: process.env.DEPOSIT_SWEEP_CRON_SCHEDULE ?? "*/30 * * * * *",
  // Minimum USDT balance (human units) required before a sweep is attempted.
  DEPOSIT_SWEEP_MIN_USDT: Number(process.env.DEPOSIT_SWEEP_MIN_USDT ?? 1),
  // Max consecutive failed attempts recorded against one address before we
  // back off harder (still retried on later runs, but logged loudly).
  DEPOSIT_SWEEP_MAX_RETRIES: Number(process.env.DEPOSIT_SWEEP_MAX_RETRIES ?? 5),
  // Soft lock duration (seconds) while a sweep is in flight.
  DEPOSIT_SWEEP_LOCK_SECONDS: Number(process.env.DEPOSIT_SWEEP_LOCK_SECONDS ?? 120),
  // Pause between per-address on-chain checks to stay under TronGrid / RPC rate limits.
  DEPOSIT_SWEEP_THROTTLE_MS: Number(process.env.DEPOSIT_SWEEP_THROTTLE_MS ?? 750),

  // JSON-RPC endpoints for on-chain balance checks / transfers.
  RPC_URL_BSC: process.env.RPC_URL_BSC ?? "https://bsc-dataseed.binance.org",
  RPC_URL_ETH: process.env.RPC_URL_ETH ?? "https://eth.llamarpc.com",
  // Primary Tron full-node HTTP API. PublicNode is used by default to avoid
  // TronGrid's aggressive anonymous rate limits (429).
  TRON_FULL_HOST: (process.env.TRON_FULL_HOST ?? "https://tron-rpc.publicnode.com").trim(),
  // Used automatically when the primary host returns 429 / network errors.
  TRON_FALLBACK_HOST: (process.env.TRON_FALLBACK_HOST ?? "https://api.trongrid.io").trim(),
  // TronGrid Pro API key — accepted under several common env names.
  // Sent as `TRON-PRO-API-KEY` when talking to TronGrid hosts.
  TRON_API_KEY: (
    process.env.TRON_GRID_API_KEY ??
    process.env.TRONGRID_API_KEY ??
    process.env.TRON_API_KEY ??
    ""
  ).trim(),

  // --- Tron Energy Rental (Feee.io-compatible) — covers ENERGY only ---
  TRON_ENERGY_API_KEY: (process.env.TRON_ENERGY_API_KEY ?? "").trim(),
  TRON_ENERGY_PROVIDER_URL: (process.env.TRON_ENERGY_PROVIDER_URL ?? "https://feee.io/open").trim(),
  TRON_ENERGY_TIMEOUT_MS: Number(process.env.TRON_ENERGY_TIMEOUT_MS ?? 15_000),
  TRON_ENERGY_CONFIRM_ATTEMPTS: Number(process.env.TRON_ENERGY_CONFIRM_ATTEMPTS ?? 12),
  TRON_ENERGY_CONFIRM_DELAY_MS: Number(process.env.TRON_ENERGY_CONFIRM_DELAY_MS ?? 1_500),
  // When true (default if API key is set), sweeps MUST rent energy via Feee —
  // no silent TRX-burn fallback for ENERGY. Bandwidth still uses TRX top-up below.
  TRON_ENERGY_REQUIRE:
    (process.env.TRON_ENERGY_REQUIRE ??
      (process.env.TRON_ENERGY_API_KEY ? "true" : "false")) === "true",
  // When Feee balance is too low, top up sub-wallet TRX from funder and burn for Energy (one-shot).
  TRON_ENERGY_TRX_BURN_FALLBACK: (process.env.TRON_ENERGY_TRX_BURN_FALLBACK ?? "true") === "true",
  TRON_ENERGY_TRX_BURN_TOPUP: Number(process.env.TRON_ENERGY_TRX_BURN_TOPUP ?? 14),
  TRON_ENERGY_TRX_BURN_FEE_LIMIT_TRX: Number(process.env.TRON_ENERGY_TRX_BURN_FEE_LIMIT_TRX ?? 15),

  // --- Tron Bandwidth funder (burn TRX for Net — never rent Bandwidth from Feee) ---
  // Accepts hex private key OR 12/24-word mnemonic (TronLink default path m/44'/195'/0'/0/0).
  TRON_BANDWIDTH_FUNDER_PRIVATE_KEY: (process.env.TRON_BANDWIDTH_FUNDER_PRIVATE_KEY ?? "").trim(),
  TRON_BANDWIDTH_FUNDER_MNEMONIC: (process.env.TRON_BANDWIDTH_FUNDER_MNEMONIC ?? "").trim(),
  TRON_BANDWIDTH_FUNDER_DERIVATION_PATH: (
    process.env.TRON_BANDWIDTH_FUNDER_DERIVATION_PATH ?? "m/44'/195'/0'/0/0"
  ).trim(),
  // TRX sent when Bandwidth is low and local TRX is below the min (keep small).
  TRON_BANDWIDTH_TRX_TOPUP: Number(process.env.TRON_BANDWIDTH_TRX_TOPUP ?? 0.4),
  // If the sub-wallet already holds at least this much TRX, skip top-up.
  TRON_BANDWIDTH_MIN_TRX: Number(process.env.TRON_BANDWIDTH_MIN_TRX ?? 0.35),
  // After a successful USDT sweep, reclaim leftover TRX above this threshold back to the funder.
  TRON_BANDWIDTH_RECLAIM_MIN_TRX: Number(process.env.TRON_BANDWIDTH_RECLAIM_MIN_TRX ?? 0.2),

  // EVM native gas top-up for BEP20/ERC20 sweeps (same mnemonic as Tron funder, ETH path).
  EVM_GAS_TOPUP_BNB: Number(process.env.EVM_GAS_TOPUP_BNB ?? 0.0015),
  EVM_GAS_TOPUP_ETH: Number(process.env.EVM_GAS_TOPUP_ETH ?? 0.0008),

  // Overrideable USDT contract addresses (mainnet defaults).
  USDT_CONTRACT_TRC20: process.env.USDT_CONTRACT_TRC20 ?? "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
  USDT_CONTRACT_BEP20: process.env.USDT_CONTRACT_BEP20 ?? "0x55d398326f99059fF775485246999027B3197955",
  USDT_CONTRACT_ERC20: process.env.USDT_CONTRACT_ERC20 ?? "0xdAC17F958D2ee523a2206206994597C13D831ec7",
} as const;

export const isProduction = env.NODE_ENV === "production";
