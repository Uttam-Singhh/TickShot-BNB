"use client";

import { useState } from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { TICKSHOT_ABI } from "@/lib/abi";
import { CONTRACT_ADDRESS, RoundStatus, CHAINLINK_DECIMALS } from "@/lib/constants";

interface Round {
  roundId: bigint;
  status: number;
  endTime: bigint;
}

interface AdminPanelProps {
  round: Round | null;
  isAdmin: boolean;
}

async function fetchBinancePrice(): Promise<bigint> {
  const res = await fetch("https://api.binance.com/api/v3/ticker/price?symbol=BNBUSDT");
  const data = await res.json();
  const price = parseFloat(data.price);
  return BigInt(Math.round(price * 10 ** CHAINLINK_DECIMALS));
}

export function AdminPanel({ round, isAdmin }: AdminPanelProps) {
  const [error, setError] = useState<string | null>(null);

  const {
    writeContract: startRound,
    data: startHash,
    isPending: isStarting,
  } = useWriteContract();
  const { isLoading: isStartConfirming } = useWaitForTransactionReceipt({
    hash: startHash,
  });

  const {
    writeContract: resolveRound,
    data: resolveHash,
    isPending: isResolving,
  } = useWriteContract();
  const { isLoading: isResolveConfirming } = useWaitForTransactionReceipt({
    hash: resolveHash,
  });

  // All hooks above, conditional render below
  if (!isAdmin) return null;

  const canStart =
    !round ||
    Number(round.roundId) === 0 ||
    round.status === RoundStatus.Settled;

  const now = Math.floor(Date.now() / 1000);
  const canResolve =
    round &&
    Number(round.roundId) > 0 &&
    (round.status === RoundStatus.Open || round.status === RoundStatus.Locked) &&
    now >= Number(round.endTime);

  const handleStartRound = async () => {
    try {
      setError(null);
      const price = await fetchBinancePrice();
      startRound({
        address: CONTRACT_ADDRESS,
        abi: TICKSHOT_ABI,
        functionName: "startRoundWithPrice",
        args: [price],
      });
    } catch (e) {
      setError("Failed to fetch Binance price");
      console.error(e);
    }
  };

  const handleResolveRound = async () => {
    if (!round) return;
    try {
      setError(null);
      const price = await fetchBinancePrice();
      resolveRound({
        address: CONTRACT_ADDRESS,
        abi: TICKSHOT_ABI,
        functionName: "resolveRoundWithPrice",
        args: [round.roundId, price],
      });
    } catch (e) {
      setError("Failed to fetch Binance price");
      console.error(e);
    }
  };

  return (
    <div className="glass-panel p-6 border-[#F0B90B]/30">
      <h2 className="text-lg font-bold mb-4 text-[#F0B90B]">Admin Panel</h2>
      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
      <div className="flex gap-3">
        <button
          onClick={handleStartRound}
          disabled={!canStart || isStarting || isStartConfirming}
          className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#F0B90B] to-[#FCD535] text-black font-bold hover:opacity-90 transition disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {isStarting || isStartConfirming ? "Starting..." : "Start Round"}
        </button>
        <button
          onClick={handleResolveRound}
          disabled={!canResolve || isResolving || isResolveConfirming}
          className="flex-1 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 text-white font-bold hover:opacity-90 transition disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {isResolving || isResolveConfirming ? "Resolving..." : "Resolve Round"}
        </button>
      </div>
    </div>
  );
}
