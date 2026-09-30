// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @title 谓词白名单与 resolver 路由
contract PredicateRegistry {
    enum PredicateTier {
        HEAVEN,
        HUMAN,
        EARTH
    }

    struct PredicateConfig {
        address resolver;
        bytes32 schemaHash;
        bool querentControllable;
        PredicateTier tier;
        bool enabled;
    }

    address public immutable owner;
    mapping(bytes32 => PredicateConfig) private _predicates;

    error InvalidAddress();
    error NotOwner();
    error PredicateNotBettable();
    error QuerentControllable();

    event PredicateSet(
        bytes32 indexed predicateId,
        address indexed resolver,
        bytes32 schemaHash,
        bool querentControllable,
        PredicateTier tier,
        bool enabled
    );

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    function setPredicate(
        bytes32 predicateId,
        address resolver,
        bytes32 schemaHash,
        bool querentControllable,
        PredicateTier tier,
        bool enabled
    ) external onlyOwner {
        if (enabled && resolver == address(0)) revert InvalidAddress();
        _predicates[predicateId] = PredicateConfig({
            resolver: resolver,
            schemaHash: schemaHash,
            querentControllable: querentControllable,
            tier: tier,
            enabled: enabled
        });
        emit PredicateSet(predicateId, resolver, schemaHash, querentControllable, tier, enabled);
    }

    function getPredicate(bytes32 predicateId) external view returns (PredicateConfig memory) {
        return _predicates[predicateId];
    }

    /// @notice 押注层只接受启用、非地层且提问者不可控的谓词。
    function requireBettable(bytes32 predicateId) external view returns (address resolver) {
        PredicateConfig storage config = _predicates[predicateId];
        if (config.querentControllable) revert QuerentControllable();
        if (!config.enabled || config.tier == PredicateTier.EARTH || config.resolver == address(0)) {
            revert PredicateNotBettable();
        }
        return config.resolver;
    }
}
