import type { DepositNetwork } from "../../validators/deposit.validator";

/** Minimal ERC-20 / BEP-20 ABI fragments used by the sweep worker. */
export const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function transfer(address to, uint256 amount) returns (bool)",
] as const;

export interface UsdtNetworkConfig {
  network: DepositNetwork;
  /** On-chain USDT contract address. */
  contractAddress: string;
  /** Human-readable token decimals (USDT is 6 on ETH/Tron, 18 on BSC peg). */
  decimals: number;
  /** Native gas asset symbol (for logs / error messages only). */
  nativeSymbol: "TRX" | "BNB" | "ETH";
}

/**
 * Redacts hex private keys, AES ciphertext blobs, and mnemonic-looking
 * sequences from any string that might end up in logs / DB error_message
 * columns. Always prefer calling this before logging an Error.message from
 * crypto libraries.
 */
export function redactSecrets(input: string): string {
  return input
    .replace(/0x[a-fA-F0-9]{64}/g, "0x[REDACTED_PRIVATE_KEY]")
    // Keep labeled txids / hashes; redact bare 64-hex that looks like a private key.
    .replace(/\b[a-fA-F0-9]{64}\b/g, (match, offset, full) => {
      const before = String(full).slice(Math.max(0, offset - 12), offset).toLowerCase();
      if (before.includes("txid") || before.includes("hash") || /tx\s*[=:]?\s*$/.test(before)) {
        return match;
      }
      return "[REDACTED_HEX_SECRET]";
    })
    // AES-GCM blobs stored as iv:authTag:ciphertext (all base64).
    .replace(
      /\b[A-Za-z0-9+/=]{10,}:{1}[A-Za-z0-9+/=]{10,}:{1}[A-Za-z0-9+/=]{20,}\b/g,
      "[REDACTED_ENCRYPTED_SECRET]"
    )
    .replace(/\b([a-z]+ ){11}[a-z]+\b/gi, "[REDACTED_MNEMONIC]")
    .replace(/\b(DEPOSIT_HD_MNEMONIC|DEPOSIT_ADDRESS_ENCRYPTION_KEY|TRON_ENERGY_API_KEY|TRON_BANDWIDTH_FUNDER_PRIVATE_KEY|JWT_SECRET)\b/g, "[REDACTED_ENV_NAME]");
}

export function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return redactSecrets(error.message || error.name);
  }
  return redactSecrets(String(error));
}
