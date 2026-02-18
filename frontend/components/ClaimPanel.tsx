"use client";

import { formatEther } from "viem";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { TICKSHOT_ABI } from "@/lib/abi";
import { CONTRACT_ADDRESS, RoundResult, Direction, CHAINLINK_DECIMALS } from "@/lib/constants";

function ClaimableRound({ roundId }: { roundId: number }) {
  const { address } = useAccount();

  const { data: round } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: TICKSHOT_ABI,
    functionName: "getRound",
    args: [BigInt(roundId)],
    query: { refetchInterval: 3000 },
  });

  const { data: userBet } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: TICKSHOT_ABI,
    functionName: "getUserBet",
    args: address ? [BigInt(roundId), address] : undefined,
    query: { refetchInterval: 3000 },
  });

  const { writeContract: claim, data: claimHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isClaimed } = useWaitForTransactionReceipt({
    hash: claimHash,
  });

  if (!round || round.status !== 3) return null; // not settled
  if (!userBet || userBet.amount === BigInt(0)) return null; // no bet
  if (userBet.claimed || isClaimed) return null; // already claimed

  const isWinner =
    (round.result === RoundResult.Up && userBet.direction === Direction.Up) ||
    (round.result === RoundResult.Down && userBet.direction === Direction.Down) ||
    round.result === RoundResult.Tie;

  if (!isWinner) return null;

  // Estimate payout
  const totalPool = round.totalUpPool + round.totalDownPool;
  let payout = "0";
  if (round.result === RoundResult.Tie) {
    payout = parseFloat(formatEther(userBet.amount)).toFixed(4);
  } else {
    const winningPool =
      round.result === RoundResult.Up ? round.totalUpPool : round.totalDownPool;
    if (winningPool > BigInt(0) && winningPool < totalPool) {
      const fee = (totalPool * BigInt(300)) / BigInt(10000);
      const poolAfterFee = totalPool - fee;
      const est = (userBet.amount * poolAfterFee) / winningPool;
      payout = parseFloat(formatEther(est)).toFixed(4);
    } else {
      payout = parseFloat(formatEther(userBet.amount)).toFixed(4);
    }
  }

  const resultLabel =
    round.result === RoundResult.Up ? "UP" : round.result === RoundResult.Down ? "DOWN" : "TIE";
  const resultColor =
    round.result === RoundResult.Up
      ? "text-green-400"
      : round.result === RoundResult.Down
      ? "text-red-400"
      : "text-yellow-400";

  const openPrice = (Number(round.startPrice) / 10 ** CHAINLINK_DECIMALS).toFixed(2);
  const closePrice = (Number(round.endPrice) / 10 ** CHAINLINK_DECIMALS).toFixed(2);

  return (
    <div className="glass-panel overflow-hidden border-[#F0B90B]/30 glow-bnb animate-slide-in">
      <div className="px-6 py-3 border-b border-white/5 bg-gradient-to-r from-[#F0B90B]/10 to-transparent flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">&#127942;</span>
          <span className="font-bold text-white">You Won!</span>
        </div>
        <span className="text-xs text-gray-500">Round #{roundId}</span>
      </div>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-gray-500 mb-1">Result</p>
            <span className={`text-xl font-bold ${resultColor}`}>{resultLabel}</span>
            <p className="text-xs text-gray-500 mt-1 font-mono">
              ${openPrice} &rarr; ${closePrice}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500 mb-1">Your Payout</p>
            <p className="text-2xl font-mono font-black text-[#F0B90B]">{payout}</p>
            <p className="text-xs text-gray-500">tBNB</p>
          </div>
        </div>
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
          className="w-full py-4 rounded-xl bg-gradient-to-r from-[#F0B90B] to-[#FCD535] text-black font-bold text-lg hover:opacity-90 transition disabled:opacity-50 shadow-lg shadow-[#F0B90B]/20"
        >
          {isPending
            ? "Confirm in wallet..."
            : isConfirming
            ? "Claiming..."
            : "Claim Winnings"}
        </button>
      </div>
    </div>
  );
}

export function ClaimPanel({ currentRoundId }: { currentRoundId: number }) {
  if (currentRoundId <= 0) return null;

  // Check the last 10 rounds for unclaimed winnings
  const roundIds: number[] = [];
  for (let i = currentRoundId; i >= Math.max(1, currentRoundId - 9); i--) {
    roundIds.push(i);
  }

  return (
    <>
      {roundIds.map((id) => (
        <ClaimableRound key={id} roundId={id} />
      ))}
    </>
  );
}
