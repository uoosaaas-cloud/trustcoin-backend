import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { isGreaterThanOrEqual, toBig, toDecimalString } from "../utils/money";
import { getOrCreateUserDepositAddress } from "./depositAddress.service";
import { DEPOSIT_NETWORKS, type DepositNetwork } from "../validators/deposit.validator";

export interface DepositNetworkOption {
  network: DepositNetwork;
  currency: "USDT";
  label: string;
}

export interface DepositAddressOption {
  network: DepositNetwork;
  currency: "USDT";
  label: string;
  address: string;
  /** What the QR code should encode — currently just the raw address. */
  qrPayload: string;
}

const NETWORK_LABELS: Record<DepositNetwork, string> = {
  TRC20: "USDT (TRC20 — Tron)",
  BEP20: "USDT (BEP20 — BNB Smart Chain)",
  ERC20: "USDT (ERC20 — Ethereum)",
};

/** Returns static metadata (no address) for every supported deposit network. */
export function getDepositNetworks(): DepositNetworkOption[] {
  return DEPOSIT_NETWORKS.map((network) => ({
    network,
    currency: "USDT" as const,
    label: NETWORK_LABELS[network],
  }));
}

/**
 * Returns the logged-in user's unique receiving address for the given
 * network, deriving and persisting one on first use (see
 * `depositAddress.service.ts`). Every user gets their own address per
 * network so incoming funds can be unambiguously attributed to them.
 */
export async function getUserDepositAddress(
  userId: string,
  network: DepositNetwork
): Promise<DepositAddressOption> {
  const depositAddress = await getOrCreateUserDepositAddress(userId, network);

  return {
    network,
    currency: "USDT" as const,
    label: NETWORK_LABELS[network],
    address: depositAddress.address,
    qrPayload: depositAddress.address,
  };
}

/**
 * Credits the user only for USDT that is actually sitting on their
 * deposit sub-wallet and has not already been booked.
 *
 * Formula: credit = onChainBalance − sum(APPROVED claims not yet swept).
 * Never trusts a user-submitted amount. Safe to call on every sweep tick.
 */
export async function creditDetectedOnChainUsdt(params: {
  depositAddressId: string;
  userId: string;
  address: string;
  network: DepositNetwork;
  onChainUsdt: string;
}): Promise<{ credited: string | null; claimId: string | null }> {
  const { depositAddressId, userId, address, network, onChainUsdt } = params;
  const onChain = toDecimalString(onChainUsdt);

  if (!isGreaterThanOrEqual(onChain, env.DEPOSIT_SWEEP_MIN_USDT)) {
    return { credited: null, claimId: null };
  }

  const result = await prisma.$transaction(async (tx) => {
    const unsweptClaims = await tx.depositRequest.findMany({
      where: {
        deposit_address_id: depositAddressId,
        status: "APPROVED",
        sweep_tx_hash: null,
      },
      select: { amount: true },
    });

    const alreadyCredited = unsweptClaims.reduce(
      (sum, claim) => sum.plus(toBig(claim.amount.toString())),
      toBig(0)
    );
    const delta = toDecimalString(toBig(onChain).minus(alreadyCredited));

    if (!isGreaterThanOrEqual(delta, env.DEPOSIT_SWEEP_MIN_USDT)) {
      return { credited: null as string | null, claimId: null as string | null, ledgerTxHash: null as string | null };
    }

    // Old manual claims without on-chain funds must never credit — mark failed.
    await tx.depositRequest.updateMany({
      where: {
        deposit_address_id: depositAddressId,
        status: "PENDING",
      },
      data: { status: "REJECTED" },
    });

    const claim = await tx.depositRequest.create({
      data: {
        user_id: userId,
        amount: delta,
        currency: "USDT",
        network,
        deposit_address_id: depositAddressId,
        status: "APPROVED",
      },
    });

    const ledgerTxHash = `onchain-credit:${claim.id}`;

    await tx.transaction.create({
      data: {
        user_id: userId,
        amount: delta,
        type: "DEPOSIT",
        status: "COMPLETED",
        tx_hash: ledgerTxHash,
        payment_address: address,
        note: `Auto-credited ${delta} USDT after on-chain detection on ${network} (${address}).`,
      },
    });

    await tx.user.update({
      where: { id: userId },
      data: { balance: { increment: delta } },
    });

    // eslint-disable-next-line no-console
    console.log(
      `[deposit] Credited ${delta} USDT to user ${userId} from ${address} ` +
        `(on-chain=${onChain}, previously-unswept=${toDecimalString(alreadyCredited)})`
    );

    return { credited: delta, claimId: claim.id, ledgerTxHash };
  });

  if (result.credited && result.ledgerTxHash) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (user?.email) {
      const { queueEmail, sendDepositNotification } = await import("./email.service");
      queueEmail(
        () => sendDepositNotification(user.email, result.credited!, result.ledgerTxHash!),
        `deposit-notify:${user.email}`
      );
    }
  }

  return { credited: result.credited, claimId: result.claimId };
}

/**
 * Backfills missing `DepositRequest` rows for completed DEPOSIT ledger
 * entries (e.g. exceptional manual credits that never created a claim).
 * Idempotent — safe to call on history / admin monitoring reads.
 */
export async function reconcileOrphanDepositLedgerEntries(userId?: string): Promise<number> {
  const ledgerDeposits = await prisma.transaction.findMany({
    where: {
      type: "DEPOSIT",
      status: "COMPLETED",
      ...(userId ? { user_id: userId } : {}),
    },
    select: {
      id: true,
      user_id: true,
      amount: true,
      tx_hash: true,
      payment_address: true,
      note: true,
      created_at: true,
    },
    orderBy: { created_at: "asc" },
  });

  let created = 0;

  for (const row of ledgerDeposits) {
    const hash = row.tx_hash ?? "";
    let claimId: string | null = null;
    if (hash.startsWith("onchain-credit:")) {
      claimId = hash.slice("onchain-credit:".length);
    } else if (hash.startsWith("manual-credit:")) {
      claimId = hash.slice("manual-credit:".length);
    }

    if (claimId) {
      const existing = await prisma.depositRequest.findUnique({
        where: { id: claimId },
        select: { id: true },
      });
      if (existing) continue;
    }

    const nearby = await prisma.depositRequest.findFirst({
      where: {
        user_id: row.user_id,
        amount: row.amount,
        status: "APPROVED",
        created_at: {
          gte: new Date(row.created_at.getTime() - 60_000),
          lte: new Date(row.created_at.getTime() + 60_000),
        },
      },
      select: { id: true },
    });
    if (nearby) continue;

    let depositAddressId: string | null = null;
    let network: DepositNetwork = "TRC20";

    if (row.payment_address) {
      const matched = await prisma.userDepositAddress.findFirst({
        where: { user_id: row.user_id, address: row.payment_address },
        select: { id: true, network: true },
      });
      if (matched && (DEPOSIT_NETWORKS as readonly string[]).includes(matched.network)) {
        depositAddressId = matched.id;
        network = matched.network as DepositNetwork;
      }
    }

    if (!depositAddressId) {
      const preferred = await prisma.userDepositAddress.findFirst({
        where: { user_id: row.user_id },
        orderBy: { created_at: "asc" },
        select: { id: true, network: true },
      });
      if (preferred && (DEPOSIT_NETWORKS as readonly string[]).includes(preferred.network)) {
        depositAddressId = preferred.id;
        network = preferred.network as DepositNetwork;
      }
    }

    const data = {
      user_id: row.user_id,
      amount: toDecimalString(row.amount.toString()),
      currency: "USDT",
      network,
      deposit_address_id: depositAddressId,
      status: "APPROVED" as const,
      tx_hash: hash.startsWith("manual-credit:") ? hash : null,
      created_at: row.created_at,
      updated_at: row.created_at,
    };

    try {
      if (claimId) {
        await prisma.depositRequest.create({ data: { id: claimId, ...data } });
      } else {
        await prisma.depositRequest.create({ data });
      }
      created += 1;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`[deposit] Failed to backfill DepositRequest for ledger ${row.id}:`, error);
    }
  }

  return created;
}

/** Returns the logged-in user's deposit request history, newest first. */
export async function listUserDepositRequests(userId: string) {
  await reconcileOrphanDepositLedgerEntries(userId);

  const rows = await prisma.depositRequest.findMany({
    where: { user_id: userId },
    orderBy: { created_at: "desc" },
    include: {
      depositAddress: {
        select: { address: true },
      },
    },
  });

  // Flatten the relation so the frontend gets a simple `deposit_address`
  // string without ever seeing encrypted private-key material.
  return rows.map(({ depositAddress, ...request }) => ({
    ...request,
    deposit_address: depositAddress?.address ?? null,
  }));
}
