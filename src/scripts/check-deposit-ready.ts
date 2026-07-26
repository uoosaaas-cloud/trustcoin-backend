/**
 * Full deposit-system readiness (TRC20 + BEP20 + ERC20).
 *
 *   npm run deposit:ready
 */
import dotenv from "dotenv";

dotenv.config();

import { JsonRpcProvider, formatEther } from "ethers";
import { TronWeb } from "tronweb";
import { env } from "../config/env";
import { FEEE_USER_AGENT, probeFeeeApiKey } from "../services/tronEnergy.service";
import { resolveEvmGasFunder } from "../utils/evmGasFunder";
import { resolveTronBandwidthFunder } from "../utils/tronFunderKey";
import { isValidEvmAddress, isValidTronAddress } from "../utils/walletAddress";

async function main() {
  const egressIp = await fetch("https://api.ipify.org").then((r) => r.text()).catch(() => "unknown");
  const probe = await probeFeeeApiKey();

  const tronFunder = (() => {
    try {
      return resolveTronBandwidthFunder();
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) } as const;
    }
  })();

  let tronFunderTrx: number | undefined;
  if (tronFunder && "address" in tronFunder && tronFunder.address) {
    const tw = new TronWeb({ fullHost: env.TRON_FULL_HOST });
    tronFunderTrx = Number(await tw.trx.getBalance(tronFunder.address)) / 1_000_000;
  }

  const evmFunder = resolveEvmGasFunder();
  let bnbBalance: string | undefined;
  let ethBalance: string | undefined;
  if (evmFunder) {
    const withTimeout = async <T>(p: Promise<T>, ms: number): Promise<T> => {
      let timer: NodeJS.Timeout | undefined;
      try {
        return await Promise.race([
          p,
          new Promise<T>((_, reject) => {
            timer = setTimeout(() => reject(new Error("timeout")), ms);
          }),
        ]);
      } finally {
        if (timer) clearTimeout(timer);
      }
    };

    try {
      const bsc = new JsonRpcProvider(env.RPC_URL_BSC);
      bnbBalance = formatEther(await withTimeout(bsc.getBalance(evmFunder.address), 12_000));
    } catch {
      bnbBalance = "rpc-error";
    }
    try {
      const eth = new JsonRpcProvider(env.RPC_URL_ETH);
      ethBalance = formatEther(await withTimeout(eth.getBalance(evmFunder.address), 12_000));
    } catch {
      ethBalance = "rpc-error";
    }
  }

  const masters = {
    TRC20: {
      address: env.DEPOSIT_WALLET_TRC20,
      valid: isValidTronAddress(env.DEPOSIT_WALLET_TRC20),
    },
    BEP20: {
      address: env.DEPOSIT_WALLET_BEP20,
      valid: isValidEvmAddress(env.DEPOSIT_WALLET_BEP20) && !/^0x0{40}$/i.test(env.DEPOSIT_WALLET_BEP20),
    },
    ERC20: {
      address: env.DEPOSIT_WALLET_ERC20,
      valid: isValidEvmAddress(env.DEPOSIT_WALLET_ERC20) && !/^0x0{40}$/i.test(env.DEPOSIT_WALLET_ERC20),
    },
  };

  const hdConfigured =
    Boolean(env.DEPOSIT_HD_MNEMONIC) &&
    !env.DEPOSIT_HD_MNEMONIC.includes("test test test test");

  const minFeeeTrx = 8;
  const feeeOk = probe.ok && (probe.trxBalance ?? 0) >= minFeeeTrx;
  const tronFunderOk =
    Boolean(tronFunder && "address" in tronFunder) &&
    (tronFunderTrx ?? 0) >= env.TRON_BANDWIDTH_TRX_TOPUP;

  const readyTrc20 = hdConfigured && masters.TRC20.valid && feeeOk && tronFunderOk;
  const readyBep20 =
    hdConfigured && masters.BEP20.valid && Boolean(evmFunder) && Number(bnbBalance ?? 0) >= env.EVM_GAS_TOPUP_BNB;
  const readyErc20 =
    hdConfigured && masters.ERC20.valid && Boolean(evmFunder) && Number(ethBalance ?? 0) >= env.EVM_GAS_TOPUP_ETH;

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        model: "Unique HD addresses → instant credit → sweep to master (3 networks)",
        egressIp,
        hdMnemonic: {
          configured: hdConfigured,
          encryptionKeySet: Boolean(env.DEPOSIT_ADDRESS_ENCRYPTION_KEY),
        },
        masters,
        feee: {
          ok: probe.ok,
          trxBalance: probe.trxBalance,
          needTrx: minFeeeTrx,
          apiKeyPrefix: env.TRON_ENERGY_API_KEY.slice(0, 8) || "(missing)",
          expectedUserAgent: FEEE_USER_AGENT,
          burnFallback: env.TRON_ENERGY_TRX_BURN_FALLBACK,
        },
        tronBandwidthFunder:
          tronFunder && "address" in tronFunder
            ? { address: tronFunder.address, trxBalance: tronFunderTrx }
            : tronFunder,
        evmGasFunder: evmFunder
          ? {
              address: evmFunder.address,
              note: "Derived from funder mnemonic via m/44'/60'/0'/0/0 — fund with BNB + ETH",
              bnbBalance,
              ethBalance,
              topupBnb: env.EVM_GAS_TOPUP_BNB,
              topupEth: env.EVM_GAS_TOPUP_ETH,
            }
          : null,
        ready: {
          TRC20: readyTrc20,
          BEP20: readyBep20,
          ERC20: readyErc20,
        },
        fundNow: [
          !feeeOk ? `Feee ≥ ${minFeeeTrx} TRX (prefer 20+)` : null,
          !tronFunderOk && tronFunder && "address" in tronFunder
            ? `Tron funder ${tronFunder.address} ≥ 15 TRX`
            : null,
          evmFunder && Number(bnbBalance ?? 0) < env.EVM_GAS_TOPUP_BNB
            ? `EVM funder ${evmFunder.address} ≥ ${env.EVM_GAS_TOPUP_BNB} BNB`
            : null,
          evmFunder && Number(ethBalance ?? 0) < env.EVM_GAS_TOPUP_ETH
            ? `EVM funder ${evmFunder.address} ≥ ${env.EVM_GAS_TOPUP_ETH} ETH`
            : null,
          masters.TRC20.valid ? `Master TRC20 ${masters.TRC20.address} ≥ 0.01 USDT (recommended)` : null,
        ].filter(Boolean),
      },
      null,
      2
    )
  );

  process.exit(readyTrc20 ? 0 : 1);
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
