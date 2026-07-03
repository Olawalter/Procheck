"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { generatePrivateKey, createAccount } from "genlayer-js";
import { getExplorerAddressUrl } from "@/lib/utils";

const STORAGE_KEY = "procheck_wallet_pk";

interface WalletAccount {
  address: string;
  privateKey: `0x${string}`;
}

interface WalletContextType {
  address: string | null;
  account: WalletAccount | null;
  isConnecting: boolean;
  isConnected: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  explorerUrl: string | null;
  txHashes: string[];
  addTxHash: (hash: string) => void;
}

const WalletContext = createContext<WalletContextType>({
  address: null,
  account: null,
  isConnecting: false,
  isConnected: false,
  connect: async () => {},
  disconnect: () => {},
  explorerUrl: null,
  txHashes: [],
  addTxHash: () => {},
});

function loadOrCreateKey(): WalletAccount {
  const stored = localStorage.getItem(STORAGE_KEY);
  const pk = (stored ?? generatePrivateKey()) as `0x${string}`;
  if (!stored) localStorage.setItem(STORAGE_KEY, pk);
  const acct = createAccount(pk);
  return { address: acct.address, privateKey: pk };
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<WalletAccount | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [txHashes, setTxHashes] = useState<string[]>([]);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    try {
      const wa = loadOrCreateKey();
      setAccount(wa);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAccount(null);
    setTxHashes([]);
  }, []);

  const addTxHash = useCallback((hash: string) => {
    setTxHashes((prev) => [hash, ...prev].slice(0, 20));
  }, []);

  // Auto-reconnect on page load if key exists
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const acct = createAccount(stored as `0x${string}`);
        setAccount({ address: acct.address, privateKey: stored as `0x${string}` });
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  return (
    <WalletContext.Provider
      value={{
        address: account?.address ?? null,
        account,
        isConnecting,
        isConnected: !!account,
        connect,
        disconnect,
        explorerUrl: account ? getExplorerAddressUrl(account.address) : null,
        txHashes,
        addTxHash,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}
