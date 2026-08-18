import crypto from "crypto";
import { prisma } from "../config/prisma";
import { sitePageUrl } from "../config/siteUrl";

// Excludes visually-ambiguous characters (0/O, 1/I/L) for easy sharing.
const REFERRAL_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const REFERRAL_SUFFIX_LENGTH = 6;
const REFERRAL_CODE_PREFIX = "TC-";
const MAX_GENERATION_ATTEMPTS = 12;

function randomReferralSuffix(): string {
  let suffix = "";
  for (let i = 0; i < REFERRAL_SUFFIX_LENGTH; i++) {
    const index = crypto.randomInt(0, REFERRAL_CODE_ALPHABET.length);
    suffix += REFERRAL_CODE_ALPHABET[index];
  }
  return suffix;
}

/** Builds a candidate like `TC-A7K9QM`. */
export function buildReferralCodeCandidate(): string {
  return `${REFERRAL_CODE_PREFIX}${randomReferralSuffix()}`;
}

/**
 * Normalizes a user-supplied referral / `ref` value for DB lookup.
 * Accepts both legacy bare codes and `TC-…` prefixed codes.
 */
export function normalizeReferralCodeInput(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

/**
 * Generates a unique referral code (`TC-` + 6 alphanumeric chars) using
 * cryptographically secure randomness. Collisions are retried defensively.
 */
export async function generateUniqueReferralCode(): Promise<string> {
  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
    const candidate = buildReferralCodeCandidate();
    const existing = await prisma.user.findUnique({ where: { referral_code: candidate } });

    if (!existing) {
      return candidate;
    }
  }

  throw new Error("Failed to generate a unique referral code after multiple attempts.");
}

/**
 * Resolves a referrer by referral code. Tries the normalized value as-is,
 * then with / without the `TC-` prefix for legacy compatibility.
 */
export async function findUserByReferralCode(rawCode: string) {
  const normalized = normalizeReferralCodeInput(rawCode);
  if (!normalized) {
    return null;
  }

  const candidates = new Set<string>([normalized]);
  if (normalized.startsWith(REFERRAL_CODE_PREFIX)) {
    candidates.add(normalized.slice(REFERRAL_CODE_PREFIX.length));
  } else {
    candidates.add(`${REFERRAL_CODE_PREFIX}${normalized}`);
  }

  for (const code of candidates) {
    const user = await prisma.user.findUnique({ where: { referral_code: code } });
    if (user) {
      return user;
    }
  }

  return null;
}

/** Builds the shareable referral signup link for a given referral code. */
export function buildReferralLink(referralCode: string): string {
  return sitePageUrl("/register", { ref: referralCode });
}

/** Masks an email for referral list privacy: `jo***@example.com`. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) {
    return "***";
  }
  if (local.length <= 2) {
    return `${local[0] ?? "*"}***@${domain}`;
  }
  return `${local.slice(0, 2)}***@${domain}`;
}
