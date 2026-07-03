type AnyArgs = any[];

import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";
import type { EIP1193Provider } from "./wallet-types";

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS as `0x${string}` | undefined;

export function getReadClient() {
  return createClient({ chain: studionet });
}

export function getProviderClient(provider: EIP1193Provider, account: `0x${string}`) {
  return createClient({ chain: studionet, provider: provider as any, account });
}

export function getContractAddress(): `0x${string}` {
  if (!CONTRACT_ADDRESS) {
    throw new Error(
      "Contract address not configured. Set NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS in .env.local"
    );
  }
  return CONTRACT_ADDRESS;
}

export async function readContract<T>(functionName: string, args: AnyArgs = []): Promise<T> {
  const client = getReadClient();
  const address = getContractAddress();
  const result = await (client as any).readContract({ address, functionName, args });
  if (typeof result === "string") {
    try {
      return JSON.parse(result) as T;
    } catch {
      return result as unknown as T;
    }
  }
  return result as T;
}

export async function writeContract(
  provider: EIP1193Provider,
  functionName: string,
  args: AnyArgs,
  value?: bigint
): Promise<string> {
  // Derive the active account from the provider so genlayer-js knows who is signing
  const accounts = (await provider.request({ method: "eth_accounts" })) as string[];
  if (!accounts || accounts.length === 0) throw new Error("No accounts found. Is your wallet unlocked?");
  const account = accounts[0] as `0x${string}`;

  const client = getProviderClient(provider, account);
  const contractAddress = getContractAddress();
  const hash = await (client as any).writeContract({
    address: contractAddress,
    functionName,
    args,
    value: value ?? BigInt(0),
  });
  return hash as string;
}

// waitForTransaction only polls — no signing needed, read client suffices
export async function waitForTransaction(
  hash: string,
  status: TransactionStatus = TransactionStatus.ACCEPTED
) {
  const client = getReadClient();
  return (client as any).waitForTransactionReceipt({
    hash,
    status,
    retries: 60,
    interval: 3000,
  });
}

export { TransactionStatus };
