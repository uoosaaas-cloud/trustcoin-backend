# TrustCoin Frontend

The TrustCoin frontend is a **Next.js (App Router)** + **TypeScript** +
**Tailwind CSS** application with full bilingual support (English/Arabic,
LTR/RTL) that talks to the TrustCoin backend API.

## Tech Stack

- **Next.js 16 (App Router)** with Turbopack
- **TypeScript**
- **Tailwind CSS v4** (CSS-first theme, dark "crypto" design system)
- **next-intl** — i18n without URL-based routing (locale persisted via the
  `NEXT_LOCALE` cookie), with automatic `dir="rtl"`/`dir="ltr"` switching
- **Axios** — typed API client with JWT + language interceptors

## Project Structure

```
client/
  messages/
    en.json              # English UI strings
    ar.json               # Arabic UI strings
  src/
    app/
      layout.tsx          # Root layout: fonts, locale, dir, NextIntlClientProvider
      page.tsx              # Redirects "/" -> "/register"
      register/page.tsx      # Register + OTP verification flow (dark crypto UI)
      globals.css            # Tailwind v4 theme tokens + dark crypto background utilities
    components/
      LanguageSwitcher.tsx    # EN/AR toggle (persists NEXT_LOCALE cookie)
      OtpInput.tsx             # 6-digit OTP input (auto-advance, paste support)
    i18n/
      config.ts                # Locale list, default locale, RTL helper
      request.ts                 # next-intl request config (cookie -> locale -> messages)
    lib/
      api.ts                     # Axios instance (JWT + x-lang interceptors)
      auth.ts                      # Typed calls to /auth/register, /verify-otp, /resend-otp
```

## Getting Started

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure the API base URL**

   ```bash
   cp .env.example .env.local
   ```

   By default this points at `http://localhost:4000/api/v1`, matching the
   TrustCoin backend's default port.

3. **Run the backend** (in the project root, not here) so the frontend has
   something to talk to:

   ```bash
   cd .. && npm run dev
   ```

4. **Run the frontend dev server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) — it redirects to
   `/register`.

## Internationalization (i18n)

- Translations live in `messages/en.json` and `messages/ar.json`, read via
  `useTranslations()` (client) / `getTranslations()` (server).
- The active locale is resolved in `src/i18n/request.ts`: the `NEXT_LOCALE`
  cookie takes priority, falling back to the browser's `Accept-Language`
  header, then to English.
- `LanguageSwitcher` writes the cookie and calls `router.refresh()`, which
  re-runs the (server) root layout with the new locale — updating
  `<html lang>` / `<html dir>` and every translated string, with **no** page
  reload or URL change.
- Numeric content that must always read left-to-right (like the OTP code)
  is wrapped in `dir="ltr"` regardless of the active UI language.

## Axios API Client (`src/lib/api.ts`)

- `baseURL` is `NEXT_PUBLIC_API_BASE_URL` (defaults to
  `http://localhost:4000/api/v1`).
- A request interceptor attaches `Authorization: Bearer <token>` from
  `localStorage` once the user is logged in, and forwards the active UI
  language via the `x-lang` header — so backend responses and OTP emails
  come back in the same language as the UI.
- A response interceptor clears the stored token on `401 Unauthorized`.
- `getApiErrorMessage(error, fallback)` extracts the backend's already
  localized `message` field from a failed request.

## Register & OTP Page (`src/app/register/page.tsx`)

A two-step, dark "crypto" themed flow:

1. **Create account** — email, password (with live strength/match
   validation matching the backend's rules), confirm password, and an
   optional referral code. Calls `POST /auth/register`.
2. **Verify email** — a 6-digit OTP input (auto-advance, paste support,
   always LTR), with resend (60s cooldown, mirroring the backend's rate
   limit) and "use a different email" actions. Calls `POST /auth/verify-otp`
   and `POST /auth/resend-otp`.

In non-production backend environments, the OTP code returned by the API is
auto-filled into the input with a visible "development mode" notice, so the
whole flow can be tested end-to-end without a real mailbox.
