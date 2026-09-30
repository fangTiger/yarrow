// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC20} from "./interfaces/IERC20.sol";
import {IResolver} from "./interfaces/IResolver.sol";

/// @title Arc USDC 总量 resolver
/// @notice 判定首次允许结算时观察到的 totalSupply 是否严格超过阈值。
/// @dev EVM 无法在未来回读任意历史状态；本合约明确记录实际观察块，并在超出延迟后返回未决。
contract UsdcSupplyResolver is IResolver {
    bytes32 public constant PREDICATE_ID = keccak256("USDC_TOTAL_SUPPLY_ABOVE");

    struct Observation {
        uint256 supply;
        uint64 blockNumber;
        bool outcome;
        bool exists;
    }

    IERC20 public immutable usdc;
    uint64 public immutable maxResolutionDelay;
    mapping(bytes32 => Observation) private _observations;

    error InvalidAddress();
    error InvalidDelay();
    error InvalidPredicate();
    error TooEarly();

    event SupplyObserved(bytes32 indexed key, uint256 supply, uint256 threshold, uint64 blockNumber, bool outcome);

    constructor(address usdc_, uint64 maxResolutionDelay_) {
        if (usdc_ == address(0)) revert InvalidAddress();
        if (maxResolutionDelay_ == 0) revert InvalidDelay();
        usdc = IERC20(usdc_);
        maxResolutionDelay = maxResolutionDelay_;
    }

    function resolvable(bytes32 predicateId, bytes calldata params, uint64 deadline)
        external
        view
        override
        returns (bool)
    {
        if (predicateId != PREDICATE_ID || params.length != 32) return false;
        return _observations[_key(params, deadline)].exists || block.number > deadline;
    }

    function resolve(bytes32 predicateId, bytes calldata params, uint64 deadline)
        external
        override
        returns (bool outcome, bool decided)
    {
        if (predicateId != PREDICATE_ID || params.length != 32) revert InvalidPredicate();
        bytes32 key = _key(params, deadline);
        Observation storage observation = _observations[key];
        if (observation.exists) return (observation.outcome, true);
        if (block.number <= deadline) revert TooEarly();
        if (block.number > uint256(deadline) + maxResolutionDelay) return (false, false);

        uint256 threshold = abi.decode(params, (uint256));
        uint256 currentSupply = usdc.totalSupply();
        outcome = currentSupply > threshold;
        observation.supply = currentSupply;
        observation.blockNumber = uint64(block.number);
        observation.outcome = outcome;
        observation.exists = true;
        emit SupplyObserved(key, currentSupply, threshold, uint64(block.number), outcome);
        return (outcome, true);
    }

    function getObservation(bytes calldata params, uint64 deadline)
        external
        view
        returns (uint256 observedSupply, uint64 observedBlock, bool exists)
    {
        Observation storage observation = _observations[_key(params, deadline)];
        return (observation.supply, observation.blockNumber, observation.exists);
    }

    function _key(bytes calldata params, uint64 deadline) private pure returns (bytes32) {
        return keccak256(abi.encode(PREDICATE_ID, keccak256(params), deadline));
    }
}
