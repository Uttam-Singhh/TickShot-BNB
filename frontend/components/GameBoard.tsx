"use client";

import { useState } from "react";
import { useAccount, useBalance, useReadContract } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { TICKSHOT_ABI } from "@/lib/abi";
import { CONTRACT_ADDRESS } from "@/lib/constants";
import { PriceChart } from "./PriceChart";
import { RoundInfo } from "./RoundInfo";
import { BettingPanel } from "./BettingPanel";
import { RoundHistory } from "./RoundHistory";
import { AdminPanel } from "./AdminPanel";

export function GameBoard() {
  const { address, isConnected } = useAccount();
  const { data: balance } = useBalance({ address });
  const [livePrice, setLivePrice] = useState<number | null>(null);

  const { data: currentRoundId } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: TICKSHOT_ABI,
    functionName: "currentRoundId",
    query: { refetchInterval: 3000 },
  });

  const roundId = currentRoundId ? Number(currentRoundId) : 0;

  const { data: currentRound } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: TICKSHOT_ABI,
    functionName: "getCurrentRound",
    query: { refetchInterval: 3000 },
  });

  const { data: adminAddress } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: TICKSHOT_ABI,
    functionName: "admin",
  });

  const { data: userBet } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: TICKSHOT_ABI,
    functionName: "getUserBet",
    args: address && roundId > 0 ? [BigInt(roundId), address] : undefined,
    query: { refetchInterval: 3000 },
  });

  const isAdmin =
    address && adminAddress && address.toLowerCase() === adminAddress.toLowerCase();

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6">
      {/* Header */}
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
              <span className="bg-gradient-to-r from-[#F0B90B] to-[#FCD535] bg-clip-text text-transparent">Tick</span>
              <span className="text-white">Shot</span>
            </h1>
            <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 mt-0.5">BNB Price Prediction</p>
          </div>
        </div>
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Live price ticker */}
          {livePrice && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-live-dot" />
              <span className="font-mono text-sm font-bold text-white">
                ${livePrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          )}
          {isConnected && balance && (
            <div className="hidden sm:block px-3 py-2 rounded-xl bg-white/[0.03] border border-white/5">
              <span className="font-mono text-sm text-[#F0B90B] font-bold">
                {parseFloat(balance.formatted).toFixed(4)}
              </span>
              <span className="text-gray-500 text-xs ml-1">{balance.symbol}</span>
            </div>
          )}
          <ConnectButton
            showBalance={false}
            chainStatus="icon"
            accountStatus="address"
          />
        </div>
      </header>

      {/* Admin Panel */}
      {isAdmin && (
        <div className="mb-6">
          <AdminPanel round={currentRound ?? null} isAdmin={true} />
        </div>
      )}

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Chart + Round Info */}
        <div className="lg:col-span-2 space-y-5">
          <PriceChart onPriceUpdate={setLivePrice} />
          <RoundInfo round={currentRound ?? null} />
        </div>

        {/* Right: Betting Panel */}
        <div className="space-y-5">
          {isConnected ? (
            <BettingPanel
              round={currentRound ?? null}
              userBet={userBet ?? null}
            />
          ) : (
            <div className="glass-panel p-10 text-center">
              <div className="text-4xl mb-4 animate-float">&#128176;</div>
              <p className="text-gray-300 font-medium mb-2">Ready to predict?</p>
              <p className="text-gray-500 text-sm mb-6">Connect your wallet to start betting on BNB price</p>
              <ConnectButton />
            </div>
          )}
        </div>
      </div>

      {/* Round History */}
      <div className="mt-6">
        <RoundHistory currentRoundId={roundId} />
      </div>

      {/* Footer */}
      <footer className="mt-10 text-center text-xs text-gray-700 pb-6 border-t border-white/5 pt-6">
        <p>TickShot BNB &middot; BSC Testnet &middot; 3% platform fee &middot; Not financial advice</p>
      </footer>
    </div>
  );
}
