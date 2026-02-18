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
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">
            <span className="text-[#F0B90B]">Tick</span>
            <span className="text-white">Shot</span>
          </h1>
          <p className="text-sm text-gray-400 mt-1">BNB/USD Price Prediction</p>
        </div>
        <div className="flex items-center gap-4">
          {isConnected && balance && (
            <div className="hidden sm:block text-right">
              <p className="text-xs text-gray-400">Balance</p>
              <p className="font-mono text-sm text-[#F0B90B]">
                {parseFloat(balance.formatted).toFixed(4)} {balance.symbol}
              </p>
            </div>
          )}
          {livePrice && (
            <div className="hidden sm:block text-right">
              <p className="text-xs text-gray-400">BNB/USD</p>
              <p className="font-mono text-sm text-white">
                ${livePrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
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
          <AdminPanel
            round={currentRound ?? null}
            isAdmin={true}
          />
        </div>
      )}

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Chart + Round Info */}
        <div className="lg:col-span-2 space-y-6">
          <PriceChart onPriceUpdate={setLivePrice} />
          <RoundInfo round={currentRound ?? null} />
        </div>

        {/* Right: Betting Panel */}
        <div className="space-y-6">
          {isConnected ? (
            <BettingPanel
              round={currentRound ?? null}
              userBet={userBet ?? null}
            />
          ) : (
            <div className="glass-panel p-8 text-center">
              <p className="text-gray-400 mb-4">Connect your wallet to start betting</p>
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
      <footer className="mt-12 text-center text-xs text-gray-600 pb-8">
        <p>TickShot BNB - BSC Testnet - 3% platform fee - Not financial advice</p>
      </footer>
    </div>
  );
}
