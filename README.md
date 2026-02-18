# TickShot BNB

Parimutuel betting game on BNB/USD price direction. 2-minute rounds, winners split the pool proportionally. Built on BSC Testnet with Chainlink oracle.

## Live App

**[https://tick-shot-bnb.vercel.app](https://tick-shot-bnb.vercel.app)**

## Onchain Proof (BSC Testnet)

| Item | Value |
|------|-------|
| **Contract Address** | [`0x70474c100F6B82e8Def7Fa2797863b9af62C9467`](https://testnet.bscscan.com/address/0x70474c100F6B82e8Def7Fa2797863b9af62C9467) |
| **Deploy Tx** | [`0x2270daef...`](https://testnet.bscscan.com/tx/0x2270daef53f947cb2307417cb9168a8a13b074a6353cfea2efead251c2f85c71) |
| **Chain** | BSC Testnet (Chain ID 97) |
| **Price Feed** | Binance BNB/USDT API (real-time) + Chainlink BNB/USD (fallback) |

## How It Works

1. Admin starts a 2-minute round, locking the current BNB/USD price (from Binance real-time feed)
2. Users bet UP or DOWN on whether price will be higher or lower at round end (betting window: first 96 seconds)
3. After 2 minutes, admin resolves the round with the latest Binance price
4. Winners split the total pool proportionally (minus 3% platform fee)
5. Ties or single-side bets result in full refunds

## Steps to Reproduce

### Prerequisites
- [Foundry](https://book.getfoundry.sh/getting-started/installation) installed
- [Node.js](https://nodejs.org/) 18+
- MetaMask with BSC Testnet configured
- tBNB from [BSC Testnet Faucet](https://www.bnbchain.org/en/testnet-faucet)

### 1. Clone & Install

```bash
git clone https://github.com/Uttam-Singhh/TickShot-BNB.git
cd TickShot-BNB
```

### 2. Smart Contract

```bash
cd contracts
forge install
forge build
forge test -vvv  # All 27 tests should pass
```

### 3. Deploy to BSC Testnet

```bash
cp ../.env.example .env
# Edit .env with your PRIVATE_KEY and BSC_TESTNET_RPC
forge script script/Deploy.s.sol --rpc-url $BSC_TESTNET_RPC --broadcast --legacy
```

### 4. Frontend

```bash
cd ../frontend
npm install
# Update NEXT_PUBLIC_CONTRACT_ADDRESS in lib/constants.ts with your deployed address
npm run dev
# Open http://localhost:3000
```

### 5. Run Rounds (Admin)

```bash
cd ../contracts
# Edit run-rounds.sh with your contract address
bash run-rounds.sh
```

Or use the Admin Panel in the frontend (visible only to the deployer wallet).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contract | Solidity 0.8.20 + Foundry |
| Oracle | Chainlink BNB/USD Price Feed |
| Frontend | Next.js 14 + TypeScript + Tailwind CSS |
| Wallet | wagmi v2 + RainbowKit + viem |
| Chart | TradingView Lightweight Charts + Binance WebSocket |
| Chain | BSC Testnet (Chain ID 97) |

## Contract Functions

| Function | Access | Description |
|----------|--------|-------------|
| `startRound()` | Admin | Start round with Chainlink price |
| `startRoundWithPrice(price)` | Admin | Start round with admin-submitted price (Binance) |
| `placeBet(roundId, direction)` | Anyone (payable) | Bet tBNB on UP (0) or DOWN (1) |
| `resolveRound(roundId)` | Admin | Settle round with Chainlink price |
| `resolveRoundWithPrice(roundId, price)` | Admin | Settle round with admin-submitted price |
| `claimWinnings(roundId)` | Anyone | Claim proportional payout if winner |
| `withdrawFees()` | Admin | Withdraw accumulated 3% fees |

## Project Structure

```
TickShot-BNB/
├── contracts/               # Foundry project
│   ├── src/TickShot.sol     # Core game contract
│   ├── test/TickShot.t.sol  # 27 test cases + mock oracle
│   ├── script/Deploy.s.sol  # BSC Testnet deploy script
│   └── run-rounds.sh       # Auto round runner
├── frontend/                # Next.js 14
│   ├── app/                 # App Router pages + providers
│   ├── components/          # GameBoard, PriceChart, BettingPanel, etc.
│   └── lib/                 # wagmi config, ABI, constants
├── .env.example
└── README.md
```
