# TrustCoin Backend

TrustCoin is a hybrid, multilingual (default **EN**, supported **AR**) crypto
investment platform backend built with **Express**, **TypeScript**, and
**Prisma ORM** (PostgreSQL or MySQL). Financial calculations rely on
`bignumber.js` to avoid floating-point rounding errors on money.

## Tech Stack

- **Express** — HTTP server & routing
- **TypeScript** — static typing
- **Prisma ORM** — database access (currently configured for MySQL; PostgreSQL also supported)
- **bignumber.js** — precise decimal arithmetic for all monetary operations
- **jsonwebtoken** / **bcryptjs** — authentication & password hashing
- **express-rate-limit** + **helmet** — abuse protection & security headers
- **zod** — request validation

## Project Structure

```
prisma/
  schema.prisma        # Database schema (models, enums, relations)
  seed.ts               # Seeds the Packages table
src/
  app.ts                # Express app assembly (middlewares + routes)
  server.ts             # Process entry point (listen, graceful shutdown, cron)
  config/               # env, prisma client singleton, constants
  controllers/          # Route handlers (thin — delegate to services)
  services/             # Business logic (auth, investments, transactions, admin, referrals)
  jobs/                  # Scheduled jobs (daily ROI distribution via node-cron)
  middlewares/           # auth, admin-only, rate limiting, i18n, IP guard, errors
  routes/                # Express routers, mounted under /api/v1
  validators/            # zod schemas for request bodies
  utils/                 # money (BigNumber), jwt, password, otp, i18n, apiError, referral...
  locales/               # en.json / ar.json message dictionaries
  types/                 # Express Request augmentation
```

## Getting Started

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment**

   Copy `.env.example` to `.env` and fill in your database connection string
   and secrets:

   ```bash
   cp .env.example .env
   ```

   `prisma/schema.prisma` is currently configured for **MySQL** (e.g. MAMP,
   whose default port is `8889`). All UUID primary/foreign key columns are
   pinned to `VARCHAR(36)`, and free-form/encrypted fields (`note`,
   `private_key`, `details`, `reason`) use `TEXT` to avoid truncation. Every
   table defaults to `utf8mb4` so Arabic content is stored correctly.

   To switch back to **PostgreSQL**, change `provider` in the `datasource`
   block to `"postgresql"` and point `DATABASE_URL` at your Postgres instance.

3. **Run database migrations**

   ```bash
   npm run prisma:migrate
   ```

4. **Seed the investment packages**

   ```bash
   npm run seed
   ```

   Seeds **56 packages** (14 amount tiers × 4 durations: 7 days, 1 / 3 / 6 months)
   and removes obsolete packages that are not referenced by investments.
   (This also runs automatically after `prisma migrate dev` since it's wired
   up via the `prisma.seed` field in `package.json`.)

5. **Start the dev server**

   ```bash
   npm run dev
   ```

   The API will be available at `http://localhost:4000/api/v1`.

## Available Scripts

| Script                    | Description                                   |
| -------------------------- | ---------------------------------------------- |
| `npm run dev`               | Start the API with hot-reload (ts-node + nodemon) |
| `npm run build`             | Compile TypeScript to `dist/`                  |
| `npm start`                 | Run the compiled build                         |
| `npm run typecheck`         | Type-check without emitting files              |
| `npm run prisma:generate`   | Regenerate the Prisma Client                   |
| `npm run prisma:migrate`    | Create & apply a new migration (dev)           |
| `npm run prisma:deploy`     | Apply pending migrations (production)          |
| `npm run prisma:studio`     | Open Prisma Studio                             |
| `npm run seed`              | Seed the `Packages` table                      |

## Core Domain Model

- **User** — balance (`Decimal(18,4)`), role (`USER`/`ADMIN`), verification & language preference, unique `referral_code`, and an optional `referred_by_id` self-relation.
- **OtpVerification** — 6-digit email verification codes with expiry.
- **Package** — investment plans (min limit, daily profit %, duration) plus a referral bonus schedule (`referral_bonus_1m/3m/6m`).
- **Investment** — a user's active/completed subscription to a package. Tracks `base_amount` (immutable original principal) and `current_amount` (working capital that daily ROI is computed on, and that grows when a referral bonus is approved).
- **Transaction** — deposits, withdrawals, profit distributions, package returns, and referral bonus additions (`REFERRAL_BONUS_ADDED`).
- **ReferralReward** — a referral bonus earned by a referrer when their referee invests, pending admin approval before it is added to the referrer's capital.
- **BannedIp** — brute-force protection for the admin panel.
- **AdminLog** — audit trail of administrative actions.

## Referral & Investment Bonus Engine

1. Every user gets a unique `referral_code` on registration. Signing up with
   `referralCode` in the request body links the new account to its referrer
   via `referred_by_id` (`POST /api/v1/auth/register`).
2. When a referred user buys a package (`POST /api/v1/investments`), the
   referrer earns a bonus sized by the package's duration bucket
   (`referral_bonus_1m` / `3m` / `6m`) and a `ReferralReward` row is created
   with `status = PENDING` — it does **not** affect any balance yet.
3. An admin reviews pending rewards (`GET /api/v1/admin/referrals/pending`)
   and approves or rejects them:
   - `POST /api/v1/admin/referrals/:id/approve` — atomically marks the
     reward `APPROVED`, adds the bonus to `current_amount` of the referrer's
     active investment, and records a `REFERRAL_BONUS_ADDED` transaction.
   - `POST /api/v1/admin/referrals/:id/reject` — marks it `REJECTED` without
     touching any capital.
4. The daily ROI cron job (`src/jobs/dailyRoi.job.ts`, scheduled via
   `DAILY_ROI_CRON_SCHEDULE`) computes profit on each investment's
   `current_amount`, so approved bonuses compound into future daily payouts
   and are included in the principal returned at maturity.
5. Users can check their own referral performance via
   `GET /api/v1/referrals/stats` (referral code, shareable link, referee
   count, and total bonus approved into their capital).

## Security Notes

- Passwords are hashed with `bcryptjs` (configurable salt rounds).
- All money math goes through `src/utils/money.ts`, which wraps `bignumber.js`
  and always rounds down to 4 decimal places to match the `Decimal(18,4)`
  columns — never use native JS floating point for financial values.
- The admin panel is protected by a dedicated rate limiter, a per-IP failed
  attempt counter, and a persistent `BannedIp` table checked on every request.
- `Transaction.private_key` is intended to store **encrypted** values only —
  never persist plaintext private keys.
- Helmet is enabled for baseline HTTP security headers, and CORS origin is
  configurable via `CORS_ORIGIN`.

## Internationalization

Response messages are resolved via `src/utils/i18n.ts` against
`src/locales/en.json` (default) and `src/locales/ar.json`. The active
language is resolved per-request from (in order): `?lang=` query param,
`x-lang` header, the authenticated user's saved `language` preference, then
falls back to `DEFAULT_LANGUAGE`.
# trustcoin-backend
# trustcoin-backend
