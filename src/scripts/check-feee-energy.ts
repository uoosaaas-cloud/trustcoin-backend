/**
 * Diagnose Feee ENERGY + Bandwidth funder readiness (no orders placed).
 *
 *   npm run energy:check
 */
import dotenv from "dotenv";

dotenv.config();

import { env } from "../config/env";
import { TronWeb } from "tronweb";
import { FEEE_USER_AGENT, probeFeeeApiKey } from "../services/tronEnergy.service";
import { DEFAULT_TRON_FUNDER_DERIVATION_PATH, resolveTronBandwidthFunder } from "../utils/tronFunderKey";

async function main() {
  const egressIp = await fetch("https://api.ipify.org").then((r) => r.text());
  const probe = await probeFeeeApiKey();

  let bandwidthFunder: {
    configured: boolean;
    address?: string;
    trxBalance?: number;
    derivationPath?: string;
    error?: string;
  } = {
    configured: Boolean(
      env.TRON_BANDWIDTH_FUNDER_PRIVATE_KEY || env.TRON_BANDWIDTH_FUNDER_MNEMONIC
    ),
    derivationPath: env.TRON_BANDWIDTH_FUNDER_DERIVATION_PATH || DEFAULT_TRON_FUNDER_DERIVATION_PATH,
  };

  if (bandwidthFunder.configured) {
    try {
      const resolved = resolveTronBandwidthFunder();
      if (!resolved) {
        bandwidthFunder = { ...bandwidthFunder, configured: false };
      } else {
        const tronWeb = new TronWeb({ fullHost: env.TRON_FULL_HOST });
        const sun = Number(await tronWeb.trx.getBalance(resolved.address));
        bandwidthFunder = {
          ...bandwidthFunder,
          configured: true,
          address: resolved.address,
          trxBalance: sun / 1_000_000,
        };
      }
    } catch (error) {
      bandwidthFunder = {
        ...bandwidthFunder,
        configured: true,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // ~5 TRX covers a typical Feee Energy order; first-receive (~131k) may need ~6–8.
  const minFeeeTrx = 5;
  const feeeBalanceOk = (probe.trxBalance ?? 0) >= minFeeeTrx;
  const ready =
    probe.ok &&
    feeeBalanceOk &&
    bandwidthFunder.configured &&
    !bandwidthFunder.error &&
    (bandwidthFunder.trxBalance ?? 0) >= env.TRON_BANDWIDTH_TRX_TOPUP;

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        model: "Feee ENERGY + burn Bandwidth (TRX top-up/reclaim)",
        egressIp,
        feee: {
          ok: probe.ok,
          code: probe.code,
          msg: probe.msg,
          trxBalance: probe.trxBalance,
          whitelist: probe.whitelist,
          apiKeyPrefix: env.TRON_ENERGY_API_KEY.slice(0, 8) || "(missing)",
          providerUrl: env.TRON_ENERGY_PROVIDER_URL,
          requireFeee: env.TRON_ENERGY_REQUIRE,
          expectedUserAgent: FEEE_USER_AGENT,
        },
        bandwidth: {
          ...bandwidthFunder,
          topupTrx: env.TRON_BANDWIDTH_TRX_TOPUP,
          minTrx: env.TRON_BANDWIDTH_MIN_TRX,
          reclaimMinTrx: env.TRON_BANDWIDTH_RECLAIM_MIN_TRX,
        },
        ready,
        fixHint: !probe.ok
          ? probe.code === 20012
            ? `Feee rejected IP ${egressIp}. Whitelist this IP in Feee API Key settings.`
            : probe.msg
          : !feeeBalanceOk
            ? `Feee balance too low (${probe.trxBalance ?? 0} TRX). Top up Feee to ≥ ${minFeeeTrx} TRX (prefer 20+ for several sweeps).`
            : !bandwidthFunder.configured
              ? "Set TRON_BANDWIDTH_FUNDER_MNEMONIC (12 words) or TRON_BANDWIDTH_FUNDER_PRIVATE_KEY (hex)."
              : bandwidthFunder.error
                ? `Bandwidth funder invalid: ${bandwidthFunder.error}`
                : (bandwidthFunder.trxBalance ?? 0) < env.TRON_BANDWIDTH_TRX_TOPUP
                  ? `Fund bandwidth wallet ${bandwidthFunder.address} with TRX (need ≥ ${env.TRON_BANDWIDTH_TRX_TOPUP}).`
                  : "Ready — run: npm run sweep -- --address=<T...> --network=TRC20 --force",
      },
      null,
      2
    )
  );

  if (!ready) process.exitCode = 1;
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
