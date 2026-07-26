import { HDNodeWallet, JsonRpcProvider, Wallet, formatEther, parseEther } from "ethers";
import { env } from "../config/env";
import type { DepositNetwork } from "../validators/deposit.validator";

/** Same BIP-39 mnemonic as Tron bandwidth funder, but ETH coin-type path. */
const EVM_FUNDER_PATH = "m/44'/60'/0'/0/0";

function mnemonicFromEnv(): string {
  return (
    env.TRON_BANDWIDTH_FUNDER_MNEMONIC.trim() ||
    (env.TRON_BANDWIDTH_FUNDER_PRIVATE_KEY.trim().split(/\s+/).length >= 12
      ? env.TRON_BANDWIDTH_FUNDER_PRIVATE_KEY.trim()
      : "")
  );
}

/**
 * Resolves the EVM gas funder from the bandwidth funder mnemonic (ETH derivation).
 * Address differs from the Tron funder address — fund this wallet with BNB / ETH.
 */
export function resolveEvmGasFunder(): { privateKeyHex: string; address: string } | null {
  const mnemonic = mnemonicFromEnv();
  if (!mnemonic) return null;

  const wallet = HDNodeWallet.fromPhrase(mnemonic, undefined, EVM_FUNDER_PATH);
  return {
    privateKeyHex: wallet.privateKey,
    address: wallet.address,
  };
}

function getRpcUrl(network: Extract<DepositNetwork, "BEP20" | "ERC20">): string {
  return network === "BEP20" ? env.RPC_URL_BSC : env.RPC_URL_ETH;
}

function getTopupWei(network: Extract<DepositNetwork, "BEP20" | "ERC20">): bigint {
  const human = network === "BEP20" ? env.EVM_GAS_TOPUP_BNB : env.EVM_GAS_TOPUP_ETH;
  return parseEther(String(human));
}

/**
 * Ensures `toAddress` has enough native gas for a USDT transfer on BEP20/ERC20.
 * Tops up from the EVM gas funder when short.
 */
export async function ensureEvmNativeGas(
  network: Extract<DepositNetwork, "BEP20" | "ERC20">,
  toAddress: string,
  neededWei: bigint
): Promise<string | undefined> {
  const provider = new JsonRpcProvider(getRpcUrl(network));
  const balance = await provider.getBalance(toAddress);
  if (balance >= neededWei) return undefined;

  const funder = resolveEvmGasFunder();
  if (!funder) {
    throw new Error(
      `Insufficient native gas on ${toAddress} (${network}) and no EVM gas funder configured. ` +
        `Set TRON_BANDWIDTH_FUNDER_MNEMONIC and fund the derived ETH-path address with ${network === "BEP20" ? "BNB" : "ETH"}.`
    );
  }

  if (funder.address.toLowerCase() === toAddress.toLowerCase()) {
    throw new Error("EVM gas funder must not be the deposit sub-wallet.");
  }

  const topupWei = getTopupWei(network);
  const sendWei = neededWei > topupWei ? neededWei + parseEther("0.0002") : topupWei;
  const funderBal = await provider.getBalance(funder.address);
  if (funderBal < sendWei + parseEther("0.0001")) {
    throw new Error(
      `EVM gas funder ${funder.address} has ${formatEther(funderBal)} native ` +
        `(need ~${formatEther(sendWei)} for ${network}).`
    );
  }

  const wallet = new Wallet(funder.privateKeyHex, provider);
  // eslint-disable-next-line no-console
  console.info(
    `[evm] Gas top-up ${formatEther(sendWei)} → ${toAddress} (${network}) from ${funder.address}`
  );
  const tx = await wallet.sendTransaction({ to: toAddress, value: sendWei });
  const receipt = await tx.wait(1);
  if (!receipt || receipt.status !== 1) {
    throw new Error(`EVM gas top-up failed on ${network} (tx=${tx.hash}).`);
  }
  return tx.hash;
}
