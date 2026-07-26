import { z } from "zod";

/** Supported deposit networks. USDT-TRC20 is the primary/default rail. */
export const DEPOSIT_NETWORKS = ["TRC20", "BEP20", "ERC20"] as const;
export type DepositNetwork = (typeof DEPOSIT_NETWORKS)[number];

/** Query params for `GET /deposit/address` — which network to fetch the user's unique address for. */
export const getDepositAddressQuerySchema = z.object({
  network: z.enum(DEPOSIT_NETWORKS).default("TRC20"),
});

export type GetDepositAddressQuery = z.infer<typeof getDepositAddressQuerySchema>;
