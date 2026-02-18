# TickShot BNB

Parimutuel betting game on BNB/USD price direction. 2-minute rounds, winners split the pool proportionally. Built on BSC Testnet with Chainlink oracle.

## Live App

**[https://tick-shot-bnb.vercel.app](https://tick-shot-bnb.vercel.app)**

## Onchain Proof (BSC Testnet)

| Item | Value |
|------|-------|
| **Contract Address** | [`0x3aa9A5AB43A30D0Fc811cf3A39DC71EC80c90b56`](https://testnet.bscscan.com/address/0x3aa9A5AB43A30D0Fc811cf3A39DC71EC80c90b56) |
| **Deploy Tx** | [`0x0d5f543f...`](https://testnet.bscscan.com/tx/0x0d5f543faae6370dda9bbbb288a3f8ca5ee00287a0a96a9e709d14f8a9f2523f) |
| **Chain** | BSC Testnet (Chain ID 97) |
| **Chainlink Oracle** | [`0x2514895c72f50D8bd4B4F9b1110F0D6bD2c97526`](https://testnet.bscscan.com/address/0x2514895c72f50D8bd4B4F9b1110F0D6bD2c97526) (BNB/USD) |

## How It Works

1. Admin starts a 2-minute round, locking the current BNB/USD price from Chainlink
2. Users bet UP or DOWN on whether price will be higher or lower at round end (betting window: first 96 seconds)
3. After 2 minutes, admin resolves the round with the new Chainlink price
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
forge test -vvv  # All 20 tests should pass
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
| `startRound()` | Admin | Start a new 2-min round with Chainlink start price |
| `placeBet(roundId, direction)` | Anyone (payable) | Bet tBNB on UP (0) or DOWN (1) |
| `resolveRound(roundId)` | Admin | Settle round with Chainlink end price |
| `claimWinnings(roundId)` | Anyone | Claim proportional payout if winner |
| `withdrawFees()` | Admin | Withdraw accumulated 3% fees |

## Project Structure

```
TickShot-BNB/
├── contracts/               # Foundry project
│   ├── src/TickShot.sol     # Core game contract
│   ├── test/TickShot.t.sol  # 20 test cases + mock oracle
│   ├── script/Deploy.s.sol  # BSC Testnet deploy script
│   └── run-rounds.sh       # Auto round runner
├── frontend/                # Next.js 14
│   ├── app/                 # App Router pages + providers
│   ├── components/          # GameBoard, PriceChart, BettingPanel, etc.
│   └── lib/                 # wagmi config, ABI, constants
├── .env.example
└── README.md
```
