// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

interface IResolver {
    function resolvable(bytes32 predicateId, bytes calldata params, uint64 deadline) external view returns (bool);

    function resolve(bytes32 predicateId, bytes calldata params, uint64 deadline)
        external
        returns (bool outcome, bool decided);
}
