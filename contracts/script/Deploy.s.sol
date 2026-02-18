// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/TickShot.sol";

contract Deploy is Script {
    // Chainlink BNB/USD on BSC Testnet
    address constant CHAINLINK_BNB_USD = 0x2514895c72f50D8bd4B4F9b1110F0D6bD2c97526;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        TickShot game = new TickShot(CHAINLINK_BNB_USD);
        console.log("TickShot deployed at:", address(game));

        vm.stopBroadcast();
    }
}
