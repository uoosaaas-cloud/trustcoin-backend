export type WithdrawNetwork = "TRC20" | "BEP20" | "ERC20";

export const WITHDRAW_NETWORKS: WithdrawNetwork[] = ["TRC20", "BEP20", "ERC20"];

const TRON_ADDRESS_RE = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export function isValidWithdrawAddress(network: WithdrawNetwork, address: string): boolean {
  const trimmed = address.trim();
  if (network === "TRC20") return TRON_ADDRESS_RE.test(trimmed);
  return EVM_ADDRESS_RE.test(trimmed);
}

export function withdrawAddressHint(network: WithdrawNetwork): string {
  if (network === "TRC20") return "T…";
  return "0x…";
}
