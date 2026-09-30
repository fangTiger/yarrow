// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

interface IIdentityRegistry {
    function ownerOf(uint256 agentId) external view returns (address owner);
}
