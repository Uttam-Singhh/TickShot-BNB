"use client";

import { useEffect, useState } from "react";
import { formatEther } from "viem";
import { RoundStatus, RoundResult, CHAINLINK_DECIMALS, ROUND_DURATION } from "@/lib/constants";

interface Round {
  roundId: bigint;
  status: number;
  result: number;
  startPrice: bigint;
  endPrice: bigint;
  startTime: bigint;
  lockTime: bigint;
  endTime: bigint;
  totalUpPool: bigint;
  totalDownPool: bigint;
}

function formatPrice(price: bigint): string {
  return (Number(price) / 10 ** CHAINLINK_DECIMALS).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

// SVG circular timer
function CircularTimer({ timeLeft, total, isUrgent }: { timeLeft: number; total: number; isUrgent: boolean }) {
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const progress = timeLeft / total;
  const dashOffset = circumference * (1 - progress);
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  const strokeColor = isUrgent
    ? timeLeft <= 10
      ? "#ef4444"
      : "#F0B90B"
    : "#22c55e";

  return (
    <div className="relative flex items-center justify-center">
      <svg width="140" height="140" viewBox="0 0 140 140" className="timer-ring">
        {/* Background ring */}
        <circle
          cx="70" cy="70" r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="6"
        />
        {/* Progress ring */}
        <circle
          cx="70" cy="70" r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ filter: `drop-shadow(0 0 8px ${strokeColor}80)` }}
        />
        {/* Urgency outer glow ring */}
        {timeLeft <= 15 && (
          <circle
            cx="70" cy="70" r={radius + 4}
            fill="none"
            stroke={strokeColor}
            strokeWidth="1"
            opacity="0.3"
            className="animate-ring"
          />
        )}
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={`text-4xl font-mono font-black tracking-tight ${
            timeLeft <= 10 ? "animate-countdown-urgent" : "animate-countdown"
          }`}
        >
          {minutes}:{seconds.toString().padStart(2, "0")}
        </span>
        <span className={`text-[10px] uppercase tracking-widest mt-1 ${
          timeLeft <= 15 ? "text-red-400 animate-urgency" : "text-gray-500"
        }`}>
          {timeLeft <= 15 ? "HURRY!" : isUrgent ? "Ending" : "Betting Open"}
        </span>
      </div>
    </div>
  );
}

export function RoundInfo({ round }: { round: Round | null }) {
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (!round || round.status === RoundStatus.Settled || round.status === RoundStatus.None) return;

    const tick = () => {
      const now = Math.floor(Date.now() / 1000);
      const end = Number(round.endTime);
      setTimeLeft(Math.max(0, end - now));
    };
    tick();
    const interval = setInterval(tick, 200); // smoother updates

    return () => clearInterval(interval);
  }, [round]);

  if (!round || Number(round.roundId) === 0) {
    return (
      <div className="glass-panel p-10 text-center animate-slide-in">
        <div className="animate-float">
          <div className="text-5xl mb-4">&#9201;</div>
          <p className="text-gray-400 text-lg">Waiting for next round...</p>
          <p className="text-gray-600 text-sm mt-2">The admin will start a new round shortly</p>
        </div>
      </div>
    );
  }

  const totalPool = round.totalUpPool + round.totalDownPool;
  const now = Math.floor(Date.now() / 1000);
  const isLocked = now >= Number(round.lockTime) && round.status !== RoundStatus.Settled;
  const isActive = round.status !== RoundStatus.Settled && round.status !== RoundStatus.None;

  return (
    <div className={`glass-panel overflow-hidden animate-slide-in ${
      isActive && timeLeft <= 15 ? "border-red-500/30" : isActive ? "border-[#F0B90B]/20 glow-bnb" : ""
    }`}>
      {/* Top bar with round info */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/5 bg-white/[0.02]">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-white">Round #{Number(round.roundId)}</span>
          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
            round.status === RoundStatus.Open ? "bg-green-500/20 text-green-400 border border-green-500/30" :
            round.status === RoundStatus.Locked ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30" :
            round.status === RoundStatus.Settled ? "bg-gray-500/20 text-gray-400 border border-gray-500/30" :
            "bg-gray-700/20 text-gray-500"
          }`}>
            {round.status === RoundStatus.Open ? "OPEN" :
             round.status === RoundStatus.Locked ? "LOCKED" :
             round.status === RoundStatus.Settled ? "SETTLED" : "NONE"}
          </span>
        </div>
        <div className="text-right">
          <span className="text-xs text-gray-500">Pool</span>
          <p className="text-sm font-mono font-bold text-[#F0B90B]">
            {parseFloat(formatEther(totalPool)).toFixed(4)} tBNB
          </p>
        </div>
      </div>

      <div className="p-6">
        {/* Timer + Prices layout */}
        <div className="flex items-center justify-between gap-6">
          {/* Circular Timer */}
          {isActive && (
            <div className="flex-shrink-0">
              <CircularTimer timeLeft={timeLeft} total={ROUND_DURATION} isUrgent={isLocked} />
            </div>
          )}

          {/* Prices + Pool */}
          <div className="flex-1 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Open Price</p>
                <p className="text-lg font-mono font-bold">{formatPrice(round.startPrice)}</p>
              </div>
              {round.status === RoundStatus.Settled ? (
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Close Price</p>
                  <p className={`text-lg font-mono font-bold ${
                    round.endPrice > round.startPrice ? "text-green-400" :
                    round.endPrice < round.startPrice ? "text-red-400" : "text-yellow-400"
                  }`}>
                    {formatPrice(round.endPrice)}
                  </p>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 border-dashed">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Close Price</p>
                  <p className="text-lg font-mono font-bold text-gray-600">???</p>
                </div>
              )}
            </div>

            {/* Result badge */}
            {round.status === RoundStatus.Settled && (
              <div className={`text-center p-3 rounded-xl font-bold text-lg ${
                round.result === RoundResult.Up ? "bg-green-500/10 text-green-400 border border-green-500/20" :
                round.result === RoundResult.Down ? "bg-red-500/10 text-red-400 border border-red-500/20" :
                "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
              }`}>
                {round.result === RoundResult.Up ? "PRICE WENT UP" :
                 round.result === RoundResult.Down ? "PRICE WENT DOWN" : "TIE - REFUND ALL"}
              </div>
            )}
          </div>
        </div>

        {/* Pool distribution bar */}
        {totalPool > BigInt(0) && (
          <div className="mt-5">
            <div className="flex justify-between text-xs mb-2">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-green-400 font-medium">UP</span>
                <span className="text-gray-500 font-mono">{parseFloat(formatEther(round.totalUpPool)).toFixed(4)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-gray-500 font-mono">{parseFloat(formatEther(round.totalDownPool)).toFixed(4)}</span>
                <span className="text-red-400 font-medium">DOWN</span>
                <div className="w-2 h-2 rounded-full bg-red-500" />
              </div>
            </div>
            <div className="w-full h-4 bg-gray-800/50 rounded-full overflow-hidden flex relative">
              <div
                className="h-full bg-gradient-to-r from-green-600 to-green-400 transition-all duration-500 rounded-l-full"
                style={{ width: `${(Number(round.totalUpPool) / Number(totalPool)) * 100}%` }}
              />
              <div
                className="h-full bg-gradient-to-r from-red-400 to-red-600 transition-all duration-500 rounded-r-full"
                style={{ width: `${(Number(round.totalDownPool) / Number(totalPool)) * 100}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-gray-600 mt-1 font-mono">
              <span>
                {round.totalUpPool > BigInt(0)
                  ? `${(Number(totalPool) / Number(round.totalUpPool)).toFixed(2)}x payout`
                  : "-"}
              </span>
              <span>
                {round.totalDownPool > BigInt(0)
                  ? `${(Number(totalPool) / Number(round.totalDownPool)).toFixed(2)}x payout`
                  : "-"}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
