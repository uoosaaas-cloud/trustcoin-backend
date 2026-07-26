import { isAddress as isEthersAddress } from "ethers";
import { base58CheckDecode } from "./base58";
import type { DepositNetwork } from "../validators/deposit.validator";

/**
 * Strict TRON (TRC20) address check:
 * - must start with `T`
 * - must be valid Base58Check
 * - decoded payload must be 21 bytes with version prefix `0x41`
 */
export function isValidTronAddress(address: string): boolean {
  if (!address || typeof address !== "string") {
    return false;
  }

  const trimmed = address.trim();
  if (!trimmed.startsWith("T") || trimmed.length < 30 || trimmed.length > 36) {
    return false;
  }

  try {
    const payload = base58CheckDecode(trimmed);
    return payload.length === 21 && payload[0] === 0x41;
  } catch {
    return false;
  }
}

/** Strict EVM (BEP20 / ERC20) address check via ethers checksum rules. */
export function isValidEvmAddress(address: string): boolean {
  if (!address || typeof address !== "string") {
    return false;
  }
  const trimmed = address.trim();
  if (/^0x0{40}$/i.test(trimmed)) {
    return false;
  }
  return isEthersAddress(trimmed);
}

export function assertValidMasterWallet(network: DepositNetwork, address: string): string {
  const trimmed = address.trim();

  if (network === "TRC20") {
    if (!isValidTronAddress(trimmed)) {
      throw new Error(
        `Invalid DEPOSIT_WALLET_TRC20 "${trimmed}": expected a Base58Check Tron address starting with 'T'.`
      );
    }
    return trimmed;
  }

  if (!isValidEvmAddress(trimmed)) {
    throw new Error(
      `Invalid DEPOSIT_WALLET_${network} "${trimmed}": expected a non-zero 0x-prefixed EVM address.`
    );
  }

  return trimmed;
}
