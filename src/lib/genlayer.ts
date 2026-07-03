type AnyArgs = any[];

import { createClient, createAccount } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS as `0x${string}` | undefined;

export function getReadClient() {
  return createClient({
    chain: studionet,
    account: undefined,
  });
}

export function getWriteClient(privateKey: `0x${string}`) {
  const account = createAccount(privateKey);
  return createClient({
    chain: studionet,
    account,
  });
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
  const result = await (client as any).readContract({
    address,
    functionName,
    args,
  });
  // All contract view methods return JSON strings — parse automatically
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
  privateKey: `0x${string}`,
  functionName: string,
  args: AnyArgs,
  value?: bigint
): Promise<string> {
  const client = getWriteClient(privateKey);
  const address = getContractAddress();
  const hash = await (client as any).writeContract({
    address,
    functionName,
    args,
    value: value ?? BigInt(0),
  });
  return hash as string;
}

export async function waitForTransaction(
  privateKey: `0x${string}`,
  hash: string,
  status: TransactionStatus = TransactionStatus.ACCEPTED
) {
  const client = getWriteClient(privateKey);
  return (client as any).waitForTransactionReceipt({
    hash,
    status,
    retries: 60,
    interval: 3000,
  });
}

export { TransactionStatus };
