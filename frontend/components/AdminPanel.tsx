"use client";

import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { TICKSHOT_ABI } from "@/lib/abi";
import { CONTRACT_ADDRESS, RoundStatus } from "@/lib/constants";

interface Round {
  roundId: bigint;
  status: number;
  endTime: bigint;
}

interface AdminPanelProps {
  round: Round | null;
  isAdmin: boolean;
}

export function AdminPanel({ round, isAdmin }: AdminPanelProps) {
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

  return (
    <div className="glass-panel p-6 border-[#F0B90B]/30">
      <h2 className="text-lg font-bold mb-4 text-[#F0B90B]">Admin Panel</h2>
      <div className="flex gap-3">
        <button
          onClick={() =>
            startRound({
              address: CONTRACT_ADDRESS,
              abi: TICKSHOT_ABI,
              functionName: "startRound",
            })
          }
          disabled={!canStart || isStarting || isStartConfirming}
          className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#F0B90B] to-[#FCD535] text-black font-bold hover:opacity-90 transition disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {isStarting || isStartConfirming ? "Starting..." : "Start Round"}
        </button>
        <button
          onClick={() => {
            if (!round) return;
            resolveRound({
              address: CONTRACT_ADDRESS,
              abi: TICKSHOT_ABI,
              functionName: "resolveRound",
              args: [round.roundId],
            });
          }}
          disabled={!canResolve || isResolving || isResolveConfirming}
          className="flex-1 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 text-white font-bold hover:opacity-90 transition disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {isResolving || isResolveConfirming ? "Resolving..." : "Resolve Round"}
        </button>
      </div>
    </div>
  );
}
