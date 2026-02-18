"use client";

import { useEffect, useState } from "react";
import { formatEther } from "viem";
import { RoundStatus, RoundResult, CHAINLINK_DECIMALS } from "@/lib/constants";

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
  const num = Number(price) / 10 ** CHAINLINK_DECIMALS;
  return num.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function getStatusLabel(status: number): { text: string; color: string } {
  switch (status) {
    case RoundStatus.Open:
      return { text: "OPEN", color: "bg-green-500" };
    case RoundStatus.Locked:
      return { text: "LOCKED", color: "bg-yellow-500" };
    case RoundStatus.Settled:
      return { text: "SETTLED", color: "bg-gray-500" };
    default:
      return { text: "NONE", color: "bg-gray-700" };
  }
}

function getResultLabel(result: number): { text: string; color: string } {
  switch (result) {
    case RoundResult.Up:
      return { text: "UP", color: "text-green-400" };
    case RoundResult.Down:
      return { text: "DOWN", color: "text-red-400" };
    case RoundResult.Tie:
      return { text: "TIE", color: "text-yellow-400" };
    default:
      return { text: "PENDING", color: "text-gray-400" };
  }
}

export function RoundInfo({ round }: { round: Round | null }) {
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (!round || round.status === RoundStatus.Settled || round.status === RoundStatus.None) return;

    const interval = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      const end = Number(round.endTime);
      setTimeLeft(Math.max(0, end - now));
    }, 1000);

    return () => clearInterval(interval);
  }, [round]);

  if (!round || Number(round.roundId) === 0) {
    return (
      <div className="glass-panel p-6 text-center">
        <p className="text-gray-400">No active round. Waiting for admin to start...</p>
      </div>
    );
  }

  const status = getStatusLabel(round.status);
  const totalPool = round.totalUpPool + round.totalDownPool;
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  const lockTimeLeft = Math.max(0, Number(round.lockTime) - Math.floor(Date.now() / 1000));
  const isLocked = lockTimeLeft <= 0 && round.status !== RoundStatus.Settled;

  return (
    <div className="glass-panel p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold">Round #{Number(round.roundId)}</h2>
          <span className={`${status.color} text-xs font-bold px-2 py-1 rounded-full text-black`}>
            {status.text}
          </span>
        </div>
        {round.status !== RoundStatus.Settled && round.status !== RoundStatus.None && (
          <div className="text-right">
            <div className="text-2xl font-mono font-bold text-[#F0B90B]">
              {minutes}:{seconds.toString().padStart(2, "0")}
            </div>
            <div className="text-xs text-gray-400">
              {isLocked ? "Round ends in" : "Betting locks in"}
            </div>
          </div>
        )}
      </div>

      {/* Progress bar */}
      {round.status !== RoundStatus.Settled && round.status !== RoundStatus.None && (
        <div className="w-full h-2 bg-gray-800 rounded-full mb-4 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{
              width: `${Math.max(0, (1 - timeLeft / Number(round.endTime - round.startTime)) * 100)}%`,
              background: isLocked
                ? "linear-gradient(90deg, #F0B90B, #ef4444)"
                : "linear-gradient(90deg, #22c55e, #F0B90B)",
            }}
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-gray-400">Start Price</p>
          <p className="text-lg font-mono font-semibold">{formatPrice(round.startPrice)}</p>
        </div>
        {round.status === RoundStatus.Settled && (
          <div>
            <p className="text-xs text-gray-400">End Price</p>
            <p className="text-lg font-mono font-semibold">{formatPrice(round.endPrice)}</p>
          </div>
        )}
        <div>
          <p className="text-xs text-gray-400">Total Pool</p>
          <p className="text-lg font-mono font-semibold">
            {parseFloat(formatEther(totalPool)).toFixed(4)} tBNB
          </p>
        </div>
        {round.status === RoundStatus.Settled && (
          <div>
            <p className="text-xs text-gray-400">Result</p>
            <p className={`text-lg font-bold ${getResultLabel(round.result).color}`}>
              {getResultLabel(round.result).text}
            </p>
          </div>
        )}
      </div>

      {/* Pool distribution bar */}
      {totalPool > BigInt(0) && (
        <div className="mt-4">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>UP: {parseFloat(formatEther(round.totalUpPool)).toFixed(4)}</span>
            <span>DOWN: {parseFloat(formatEther(round.totalDownPool)).toFixed(4)}</span>
          </div>
          <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden flex">
            <div
              className="h-full bg-green-500 transition-all"
              style={{
                width: `${(Number(round.totalUpPool) / Number(totalPool)) * 100}%`,
              }}
            />
            <div
              className="h-full bg-red-500 transition-all"
              style={{
                width: `${(Number(round.totalDownPool) / Number(totalPool)) * 100}%`,
              }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>
              {round.totalUpPool > BigInt(0)
                ? `${(Number(totalPool) / Number(round.totalUpPool)).toFixed(2)}x`
                : "-"}
            </span>
            <span>
              {round.totalDownPool > BigInt(0)
                ? `${(Number(totalPool) / Number(round.totalDownPool)).toFixed(2)}x`
                : "-"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
