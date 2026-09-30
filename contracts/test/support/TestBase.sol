// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

interface Vm {
    function deal(address account, uint256 newBalance) external;
    function expectRevert() external;
    function expectRevert(bytes4 selector) external;
    function expectRevert(bytes calldata revertData) external;
    function mockCall(address callee, bytes calldata data, bytes calldata returnData) external;
    function prank(address sender) external;
    function roll(uint256 newHeight) external;
    function setBlockhash(uint256 blockNumber, bytes32 blockHash) external;
}

abstract contract TestBase {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function assertTrue(bool value, string memory reason) internal pure {
        require(value, reason);
    }

    function assertEq(uint256 actual, uint256 expected, string memory reason) internal pure {
        require(actual == expected, reason);
    }

    function assertEq(int256 actual, int256 expected, string memory reason) internal pure {
        require(actual == expected, reason);
    }

    function assertEq(bytes32 actual, bytes32 expected, string memory reason) internal pure {
        require(actual == expected, reason);
    }

    function assertEq(address actual, address expected, string memory reason) internal pure {
        require(actual == expected, reason);
    }
}
