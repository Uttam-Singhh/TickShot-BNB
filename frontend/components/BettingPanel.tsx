"use client";

import { useState, useEffect } from "react";
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
  const [lockCountdown, setLockCountdown] = useState(0);

  const { writeContract: placeBet, data: betHash, isPending: isBetting } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: betHash });

  const { writeContract: claim, data: claimHash, isPending: isClaiming } = useWriteContract();
  const { isLoading: isClaimConfirming } = useWaitForTransactionReceipt({ hash: claimHash });

  useEffect(() => {
    if (!round) return;
    const tick = () => {
      const now = Math.floor(Date.now() / 1000);
      setLockCountdown(Math.max(0, Number(round.lockTime) - now));
    };
    tick();
    const interval = setInterval(tick, 200);
    return () => clearInterval(interval);
  }, [round]);

  if (!round || Number(round.roundId) === 0) return null;

  const now = Math.floor(Date.now() / 1000);
  const isLocked = now >= Number(round.lockTime);
  const isSettled = round.status === RoundStatus.Settled;
  const hasBet = userBet && userBet.amount > BigInt(0);
  const canBet = !isLocked && !isSettled && !hasBet && round.status === RoundStatus.Open;
  const totalPool = round.totalUpPool + round.totalDownPool;

  const handleBet = (direction: Direction) => {
    if (!canBet) return;
    if (Number(amount) < MIN_BET) return;
    placeBet({
      address: CONTRACT_ADDRESS,
      abi: TICKSHOT_ABI,
      functionName: "placeBet",
      args: [round.roundId, direction],
      value: parseEther(amount),
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
    <div className={`glass-panel overflow-hidden animate-slide-in ${
      canBet && lockCountdown <= 20 ? "border-[#F0B90B]/30 glow-bnb" : ""
    }`}>
      {/* Header */}
      <div className="px-6 py-3 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
        <span className="font-bold text-white">Place Your Bet</span>
        {canBet && (
          <span className={`text-xs font-mono font-bold px-2 py-1 rounded-md ${
            lockCountdown <= 10
              ? "bg-red-500/20 text-red-400 animate-urgency"
              : lockCountdown <= 20
              ? "bg-yellow-500/20 text-yellow-400"
              : "bg-green-500/20 text-green-400"
          }`}>
            {lockCountdown}s left
          </span>
        )}
      </div>

      <div className="p-6">
        {/* User's existing bet */}
        {hasBet && (
          <div className={`mb-4 p-4 rounded-xl border animate-slide-in ${
            userBet.direction === Direction.Up
              ? "bg-green-500/5 border-green-500/20"
              : "bg-red-500/5 border-red-500/20"
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 mb-1">Your Bet</p>
                <div className="flex items-center gap-2">
                  <span className={`text-xl font-bold ${
                    userBet.direction === Direction.Up ? "text-green-400" : "text-red-400"
                  }`}>
                    {userBet.direction === Direction.Up ? "UP" : "DOWN"}
                  </span>
                  <span className="text-white font-mono text-lg">
                    {parseFloat(formatEther(userBet.amount)).toFixed(4)} tBNB
                  </span>
                </div>
              </div>
              <div className={`text-3xl ${
                userBet.direction === Direction.Up ? "text-green-400" : "text-red-400"
              }`}>
                {userBet.direction === Direction.Up ? "\u25B2" : "\u25BC"}
              </div>
            </div>
            {isSettled && !userBet.claimed && (
              <button
                onClick={handleClaim}
                disabled={isClaiming || isClaimConfirming}
                className="mt-3 w-full py-3 rounded-xl bg-gradient-to-r from-[#F0B90B] to-[#FCD535] text-black font-bold text-lg hover:opacity-90 transition disabled:opacity-50 glow-bnb"
              >
                {isClaiming || isClaimConfirming ? "Claiming..." : "Claim Winnings"}
              </button>
            )}
            {isSettled && userBet.claimed && (
              <div className="mt-3 text-center text-green-400 font-bold text-sm">Claimed</div>
            )}
          </div>
        )}

        {/* Betting UI */}
        {canBet && (
          <>
            {/* Amount input */}
            <div className="mb-5">
              <label className="block text-xs text-gray-500 uppercase tracking-wider mb-2">Bet Amount</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.001"
                  min={MIN_BET}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-4 text-white font-mono text-lg focus:outline-none focus:border-[#F0B90B] focus:shadow-[0_0_20px_rgba(240,185,11,0.15)] transition-all"
                  placeholder="0.01"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">tBNB</span>
              </div>
              <div className="flex gap-2 mt-2">
                {PRESET_AMOUNTS.map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setAmount(preset)}
                    className={`flex-1 py-2 text-xs font-mono rounded-lg border transition-all ${
                      amount === preset
                        ? "border-[#F0B90B] text-[#F0B90B] bg-[#F0B90B]/10 shadow-[0_0_10px_rgba(240,185,11,0.1)]"
                        : "border-white/10 text-gray-500 hover:border-white/20 hover:text-gray-300"
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
                className="group relative py-5 rounded-2xl bg-gradient-to-br from-green-500 to-green-600 text-white font-bold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-500/20 hover:shadow-green-500/40 hover:scale-[1.02] active:scale-[0.98] overflow-hidden"
              >
                <div className="absolute inset-0 shimmer-btn" />
                <span className="relative">
                  <span className="text-3xl block mb-1">&#9650;</span>
                  <span className="text-base">UP</span>
                  {totalPool > BigInt(0) && round.totalUpPool > BigInt(0) && (
                    <span className="block text-xs font-normal mt-1 opacity-80">
                      {((Number(totalPool) * 0.97) / Number(round.totalUpPool)).toFixed(2)}x
                    </span>
                  )}
                </span>
              </button>
              <button
                onClick={() => handleBet(Direction.Down)}
                disabled={isBetting || isConfirming}
                className="group relative py-5 rounded-2xl bg-gradient-to-br from-red-500 to-red-600 text-white font-bold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-red-500/20 hover:shadow-red-500/40 hover:scale-[1.02] active:scale-[0.98] overflow-hidden"
              >
                <div className="absolute inset-0 shimmer-btn" />
                <span className="relative">
                  <span className="text-3xl block mb-1">&#9660;</span>
                  <span className="text-base">DOWN</span>
                  {totalPool > BigInt(0) && round.totalDownPool > BigInt(0) && (
                    <span className="block text-xs font-normal mt-1 opacity-80">
                      {((Number(totalPool) * 0.97) / Number(round.totalDownPool)).toFixed(2)}x
                    </span>
                  )}
                </span>
              </button>
            </div>

            {(isBetting || isConfirming) && (
              <div className="mt-4 text-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#F0B90B]/10 border border-[#F0B90B]/20">
                  <div className="w-2 h-2 rounded-full bg-[#F0B90B] animate-pulse" />
                  <span className="text-sm text-[#F0B90B] font-medium">
                    {isBetting ? "Confirm in wallet..." : "Confirming on-chain..."}
                  </span>
                </div>
              </div>
            )}
            {isConfirmed && (
              <div className="mt-4 text-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-green-500/10 border border-green-500/20">
                  <span className="text-sm text-green-400 font-medium">Bet placed!</span>
                </div>
              </div>
            )}
          </>
        )}

        {isLocked && !isSettled && !hasBet && (
          <div className="text-center py-8">
            <div className="text-4xl mb-3 animate-float">&#128274;</div>
            <p className="text-lg font-bold text-gray-300">Betting Locked</p>
            <p className="text-sm text-gray-500 mt-1">Waiting for round to settle...</p>
          </div>
        )}
      </div>
    </div>
  );
}
