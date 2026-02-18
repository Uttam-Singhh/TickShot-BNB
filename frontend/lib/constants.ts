export const CONTRACT_ADDRESS: `0x${string}` =
  (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`) ??
  "0x3aa9A5AB43A30D0Fc811cf3A39DC71EC80c90b56";

export const ROUND_DURATION = 120; // seconds
export const LOCK_DURATION = 96;
export const MIN_BET = 0.001; // tBNB

export const BINANCE_KLINE_URL =
  "https://api.binance.com/api/v3/klines?symbol=BNBUSDT&interval=1m&limit=100";

export const BINANCE_WS_URL =
  "wss://stream.binance.com:9443/ws/bnbusdt@kline_1m";

// Chainlink BNB/USD on BSC Testnet (8 decimals)
export const CHAINLINK_DECIMALS = 8;

export enum Direction {
  Up = 0,
  Down = 1,
}

export enum RoundStatus {
  None = 0,
  Open = 1,
  Locked = 2,
  Settled = 3,
}

export enum RoundResult {
  Pending = 0,
  Up = 1,
  Down = 2,
  Tie = 3,
}
