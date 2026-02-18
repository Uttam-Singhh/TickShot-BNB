"use client";

import { formatEther } from "viem";
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useAccount } from "wagmi";
import { TICKSHOT_ABI } from "@/lib/abi";
import { CONTRACT_ADDRESS, RoundResult, CHAINLINK_DECIMALS } from "@/lib/constants";

function formatPrice(price: bigint): string {
  return (Number(price) / 10 ** CHAINLINK_DECIMALS).toFixed(2);
}

function getResultBadge(result: number) {
  switch (result) {
    case RoundResult.Up:
      return <span className="text-green-400 font-bold">UP</span>;
    case RoundResult.Down:
      return <span className="text-red-400 font-bold">DOWN</span>;
    case RoundResult.Tie:
      return <span className="text-yellow-400 font-bold">TIE</span>;
    default:
      return <span className="text-gray-400">-</span>;
  }
}

function HistoryRow({ roundId }: { roundId: number }) {
  const { address } = useAccount();

  const { data: round } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: TICKSHOT_ABI,
    functionName: "getRound",
    args: [BigInt(roundId)],
  });

  const { data: userBet } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: TICKSHOT_ABI,
    functionName: "getUserBet",
    args: address ? [BigInt(roundId), address] : undefined,
  });

  const { writeContract: claim, data: claimHash, isPending } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash: claimHash });

  if (!round || Number(round.roundId) === 0) return null;
  if (round.status !== 3) return null; // only show settled

  const hasBet = userBet && userBet.amount > BigInt(0);
  const isWinner =
    hasBet &&
    ((round.result === RoundResult.Up && userBet.direction === 0) ||
      (round.result === RoundResult.Down && userBet.direction === 1) ||
      round.result === RoundResult.Tie);
  const canClaim = hasBet && isWinner && !userBet.claimed;

  return (
    <tr className="border-b border-white/5 hover:bg-white/[0.02] transition">
      <td className="py-2 px-3 text-gray-400">#{roundId}</td>
      <td className="py-2 px-3">{getResultBadge(round.result)}</td>
      <td className="py-2 px-3 font-mono text-sm">${formatPrice(round.startPrice)}</td>
      <td className="py-2 px-3 font-mono text-sm">${formatPrice(round.endPrice)}</td>
      <td className="py-2 px-3 font-mono text-sm">
        {parseFloat(formatEther(round.totalUpPool + round.totalDownPool)).toFixed(4)}
      </td>
      <td className="py-2 px-3">
        {hasBet ? (
          <span className={userBet.direction === 0 ? "text-green-400" : "text-red-400"}>
            {userBet.direction === 0 ? "UP" : "DOWN"}{" "}
            {parseFloat(formatEther(userBet.amount)).toFixed(4)}
          </span>
        ) : (
          <span className="text-gray-600">-</span>
        )}
      </td>
      <td className="py-2 px-3">
        {canClaim ? (
          <button
            onClick={() =>
              claim({
                address: CONTRACT_ADDRESS,
                abi: TICKSHOT_ABI,
                functionName: "claimWinnings",
                args: [BigInt(roundId)],
              })
            }
            disabled={isPending || isConfirming}
            className="text-xs px-3 py-1 rounded-lg bg-[#F0B90B] text-black font-bold hover:bg-[#FCD535] transition disabled:opacity-50"
          >
            {isPending || isConfirming ? "..." : "Claim"}
          </button>
        ) : hasBet && userBet.claimed ? (
          <span className="text-xs text-green-400">Claimed</span>
        ) : null}
      </td>
    </tr>
  );
}

export function RoundHistory({ currentRoundId }: { currentRoundId: number }) {
  if (currentRoundId <= 0) return null;

  // Show last 10 settled rounds (all rounds before current, which may be active)
  const roundIds: number[] = [];
  for (let i = currentRoundId; i >= Math.max(1, currentRoundId - 9); i--) {
    roundIds.push(i);
  }

  return (
    <div className="glass-panel p-6">
      <h2 className="text-lg font-bold mb-4">Round History</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-500 text-xs border-b border-white/10">
              <th className="py-2 px-3 text-left">Round</th>
              <th className="py-2 px-3 text-left">Result</th>
              <th className="py-2 px-3 text-left">Open</th>
              <th className="py-2 px-3 text-left">Close</th>
              <th className="py-2 px-3 text-left">Pool</th>
              <th className="py-2 px-3 text-left">Your Bet</th>
              <th className="py-2 px-3 text-left"></th>
            </tr>
          </thead>
          <tbody>
            {roundIds.map((id) => (
              <HistoryRow key={id} roundId={id} />
            ))}
          </tbody>
        </table>
        {roundIds.length === 0 && (
          <p className="text-gray-500 text-center py-4">No rounds yet</p>
        )}
      </div>
    </div>
  );
}
