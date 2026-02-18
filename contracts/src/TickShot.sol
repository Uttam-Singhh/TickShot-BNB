// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract TickShot is ReentrancyGuard {
    // ── Enums ──────────────────────────────────────────────────────────
    enum Direction { Up, Down }
    enum RoundStatus { None, Open, Locked, Settled }
    enum RoundResult { Pending, Up, Down, Tie }

    // ── Structs ────────────────────────────────────────────────────────
    struct Round {
        uint256 roundId;
        RoundStatus status;
        RoundResult result;
        int256 startPrice;
        int256 endPrice;
        uint256 startTime;
        uint256 lockTime;
        uint256 endTime;
        uint256 totalUpPool;
        uint256 totalDownPool;
    }

    struct Bet {
        Direction direction;
        uint256 amount;
        bool claimed;
    }

    // ── Constants ──────────────────────────────────────────────────────
    uint256 public constant ROUND_DURATION = 120;  // 2 minutes
    uint256 public constant LOCK_DURATION = 96;    // 80% betting window
    uint256 public constant MIN_BET = 0.001 ether;
    uint256 public constant FEE_BPS = 300;         // 3%
    uint256 public constant ORACLE_STALENESS = 3600; // 1 hour (testnet feeds update slowly)

    // ── State ──────────────────────────────────────────────────────────
    address public admin;
    AggregatorV3Interface public oracle;
    uint256 public currentRoundId;
    uint256 public accumulatedFees;

    mapping(uint256 => Round) public rounds;
    mapping(uint256 => mapping(address => Bet)) public bets;

    // ── Events ─────────────────────────────────────────────────────────
    event RoundStarted(uint256 indexed roundId, int256 startPrice, uint256 startTime, uint256 lockTime, uint256 endTime);
    event BetPlaced(uint256 indexed roundId, address indexed user, Direction direction, uint256 amount);
    event RoundResolved(uint256 indexed roundId, RoundResult result, int256 endPrice);
    event WinningsClaimed(uint256 indexed roundId, address indexed user, uint256 payout);
    event FeesWithdrawn(address indexed admin, uint256 amount);

    // ── Modifiers ──────────────────────────────────────────────────────
    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }

    // ── Constructor ────────────────────────────────────────────────────
    constructor(address _oracle) {
        admin = msg.sender;
        oracle = AggregatorV3Interface(_oracle);
    }

    // ── Admin Functions ────────────────────────────────────────────────

    function startRound() external onlyAdmin {
        // If there's a previous round, it must be settled
        if (currentRoundId > 0) {
            require(
                rounds[currentRoundId].status == RoundStatus.Settled,
                "Previous round not settled"
            );
        }

        currentRoundId++;
        int256 price = _getLatestPrice();

        uint256 startTime = block.timestamp;
        uint256 lockTime = startTime + LOCK_DURATION;
        uint256 endTime = startTime + ROUND_DURATION;

        rounds[currentRoundId] = Round({
            roundId: currentRoundId,
            status: RoundStatus.Open,
            result: RoundResult.Pending,
            startPrice: price,
            endPrice: 0,
            startTime: startTime,
            lockTime: lockTime,
            endTime: endTime,
            totalUpPool: 0,
            totalDownPool: 0
        });

        emit RoundStarted(currentRoundId, price, startTime, lockTime, endTime);
    }

    function resolveRound(uint256 _roundId) external onlyAdmin {
        Round storage round = rounds[_roundId];
        require(round.status == RoundStatus.Open || round.status == RoundStatus.Locked, "Round not active");
        require(block.timestamp >= round.endTime, "Round not ended");

        int256 endPrice = _getLatestPrice();
        round.endPrice = endPrice;
        round.status = RoundStatus.Settled;

        if (endPrice > round.startPrice) {
            round.result = RoundResult.Up;
        } else if (endPrice < round.startPrice) {
            round.result = RoundResult.Down;
        } else {
            round.result = RoundResult.Tie;
        }

        // Calculate fees only when there are winners and losers
        uint256 totalPool = round.totalUpPool + round.totalDownPool;
        if (totalPool > 0 && round.result != RoundResult.Tie) {
            uint256 winningPool = round.result == RoundResult.Up
                ? round.totalUpPool
                : round.totalDownPool;

            if (winningPool > 0 && winningPool < totalPool) {
                // There are both winners and losers — take fee
                uint256 fee = (totalPool * FEE_BPS) / 10000;
                accumulatedFees += fee;
            }
            // If winningPool == 0 or winningPool == totalPool, no fee (refund scenario)
        }

        emit RoundResolved(_roundId, round.result, endPrice);
    }

    function withdrawFees() external onlyAdmin nonReentrant {
        uint256 amount = accumulatedFees;
        require(amount > 0, "No fees");
        accumulatedFees = 0;

        (bool success, ) = payable(admin).call{value: amount}("");
        require(success, "Transfer failed");

        emit FeesWithdrawn(admin, amount);
    }

    // ── User Functions ─────────────────────────────────────────────────

    function placeBet(uint256 _roundId, Direction _direction) external payable {
        Round storage round = rounds[_roundId];
        require(round.status == RoundStatus.Open || round.status == RoundStatus.Locked, "Round not active");
        require(block.timestamp < round.lockTime, "Betting locked");
        require(msg.value >= MIN_BET, "Below min bet");
        require(bets[_roundId][msg.sender].amount == 0, "Already bet");

        // Auto-lock the round if we've passed lockTime
        if (block.timestamp >= round.lockTime && round.status == RoundStatus.Open) {
            round.status = RoundStatus.Locked;
        }

        bets[_roundId][msg.sender] = Bet({
            direction: _direction,
            amount: msg.value,
            claimed: false
        });

        if (_direction == Direction.Up) {
            round.totalUpPool += msg.value;
        } else {
            round.totalDownPool += msg.value;
        }

        emit BetPlaced(_roundId, msg.sender, _direction, msg.value);
    }

    function claimWinnings(uint256 _roundId) external nonReentrant {
        Round storage round = rounds[_roundId];
        require(round.status == RoundStatus.Settled, "Round not settled");

        Bet storage bet = bets[_roundId][msg.sender];
        require(bet.amount > 0, "No bet placed");
        require(!bet.claimed, "Already claimed");

        bet.claimed = true;

        uint256 payout = _calculatePayout(round, bet);
        require(payout > 0, "No winnings");

        (bool success, ) = payable(msg.sender).call{value: payout}("");
        require(success, "Transfer failed");

        emit WinningsClaimed(_roundId, msg.sender, payout);
    }

    // ── View Functions ─────────────────────────────────────────────────

    function getRound(uint256 _roundId) external view returns (Round memory) {
        return rounds[_roundId];
    }

    function getUserBet(uint256 _roundId, address _user) external view returns (Bet memory) {
        return bets[_roundId][_user];
    }

    function getCurrentRound() external view returns (Round memory) {
        return rounds[currentRoundId];
    }

    // ── Internal Functions ─────────────────────────────────────────────

    function _getLatestPrice() internal view returns (int256) {
        (
            ,
            int256 price,
            ,
            uint256 updatedAt,
        ) = oracle.latestRoundData();
        require(price > 0, "Invalid price");
        require(block.timestamp - updatedAt <= ORACLE_STALENESS, "Stale price");
        return price;
    }

    function _calculatePayout(Round storage round, Bet storage bet) internal view returns (uint256) {
        uint256 totalPool = round.totalUpPool + round.totalDownPool;

        // Tie: full refund
        if (round.result == RoundResult.Tie) {
            return bet.amount;
        }

        bool isWinner = (round.result == RoundResult.Up && bet.direction == Direction.Up)
            || (round.result == RoundResult.Down && bet.direction == Direction.Down);

        if (!isWinner) {
            return 0;
        }

        uint256 winningPool = round.result == RoundResult.Up
            ? round.totalUpPool
            : round.totalDownPool;

        // No losers: refund winners
        if (winningPool == totalPool) {
            return bet.amount;
        }

        // Normal case: proportional payout from pool after fee
        uint256 fee = (totalPool * FEE_BPS) / 10000;
        uint256 poolAfterFee = totalPool - fee;
        return (bet.amount * poolAfterFee) / winningPool;
    }

    // Allow contract to receive BNB
    receive() external payable {}
}
