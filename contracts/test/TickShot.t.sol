// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/TickShot.sol";

contract MockAggregatorV3 {
    int256 public price;
    uint256 public updatedAt;

    constructor(int256 _price) {
        price = _price;
        updatedAt = block.timestamp;
    }

    function setPrice(int256 _price) external {
        price = _price;
        updatedAt = block.timestamp;
    }

    function setUpdatedAt(uint256 _updatedAt) external {
        updatedAt = _updatedAt;
    }

    function latestRoundData()
        external
        view
        returns (uint80, int256, uint256, uint256, uint80)
    {
        return (1, price, block.timestamp, updatedAt, 1);
    }

    function decimals() external pure returns (uint8) {
        return 8;
    }
}

contract TickShotTest is Test {
    TickShot public game;
    MockAggregatorV3 public mockOracle;

    address public admin = address(this);
    address public alice = address(0xA11CE);
    address public bob = address(0xB0B);
    address public carol = address(0xCA201);

    int256 constant START_PRICE = 300_00000000; // $300.00 (8 decimals)

    receive() external payable {}

    function setUp() public {
        vm.warp(1000); // set a reasonable starting timestamp
        mockOracle = new MockAggregatorV3(START_PRICE);
        game = new TickShot(address(mockOracle));

        // Fund test users
        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
        vm.deal(carol, 10 ether);
    }

    // ── Test: Start Round ──────────────────────────────────────────────

    function testStartRound() public {
        game.startRound();

        TickShot.Round memory round = game.getRound(1);
        assertEq(round.roundId, 1);
        assertEq(uint8(round.status), uint8(TickShot.RoundStatus.Open));
        assertEq(round.startPrice, START_PRICE);
        assertEq(round.startTime, block.timestamp);
        assertEq(round.lockTime, block.timestamp + 96);
        assertEq(round.endTime, block.timestamp + 120);
        assertEq(game.currentRoundId(), 1);
    }

    function testStartRoundNonAdmin() public {
        vm.prank(alice);
        vm.expectRevert("Not admin");
        game.startRound();
    }

    function testCannotStartWhilePreviousActive() public {
        game.startRound();
        vm.expectRevert("Previous round not settled");
        game.startRound();
    }

    // ── Test: Place Bet ────────────────────────────────────────────────

    function testPlaceBetUp() public {
        game.startRound();

        vm.prank(alice);
        game.placeBet{value: 0.01 ether}(1, TickShot.Direction.Up);

        TickShot.Bet memory bet = game.getUserBet(1, alice);
        assertEq(uint8(bet.direction), uint8(TickShot.Direction.Up));
        assertEq(bet.amount, 0.01 ether);
        assertFalse(bet.claimed);

        TickShot.Round memory round = game.getRound(1);
        assertEq(round.totalUpPool, 0.01 ether);
        assertEq(round.totalDownPool, 0);
    }

    function testPlaceBetDown() public {
        game.startRound();

        vm.prank(bob);
        game.placeBet{value: 0.05 ether}(1, TickShot.Direction.Down);

        TickShot.Bet memory bet = game.getUserBet(1, bob);
        assertEq(uint8(bet.direction), uint8(TickShot.Direction.Down));
        assertEq(bet.amount, 0.05 ether);

        TickShot.Round memory round = game.getRound(1);
        assertEq(round.totalDownPool, 0.05 ether);
    }

    function testPlaceBetAfterLock() public {
        game.startRound();
        vm.warp(block.timestamp + 97); // past lockTime (96s)

        vm.prank(alice);
        vm.expectRevert("Betting locked");
        game.placeBet{value: 0.01 ether}(1, TickShot.Direction.Up);
    }

    function testPlaceBetBelowMin() public {
        game.startRound();

        vm.prank(alice);
        vm.expectRevert("Below min bet");
        game.placeBet{value: 0.0001 ether}(1, TickShot.Direction.Up);
    }

    function testDoubleBet() public {
        game.startRound();

        vm.startPrank(alice);
        game.placeBet{value: 0.01 ether}(1, TickShot.Direction.Up);
        vm.expectRevert("Already bet");
        game.placeBet{value: 0.01 ether}(1, TickShot.Direction.Down);
        vm.stopPrank();
    }

    // ── Test: Resolve Round ────────────────────────────────────────────

    function testResolveRoundUp() public {
        game.startRound();

        vm.prank(alice);
        game.placeBet{value: 0.1 ether}(1, TickShot.Direction.Up);
        vm.prank(bob);
        game.placeBet{value: 0.1 ether}(1, TickShot.Direction.Down);

        // Advance time past round end
        vm.warp(block.timestamp + 121);
        // Price went up
        mockOracle.setPrice(310_00000000);

        game.resolveRound(1);

        TickShot.Round memory round = game.getRound(1);
        assertEq(uint8(round.status), uint8(TickShot.RoundStatus.Settled));
        assertEq(uint8(round.result), uint8(TickShot.RoundResult.Up));
        assertEq(round.endPrice, 310_00000000);
    }

    function testResolveRoundDown() public {
        game.startRound();

        vm.prank(alice);
        game.placeBet{value: 0.1 ether}(1, TickShot.Direction.Up);
        vm.prank(bob);
        game.placeBet{value: 0.1 ether}(1, TickShot.Direction.Down);

        vm.warp(block.timestamp + 121);
        mockOracle.setPrice(290_00000000);

        game.resolveRound(1);

        TickShot.Round memory round = game.getRound(1);
        assertEq(uint8(round.result), uint8(TickShot.RoundResult.Down));
    }

    function testResolveRoundTie() public {
        game.startRound();

        vm.prank(alice);
        game.placeBet{value: 0.1 ether}(1, TickShot.Direction.Up);
        vm.prank(bob);
        game.placeBet{value: 0.1 ether}(1, TickShot.Direction.Down);

        vm.warp(block.timestamp + 121);
        // Price unchanged
        mockOracle.setPrice(START_PRICE);

        game.resolveRound(1);

        TickShot.Round memory round = game.getRound(1);
        assertEq(uint8(round.result), uint8(TickShot.RoundResult.Tie));
    }

    function testResolveBeforeEnd() public {
        game.startRound();
        vm.warp(block.timestamp + 60); // only 60s in

        vm.expectRevert("Round not ended");
        game.resolveRound(1);
    }

    // ── Test: Claim Winnings ───────────────────────────────────────────

    function testClaimWinnings() public {
        game.startRound();

        // Alice bets UP 0.1, Bob bets DOWN 0.1
        vm.prank(alice);
        game.placeBet{value: 0.1 ether}(1, TickShot.Direction.Up);
        vm.prank(bob);
        game.placeBet{value: 0.1 ether}(1, TickShot.Direction.Down);

        vm.warp(block.timestamp + 121);
        mockOracle.setPrice(310_00000000); // UP wins
        game.resolveRound(1);

        uint256 balBefore = alice.balance;

        vm.prank(alice);
        game.claimWinnings(1);

        uint256 balAfter = alice.balance;
        // Total pool = 0.2, fee = 0.006 (3%), payout = 0.194
        uint256 expectedPayout = 0.194 ether;
        assertEq(balAfter - balBefore, expectedPayout);
    }

    function testClaimAsLoser() public {
        game.startRound();

        vm.prank(alice);
        game.placeBet{value: 0.1 ether}(1, TickShot.Direction.Up);
        vm.prank(bob);
        game.placeBet{value: 0.1 ether}(1, TickShot.Direction.Down);

        vm.warp(block.timestamp + 121);
        mockOracle.setPrice(310_00000000); // UP wins
        game.resolveRound(1);

        vm.prank(bob);
        vm.expectRevert("No winnings");
        game.claimWinnings(1);
    }

    function testDoubleClaim() public {
        game.startRound();

        vm.prank(alice);
        game.placeBet{value: 0.1 ether}(1, TickShot.Direction.Up);
        vm.prank(bob);
        game.placeBet{value: 0.1 ether}(1, TickShot.Direction.Down);

        vm.warp(block.timestamp + 121);
        mockOracle.setPrice(310_00000000);
        game.resolveRound(1);

        vm.startPrank(alice);
        game.claimWinnings(1);
        vm.expectRevert("Already claimed");
        game.claimWinnings(1);
        vm.stopPrank();
    }

    function testTieRefund() public {
        game.startRound();

        vm.prank(alice);
        game.placeBet{value: 0.1 ether}(1, TickShot.Direction.Up);
        vm.prank(bob);
        game.placeBet{value: 0.05 ether}(1, TickShot.Direction.Down);

        vm.warp(block.timestamp + 121);
        mockOracle.setPrice(START_PRICE); // tie
        game.resolveRound(1);

        uint256 aliceBefore = alice.balance;
        uint256 bobBefore = bob.balance;

        vm.prank(alice);
        game.claimWinnings(1);
        vm.prank(bob);
        game.claimWinnings(1);

        // Full refund, no fee
        assertEq(alice.balance - aliceBefore, 0.1 ether);
        assertEq(bob.balance - bobBefore, 0.05 ether);
    }

    function testNoWinnerRefund() public {
        // Everyone bets UP, UP wins — no losers, refund everyone
        game.startRound();

        vm.prank(alice);
        game.placeBet{value: 0.1 ether}(1, TickShot.Direction.Up);
        vm.prank(bob);
        game.placeBet{value: 0.05 ether}(1, TickShot.Direction.Up);

        vm.warp(block.timestamp + 121);
        mockOracle.setPrice(310_00000000); // UP wins
        game.resolveRound(1);

        uint256 aliceBefore = alice.balance;
        uint256 bobBefore = bob.balance;

        vm.prank(alice);
        game.claimWinnings(1);
        vm.prank(bob);
        game.claimWinnings(1);

        // Full refund since winningPool == totalPool
        assertEq(alice.balance - aliceBefore, 0.1 ether);
        assertEq(bob.balance - bobBefore, 0.05 ether);
    }

    function testProportionalPayout() public {
        game.startRound();

        // Alice bets 0.3 UP, Bob bets 0.1 UP, Carol bets 0.2 DOWN
        vm.prank(alice);
        game.placeBet{value: 0.3 ether}(1, TickShot.Direction.Up);
        vm.prank(bob);
        game.placeBet{value: 0.1 ether}(1, TickShot.Direction.Up);
        vm.prank(carol);
        game.placeBet{value: 0.2 ether}(1, TickShot.Direction.Down);

        vm.warp(block.timestamp + 121);
        mockOracle.setPrice(310_00000000); // UP wins
        game.resolveRound(1);

        // Total = 0.6, fee = 0.018, poolAfterFee = 0.582
        // Alice payout = (0.3 / 0.4) * 0.582 = 0.4365
        // Bob payout = (0.1 / 0.4) * 0.582 = 0.1455
        uint256 aliceBefore = alice.balance;
        uint256 bobBefore = bob.balance;

        vm.prank(alice);
        game.claimWinnings(1);
        vm.prank(bob);
        game.claimWinnings(1);

        assertEq(alice.balance - aliceBefore, 0.4365 ether);
        assertEq(bob.balance - bobBefore, 0.1455 ether);
    }

    // ── Test: Withdraw Fees ────────────────────────────────────────────

    function testWithdrawFees() public {
        game.startRound();

        vm.prank(alice);
        game.placeBet{value: 0.1 ether}(1, TickShot.Direction.Up);
        vm.prank(bob);
        game.placeBet{value: 0.1 ether}(1, TickShot.Direction.Down);

        vm.warp(block.timestamp + 121);
        mockOracle.setPrice(310_00000000);
        game.resolveRound(1);

        uint256 expectedFee = 0.006 ether; // 3% of 0.2
        assertEq(game.accumulatedFees(), expectedFee);

        uint256 adminBefore = admin.balance;
        game.withdrawFees();
        assertEq(admin.balance - adminBefore, expectedFee);
        assertEq(game.accumulatedFees(), 0);
    }

    // ── Test: Stale Oracle ─────────────────────────────────────────────

    function testStaleOracle() public {
        mockOracle.setUpdatedAt(block.timestamp - 301);
        vm.expectRevert("Stale price");
        game.startRound();
    }
}
