import { HDNodeWallet } from "ethers";
import { TronWeb } from "tronweb";
import { env } from "../config/env";

/** TronLink / standard Tron BIP-44 path (coin type 195). */
export const DEFAULT_TRON_FUNDER_DERIVATION_PATH = "m/44'/195'/0'/0/0";

function normalizeHexPrivateKey(raw: string): string {
  return raw.startsWith("0x") ? raw.slice(2) : raw;
}

function isHexPrivateKey(value: string): boolean {
  return /^[a-fA-F0-9]{64}$/.test(normalizeHexPrivateKey(value));
}

function looksLikeMnemonic(value: string): boolean {
  const words = value.trim().split(/\s+/).filter(Boolean);
  return words.length === 12 || words.length === 15 || words.length === 18 || words.length === 21 || words.length === 24;
}

function mnemonicFromEnv(): string {
  const dedicated = (process.env.TRON_BANDWIDTH_FUNDER_MNEMONIC ?? "").trim();
  if (dedicated) return dedicated;

  const inline = env.TRON_BANDWIDTH_FUNDER_PRIVATE_KEY.trim();
  if (inline && looksLikeMnemonic(inline)) return inline;

  return "";
}

function derivationPathFromEnv(): string {
  return (process.env.TRON_BANDWIDTH_FUNDER_DERIVATION_PATH ?? DEFAULT_TRON_FUNDER_DERIVATION_PATH).trim();
}

/**
 * Resolves bandwidth-funder credentials from either:
 * - `TRON_BANDWIDTH_FUNDER_MNEMONIC` (12/24 words), or
 * - mnemonic accidentally placed in `TRON_BANDWIDTH_FUNDER_PRIVATE_KEY`, or
 * - hex private key in `TRON_BANDWIDTH_FUNDER_PRIVATE_KEY`.
 */
export function resolveTronBandwidthFunder(): { privateKeyHex: string; address: string } | null {
  const mnemonic = mnemonicFromEnv();
  const hexCandidate = env.TRON_BANDWIDTH_FUNDER_PRIVATE_KEY.trim();

  let privateKeyHex: string;

  if (mnemonic) {
    const wallet = HDNodeWallet.fromPhrase(mnemonic, undefined, derivationPathFromEnv());
    privateKeyHex = normalizeHexPrivateKey(wallet.privateKey);
  } else if (hexCandidate && isHexPrivateKey(hexCandidate)) {
    privateKeyHex = normalizeHexPrivateKey(hexCandidate);
  } else if (!hexCandidate) {
    return null;
  } else {
    throw new Error(
      "TRON_BANDWIDTH_FUNDER must be a 64-char hex private key or a 12/24-word mnemonic " +
        `(set TRON_BANDWIDTH_FUNDER_MNEMONIC or fix TRON_BANDWIDTH_FUNDER_PRIVATE_KEY).`
    );
  }

  const tronWeb = new TronWeb({ fullHost: env.TRON_FULL_HOST, privateKey: privateKeyHex });
  const address = tronWeb.defaultAddress.base58 as string;
  if (!address) {
    throw new Error("Failed to derive Tron address from bandwidth funder credentials.");
  }

  return { privateKeyHex, address };
}
