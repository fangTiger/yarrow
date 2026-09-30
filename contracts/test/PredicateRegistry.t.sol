// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {PredicateRegistry} from "../src/PredicateRegistry.sol";
import {TestBase} from "./support/TestBase.sol";

contract PredicateRegistryTest is TestBase {
    PredicateRegistry private registry;
    bytes32 private constant SUPPLY = keccak256("USDC_TOTAL_SUPPLY_ABOVE");

    function setUp() public {
        registry = new PredicateRegistry();
    }

    function testOwnerRegistersBettablePredicateWithSchema() public {
        address resolver = address(0x1234);
        bytes32 schemaHash = keccak256("abi.encode(uint256 threshold)");
        registry.setPredicate(SUPPLY, resolver, schemaHash, false, PredicateRegistry.PredicateTier.HEAVEN, true);

        PredicateRegistry.PredicateConfig memory config = registry.getPredicate(SUPPLY);
        assertEq(config.resolver, resolver, unicode"resolver 保存错误");
        assertEq(config.schemaHash, schemaHash, unicode"schema 哈希保存错误");
        assertTrue(!config.querentControllable, unicode"天层谓词不应标记为提问者可控");
        assertEq(uint256(config.tier), uint256(PredicateRegistry.PredicateTier.HEAVEN), unicode"层级错误");
        assertEq(registry.requireBettable(SUPPLY), resolver, unicode"可押注路由错误");
    }

    function testQuerentControllablePredicateCannotEnterBettingLayer() public {
        bytes32 humanAction = keccak256("QUERENT_ACTION");
        registry.setPredicate(
            humanAction, address(0x2345), keccak256("caseId"), true, PredicateRegistry.PredicateTier.HUMAN, true
        );
        vm.expectRevert(PredicateRegistry.QuerentControllable.selector);
        registry.requireBettable(humanAction);
    }

    function testEarthAndDisabledPredicatesCannotBeBet() public {
        bytes32 earth = keccak256("LIFE_ADVICE");
        registry.setPredicate(earth, address(0x3456), bytes32(0), false, PredicateRegistry.PredicateTier.EARTH, true);
        vm.expectRevert(PredicateRegistry.PredicateNotBettable.selector);
        registry.requireBettable(earth);

        registry.setPredicate(SUPPLY, address(0x1234), bytes32(0), false, PredicateRegistry.PredicateTier.HEAVEN, false);
        vm.expectRevert(PredicateRegistry.PredicateNotBettable.selector);
        registry.requireBettable(SUPPLY);
    }

    function testOnlyOwnerCanChangeWhitelist() public {
        vm.expectRevert(PredicateRegistry.NotOwner.selector);
        vm.prank(address(0xBAD));
        registry.setPredicate(SUPPLY, address(0x1234), bytes32(0), false, PredicateRegistry.PredicateTier.HEAVEN, true);
    }
}
