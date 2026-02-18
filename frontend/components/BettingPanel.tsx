"use client";

import { useState } from "react";
import { parseEther, formatEther } from "viem";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { TICKSHOT_ABI } from "@/lib/abi";
import { CONTRACT_ADDRESS, Direction, RoundStatus, MIN_BET } from "@/lib/constants";

interface Round {
  roundId: bigint;
  status: number;
  lockTime: bigint;
  totalUpPool: bigint;
  totalDownPool: bigint;
}

interface UserBet {
  direction: number;
  amount: bigint;
  claimed: boolean;
}

interface BettingPanelProps {
  round: Round | null;
  userBet: UserBet | null;
}

const PRESET_AMOUNTS = ["0.005", "0.01", "0.05", "0.1"];

export function BettingPanel({ round, userBet }: BettingPanelProps) {
  const [amount, setAmount] = useState("0.01");

  const { writeContract: placeBet, data: betHash, isPending: isBetting } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: betHash,
  });

  const { writeContract: claim, data: claimHash, isPending: isClaiming } = useWriteContract();
  const { isLoading: isClaimConfirming } = useWaitForTransactionReceipt({
    hash: claimHash,
  });

  if (!round || Number(round.roundId) === 0) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  const isLocked = now >= Number(round.lockTime);
  const isSettled = round.status === RoundStatus.Settled;
  const hasBet = userBet && userBet.amount > BigInt(0);
  const canBet = !isLocked && !isSettled && !hasBet && round.status === RoundStatus.Open;

  const handleBet = (direction: Direction) => {
    if (!canBet) return;
    const value = parseEther(amount);
    if (Number(amount) < MIN_BET) return;

    placeBet({
      address: CONTRACT_ADDRESS,
      abi: TICKSHOT_ABI,
      functionName: "placeBet",
      args: [round.roundId, direction],
      value,
    });
  };

  const handleClaim = () => {
    claim({
      address: CONTRACT_ADDRESS,
      abi: TICKSHOT_ABI,
      functionName: "claimWinnings",
      args: [round.roundId],
    });
  };

  return (
    <div className="glass-panel p-6">
      <h2 className="text-lg font-bold mb-4">Place Your Bet</h2>

      {/* User's existing bet */}
      {hasBet && (
        <div className="mb-4 p-3 rounded-lg bg-white/5 border border-white/10">
          <p className="text-sm text-gray-400">Your bet</p>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`font-bold ${
                userBet.direction === Direction.Up ? "text-green-400" : "text-red-400"
              }`}
            >
              {userBet.direction === Direction.Up ? "UP" : "DOWN"}
            </span>
            <span className="text-white font-mono">
              {parseFloat(formatEther(userBet.amount)).toFixed(4)} tBNB
            </span>
          </div>
          {isSettled && !userBet.claimed && (
            <button
              onClick={handleClaim}
              disabled={isClaiming || isClaimConfirming}
              className="mt-2 w-full py-2 rounded-lg bg-[#F0B90B] text-black font-bold hover:bg-[#FCD535] transition disabled:opacity-50"
            >
              {isClaiming || isClaimConfirming ? "Claiming..." : "Claim Winnings"}
            </button>
          )}
          {isSettled && userBet.claimed && (
            <p className="mt-2 text-sm text-green-400">Claimed</p>
          )}
        </div>
      )}

      {/* Betting UI */}
      {canBet && (
        <>
          {/* Amount input */}
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-2">Amount (tBNB)</label>
            <input
              type="number"
              step="0.001"
              min={MIN_BET}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white font-mono focus:outline-none focus:border-[#F0B90B] transition"
              placeholder="0.01"
            />
            <div className="flex gap-2 mt-2">
              {PRESET_AMOUNTS.map((preset) => (
                <button
                  key={preset}
                  onClick={() => setAmount(preset)}
                  className={`flex-1 py-1.5 text-xs rounded-lg border transition ${
                    amount === preset
                      ? "border-[#F0B90B] text-[#F0B90B] bg-[#F0B90B]/10"
                      : "border-white/10 text-gray-400 hover:border-white/30"
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* UP/DOWN buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleBet(Direction.Up)}
              disabled={isBetting || isConfirming}
              className="relative py-4 rounded-xl bg-gradient-to-br from-green-500 to-green-600 text-white font-bold text-lg hover:from-green-400 hover:to-green-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-500/20"
            >
              <span className="text-2xl block">&#9650;</span>
              UP
            </button>
            <button
              onClick={() => handleBet(Direction.Down)}
              disabled={isBetting || isConfirming}
              className="relative py-4 rounded-xl bg-gradient-to-br from-red-500 to-red-600 text-white font-bold text-lg hover:from-red-400 hover:to-red-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-red-500/20"
            >
              <span className="text-2xl block">&#9660;</span>
              DOWN
            </button>
          </div>

          {(isBetting || isConfirming) && (
            <p className="text-center text-sm text-[#F0B90B] mt-3 animate-pulse">
              {isBetting ? "Confirm in wallet..." : "Confirming on-chain..."}
            </p>
          )}
          {isConfirmed && (
            <p className="text-center text-sm text-green-400 mt-3">Bet placed!</p>
          )}
        </>
      )}

      {isLocked && !isSettled && !hasBet && (
        <div className="text-center py-6 text-gray-500">
          <p className="text-lg font-bold mb-1">Betting Locked</p>
          <p className="text-sm">Wait for this round to settle</p>
        </div>
      )}

      {/* Implied multipliers */}
      {round.totalUpPool + round.totalDownPool > BigInt(0) && canBet && (
        <div className="mt-4 grid grid-cols-2 gap-3 text-center text-sm">
          <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/20">
            <p className="text-gray-400 text-xs">UP payout</p>
            <p className="text-green-400 font-bold">
              {round.totalUpPool > BigInt(0)
                ? `${(
                    (Number(round.totalUpPool + round.totalDownPool) * 0.97) /
                    Number(round.totalUpPool)
                  ).toFixed(2)}x`
                : "---"}
            </p>
          </div>
          <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20">
            <p className="text-gray-400 text-xs">DOWN payout</p>
            <p className="text-red-400 font-bold">
              {round.totalDownPool > BigInt(0)
                ? `${(
                    (Number(round.totalUpPool + round.totalDownPool) * 0.97) /
                    Number(round.totalDownPool)
                  ).toFixed(2)}x`
                : "---"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
