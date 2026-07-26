import { createHash } from "crypto";
import { HDNodeWallet } from "ethers";
import { env } from "../config/env";
import { base58CheckEncode } from "./base58";
import type { DepositNetwork } from "../validators/deposit.validator";

/**
 * Every user gets one deterministically-derived, unique receiving address
 * per network (the "auto-forwarding gateway" layer): funds sent here are
 * unambiguously attributable to the user, and — in a future sweep worker —
 * can be forwarded on-chain to the admin master wallet
 * (`DEPOSIT_WALLET_*` in `src/config/env.ts`) using the address's own
 * private key.
 *
 * TRC20 (Tron) and BEP20/ERC20 (EVM chains) both use secp256k1 keys and the
 * same keccak256-based address derivation; they differ only in how the
 * resulting 20-byte hash is *encoded* (hex+checksum for EVM, Base58Check
 * with a 0x41 prefix for Tron). Because of that, we can derive a single
 * BIP-44 keypair per (user, network) and just encode it differently for
 * Tron — no extra crypto primitives needed beyond what `ethers` provides.
 */

const BIP44_ETH_COIN_TYPE_PATH = "m/44'/60'/0'/0";
/** Non-hardened BIP-44 indexes must be below 2^31. */
const MAX_DERIVATION_INDEX = 0x80000000;

export interface DerivedDepositWallet {
  address: string;
  privateKeyHex: string;
  derivationIndex: number;
}

/**
 * Deterministically maps (userId, network) to a BIP-44 derivation index.
 * Using a hash (rather than a DB auto-increment counter) means the exact
 * same address can always be re-derived from the mnemonic alone — there's
 * no sequential state to lose or race on.
 */
export function computeDerivationIndex(userId: string, network: DepositNetwork): number {
  const hash = createHash("sha256").update(`${userId}:${network}`).digest();
  return hash.readUInt32BE(0) % MAX_DERIVATION_INDEX;
}

function deriveEvmWallet(index: number): HDNodeWallet {
  return HDNodeWallet.fromPhrase(env.DEPOSIT_HD_MNEMONIC, undefined, `${BIP44_ETH_COIN_TYPE_PATH}/${index}`);
}

/** Converts a standard 20-byte EVM address (0x...) into its Tron Base58Check form. */
function toTronAddress(evmAddress: string): string {
  const addressBytes = Buffer.from(evmAddress.slice(2), "hex");
  const tronPayload = Buffer.concat([Buffer.from([0x41]), addressBytes]);
  return base58CheckEncode(tronPayload);
}

/** Derives the unique deposit wallet for a given network + derivation index. */
export function deriveDepositWallet(network: DepositNetwork, derivationIndex: number): DerivedDepositWallet {
  const wallet = deriveEvmWallet(derivationIndex);

  return {
    address: network === "TRC20" ? toTronAddress(wallet.address) : wallet.address,
    privateKeyHex: wallet.privateKey,
    derivationIndex,
  };
}
