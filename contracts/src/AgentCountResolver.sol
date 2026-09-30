// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IIdentityRegistry} from "./interfaces/IIdentityRegistry.sol";
import {IResolver} from "./interfaces/IResolver.sol";

/// @title ERC-8004 agent 注册计数 resolver
/// @notice 在当前 v2.0.0 连续自增且无公开销毁入口的 IdentityRegistry 上，以 ownerOf 二分求计数。
/// @dev Registry 可升级；若 token 0 或固定上界不满足二分不变量，本合约明确返回未决。
contract AgentCountResolver is IResolver {
    bytes32 public constant PREDICATE_ID = keccak256("AGENT_COUNT_ABOVE");
    uint256 public constant SEARCH_UPPER_BOUND = 1 << 24;

    struct Observation {
        uint256 count;
        uint64 blockNumber;
        bool outcome;
        bool exists;
    }

    IIdentityRegistry public immutable identityRegistry;
    uint64 public immutable maxResolutionDelay;
    mapping(bytes32 => Observation) private _observations;

    error InvalidAddress();
    error InvalidDelay();
    error InvalidPredicate();
    error TooEarly();

    event AgentCountObserved(bytes32 indexed key, uint256 count, uint256 threshold, uint64 blockNumber, bool outcome);

    constructor(address identityRegistry_, uint64 maxResolutionDelay_) {
        if (identityRegistry_ == address(0)) revert InvalidAddress();
        if (maxResolutionDelay_ == 0) revert InvalidDelay();
        identityRegistry = IIdentityRegistry(identityRegistry_);
        maxResolutionDelay = maxResolutionDelay_;
    }

    function currentCount() public view returns (uint256 count, bool reliable) {
        if (!_exists(0) || _exists(SEARCH_UPPER_BOUND)) return (0, false);

        uint256 low = 0;
        uint256 high = SEARCH_UPPER_BOUND;
        while (high - low > 1) {
            uint256 middle = (low + high) >> 1;
            if (_exists(middle)) {
                low = middle;
            } else {
                high = middle;
            }
        }
        return (low + 1, true);
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

        (uint256 count, bool reliable) = currentCount();
        if (!reliable) return (false, false);
        uint256 threshold = abi.decode(params, (uint256));
        outcome = count > threshold;
        observation.count = count;
        observation.blockNumber = uint64(block.number);
        observation.outcome = outcome;
        observation.exists = true;
        emit AgentCountObserved(key, count, threshold, uint64(block.number), outcome);
        return (outcome, true);
    }

    function getObservation(bytes calldata params, uint64 deadline)
        external
        view
        returns (uint256 observedCount, uint64 observedBlock, bool exists)
    {
        Observation storage observation = _observations[_key(params, deadline)];
        return (observation.count, observation.blockNumber, observation.exists);
    }

    function _exists(uint256 agentId) private view returns (bool) {
        try identityRegistry.ownerOf(agentId) returns (address owner) {
            return owner != address(0);
        } catch {
            return false;
        }
    }

    function _key(bytes calldata params, uint64 deadline) private pure returns (bytes32) {
        return keccak256(abi.encode(PREDICATE_ID, keccak256(params), deadline));
    }
}
