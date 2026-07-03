import type { Metadata } from "next";
import "./globals.css";
import { WalletProvider } from "@/context/WalletContext";
import { Navbar } from "@/components/Navbar";
import { ToastProvider } from "@/components/ui/Toast";

export const metadata: Metadata = {
  title: "Procurement Consensus — GenLayer-Powered Bid Evaluation",
  description:
    "Procurement Consensus uses GenLayer validators to compare supplier proposals by quality, price, delivery, compliance, and risk — then produces a transparent award recommendation.",
  keywords: ["procurement", "GenLayer", "blockchain", "bid evaluation", "consensus"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-midnight-navy text-paper-white font-body">
        <WalletProvider>
          <ToastProvider>
            <Navbar />
            <main className="min-h-screen">{children}</main>
          </ToastProvider>
        </WalletProvider>
      </body>
    </html>
  );
}
