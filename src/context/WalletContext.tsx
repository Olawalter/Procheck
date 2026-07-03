"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import type { EIP1193Provider, EIP6963ProviderDetail } from "@/lib/wallet-types";
import { getExplorerAddressUrl } from "@/lib/utils";
import { WalletSelectModal } from "@/components/WalletSelectModal";

const STORAGE_KEY = "procheck_wallet_rdns";
const STUDIONET_CHAIN_ID = 61999;
const STUDIONET_CHAIN_ID_HEX = "0xF22F";

interface WalletContextType {
  address: string | null;
  provider: EIP1193Provider | null;
  isConnecting: boolean;
  isConnected: boolean;
  chainId: number | null;
  isWrongNetwork: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchNetwork: () => Promise<void>;
  explorerUrl: string | null;
  txHashes: string[];
  addTxHash: (hash: string) => void;
}

const WalletContext = createContext<WalletContextType>({
  address: null,
  provider: null,
  isConnecting: false,
  isConnected: false,
  chainId: null,
  isWrongNetwork: false,
  connect: async () => {},
  disconnect: () => {},
  switchNetwork: async () => {},
  explorerUrl: null,
  txHashes: [],
  addTxHash: () => {},
});

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [provider, setProvider] = useState<EIP1193Provider | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [txHashes, setTxHashes] = useState<string[]>([]);
  const [detectedWallets, setDetectedWallets] = useState<EIP6963ProviderDetail[]>([]);
  const [showModal, setShowModal] = useState(false);
  const walletsRef = useRef<Map<string, EIP6963ProviderDetail>>(new Map());

  // EIP-6963: collect all announced wallet providers
  useEffect(() => {
    const handler = (event: CustomEvent<EIP6963ProviderDetail>) => {
      walletsRef.current.set(event.detail.info.rdns, event.detail);
      setDetectedWallets(Array.from(walletsRef.current.values()));
    };
    window.addEventListener("eip6963:announceProvider", handler as EventListener);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    return () => window.removeEventListener("eip6963:announceProvider", handler as EventListener);
  }, []);

  const attachListeners = useCallback((p: EIP1193Provider) => {
    const onAccountsChanged = (accounts: unknown) => {
      const accs = accounts as string[];
      if (!accs || accs.length === 0) {
        setAddress(null);
        setProvider(null);
        setChainId(null);
        localStorage.removeItem(STORAGE_KEY);
      } else {
        setAddress(accs[0]);
      }
    };

    const onChainChanged = (id: unknown) => {
      setChainId(parseInt(id as string, 16));
    };

    const onDisconnect = () => {
      setAddress(null);
      setProvider(null);
      setChainId(null);
      localStorage.removeItem(STORAGE_KEY);
    };

    p.on("accountsChanged", onAccountsChanged);
    p.on("chainChanged", onChainChanged);
    p.on("disconnect", onDisconnect);
  }, []);

  const applyConnection = useCallback(
    (p: EIP1193Provider, accounts: string[], rawChainId: string, rdns?: string) => {
      setProvider(p);
      setAddress(accounts[0]);
      setChainId(parseInt(rawChainId, 16));
      attachListeners(p);
      localStorage.setItem(STORAGE_KEY, rdns ?? "__injected__");
    },
    [attachListeners]
  );

  const connectToProvider = useCallback(
    async (p: EIP1193Provider, rdns?: string) => {
      const accounts = (await p.request({ method: "eth_requestAccounts" })) as string[];
      if (!accounts || accounts.length === 0) throw new Error("No accounts returned");
      const rawChainId = (await p.request({ method: "eth_chainId" })) as string;
      applyConnection(p, accounts, rawChainId, rdns);
    },
    [applyConnection]
  );

  // Auto-reconnect on page load if previously connected
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;

    const tryReconnect = async () => {
      try {
        // Small delay so EIP-6963 wallets have time to announce
        await new Promise((r) => setTimeout(r, 80));

        let p: EIP1193Provider | undefined;
        if (stored !== "__injected__") {
          p = walletsRef.current.get(stored)?.provider;
        }
        if (!p && typeof window !== "undefined" && window.ethereum) {
          p = window.ethereum;
        }
        if (!p) return;

        // Use eth_accounts (no prompt) — only reconnects if wallet is already unlocked
        const accounts = (await p.request({ method: "eth_accounts" })) as string[];
        if (accounts && accounts.length > 0) {
          const rawChainId = (await p.request({ method: "eth_chainId" })) as string;
          applyConnection(p, accounts, rawChainId, stored);
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    };

    tryReconnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const switchNetwork = useCallback(async () => {
    if (!provider) return;
    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: STUDIONET_CHAIN_ID_HEX }],
      });
    } catch (err: unknown) {
      // 4902 = chain not added to wallet yet
      if ((err as { code?: number }).code === 4902) {
        await provider.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: STUDIONET_CHAIN_ID_HEX,
              chainName: "GenLayer StudioNet",
              nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
              rpcUrls: [
                process.env.NEXT_PUBLIC_GENLAYER_RPC_URL ?? "https://studio.genlayer.com/api",
              ],
              blockExplorerUrls: [
                process.env.NEXT_PUBLIC_GENLAYER_EXPLORER_URL ??
                  "https://explorer-studio.genlayer.com",
              ],
            },
          ],
        });
      }
    }
  }, [provider]);

  const connect = useCallback(async () => {
    const eip6963Wallets = Array.from(walletsRef.current.values());
    const hasLegacy = typeof window !== "undefined" && !!window.ethereum;

    // No wallet at all — show modal with install links
    if (eip6963Wallets.length === 0 && !hasLegacy) {
      setShowModal(true);
      return;
    }

    // Multiple EIP-6963 wallets — let user choose
    if (eip6963Wallets.length > 1) {
      setShowModal(true);
      return;
    }

    // Single EIP-6963 wallet — connect directly
    if (eip6963Wallets.length === 1) {
      setIsConnecting(true);
      try {
        await connectToProvider(eip6963Wallets[0].provider, eip6963Wallets[0].info.rdns);
      } catch (err: unknown) {
        if ((err as { code?: number }).code !== 4001) console.error(err);
      } finally {
        setIsConnecting(false);
      }
      return;
    }

    // Only legacy window.ethereum — connect directly
    if (hasLegacy) {
      setIsConnecting(true);
      try {
        await connectToProvider(window.ethereum!);
      } catch (err: unknown) {
        if ((err as { code?: number }).code !== 4001) console.error(err);
      } finally {
        setIsConnecting(false);
      }
    }
  }, [connectToProvider]);

  const selectWallet = useCallback(
    async (detail: EIP6963ProviderDetail | null) => {
      setShowModal(false);
      if (!detail) return;
      setIsConnecting(true);
      try {
        await connectToProvider(detail.provider, detail.info.rdns);
      } catch (err: unknown) {
        if ((err as { code?: number }).code !== 4001) console.error(err);
      } finally {
        setIsConnecting(false);
      }
    },
    [connectToProvider]
  );

  const disconnect = useCallback(() => {
    setAddress(null);
    setProvider(null);
    setChainId(null);
    setTxHashes([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const addTxHash = useCallback((hash: string) => {
    setTxHashes((prev) => [hash, ...prev].slice(0, 20));
  }, []);

  const isWrongNetwork = chainId !== null && chainId !== STUDIONET_CHAIN_ID;

  return (
    <WalletContext.Provider
      value={{
        address,
        provider,
        isConnecting,
        isConnected: !!address,
        chainId,
        isWrongNetwork,
        connect,
        disconnect,
        switchNetwork,
        explorerUrl: address ? getExplorerAddressUrl(address) : null,
        txHashes,
        addTxHash,
      }}
    >
      {children}
      <WalletSelectModal
        wallets={detectedWallets}
        open={showModal}
        onSelect={selectWallet}
        onClose={() => setShowModal(false)}
      />
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}
