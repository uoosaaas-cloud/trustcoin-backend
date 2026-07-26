import { Prisma, type UserDepositAddress } from "@prisma/client";
import { prisma } from "../config/prisma";
import { computeDerivationIndex, deriveDepositWallet } from "../utils/depositWallet";
import { encryptSecret } from "../utils/secretCipher";
import type { DepositNetwork } from "../validators/deposit.validator";

/**
 * Returns the user's unique receiving address for a given network,
 * deriving and persisting one on first use. Idempotent and safe under
 * concurrent calls: derivation is deterministic, so if two requests race to
 * create the same (user, network) row, the loser's unique-constraint error
 * is swallowed and the winner's row is returned instead.
 */
export async function getOrCreateUserDepositAddress(
  userId: string,
  network: DepositNetwork
): Promise<UserDepositAddress> {
  const existing = await prisma.userDepositAddress.findUnique({
    where: { user_id_network: { user_id: userId, network } },
  });

  if (existing) {
    return existing;
  }

  const derivationIndex = computeDerivationIndex(userId, network);
  const wallet = deriveDepositWallet(network, derivationIndex);

  try {
    return await prisma.userDepositAddress.create({
      data: {
        user_id: userId,
        network,
        address: wallet.address,
        derivation_index: wallet.derivationIndex,
        encrypted_private_key: encryptSecret(wallet.privateKeyHex),
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const winner = await prisma.userDepositAddress.findUnique({
        where: { user_id_network: { user_id: userId, network } },
      });
      if (winner) {
        return winner;
      }
    }
    throw error;
  }
}
