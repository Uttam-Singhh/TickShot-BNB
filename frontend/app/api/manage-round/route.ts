import { NextResponse } from "next/server";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { bscTestnet } from "viem/chains";

const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ??
  "0x70474c100F6B82e8Def7Fa2797863b9af62C9467") as `0x${string}`;

const CHAINLINK_DECIMALS = 8;

const abi = parseAbi([
  "function currentRoundId() view returns (uint256)",
  "function getCurrentRound() view returns ((uint256 roundId, uint8 status, uint8 result, int256 startPrice, int256 endPrice, uint256 startTime, uint256 lockTime, uint256 endTime, uint256 totalUpPool, uint256 totalDownPool))",
  "function startRoundWithPrice(int256 _price)",
  "function resolveRoundWithPrice(uint256 _roundId, int256 _price)",
]);

// RoundStatus enum matches the contract
const RoundStatus = { None: 0, Open: 1, Locked: 2, Settled: 3 } as const;

const publicClient = createPublicClient({
  chain: bscTestnet,
  transport: http(),
});

function getWalletClient() {
  const key = process.env.ADMIN_PRIVATE_KEY;
  if (!key) throw new Error("ADMIN_PRIVATE_KEY not set");
  const account = privateKeyToAccount(`0x${key.replace(/^0x/, "")}`);
  return createWalletClient({
    account,
    chain: bscTestnet,
    transport: http(),
  });
}

async function fetchBinancePrice(): Promise<bigint> {
  const res = await fetch(
    "https://api.binance.com/api/v3/ticker/price?symbol=BNBUSDT",
    { cache: "no-store" }
  );
  const data = await res.json();
  const price = parseFloat(data.price);
  return BigInt(Math.round(price * 10 ** CHAINLINK_DECIMALS));
}

export async function POST() {
  try {
    const wallet = getWalletClient();

    // Read current round state
    const round = await publicClient.readContract({
      address: CONTRACT_ADDRESS,
      abi,
      functionName: "getCurrentRound",
    });

    const roundId = Number(round.roundId);
    const status = round.status;
    const endTime = Number(round.endTime);
    const now = Math.floor(Date.now() / 1000);

    // Case 1: Round is expired → resolve it
    if (
      roundId > 0 &&
      (status === RoundStatus.Open || status === RoundStatus.Locked) &&
      now >= endTime
    ) {
      const price = await fetchBinancePrice();
      const hash = await wallet.writeContract({
        address: CONTRACT_ADDRESS,
        abi,
        functionName: "resolveRoundWithPrice",
        args: [BigInt(roundId), price],
      });
      // Wait for tx confirmation
      await publicClient.waitForTransactionReceipt({ hash });

      // Now start the next round
      const startPrice = await fetchBinancePrice();
      const startHash = await wallet.writeContract({
        address: CONTRACT_ADDRESS,
        abi,
        functionName: "startRoundWithPrice",
        args: [startPrice],
      });
      await publicClient.waitForTransactionReceipt({ hash: startHash });

      return NextResponse.json({
        action: "resolved_and_started",
        resolvedRound: roundId,
        resolveTx: hash,
        startTx: startHash,
      });
    }

    // Case 2: No active round → start one
    if (roundId === 0 || status === RoundStatus.Settled) {
      const price = await fetchBinancePrice();
      const hash = await wallet.writeContract({
        address: CONTRACT_ADDRESS,
        abi,
        functionName: "startRoundWithPrice",
        args: [price],
      });
      await publicClient.waitForTransactionReceipt({ hash });

      return NextResponse.json({
        action: "started",
        startTx: hash,
      });
    }

    // Case 3: Round is active and not expired yet
    return NextResponse.json({
      action: "none",
      roundId,
      status,
      endTime,
      timeLeft: endTime - now,
    });
  } catch (error: unknown) {
    console.error("manage-round error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
