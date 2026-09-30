// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {AgentCountResolver} from "../src/AgentCountResolver.sol";
import {TestBase} from "./support/TestBase.sol";

contract MockIdentityRegistryForCount {
    mapping(uint256 => address) private _owners;

    constructor(uint256 count) {
        for (uint256 id = 0; id < count; ++id) {
            _owners[id] = address(uint160(id + 1));
        }
    }

    function setExisting(uint256 id, address owner) external {
        _owners[id] = owner;
    }

    function ownerOf(uint256 id) external view returns (address owner) {
        owner = _owners[id];
        require(owner != address(0), unicode"不存在");
    }

    function getVersion() external pure returns (string memory) {
        return "2.0.0";
    }
}

contract AgentCountResolverTest is TestBase {
    bytes32 private constant PREDICATE_ID = keccak256("AGENT_COUNT_ABOVE");

    function testBinarySearchReturnsExactCountFromZeroBasedContinuousIds() public {
        MockIdentityRegistryForCount identity = new MockIdentityRegistryForCount(8);
        AgentCountResolver resolver = new AgentCountResolver(address(identity), 10);

        (uint256 count, bool reliable) = resolver.currentCount();

        assertEq(count, 8, unicode"0 至 7 已铸造时计数应为 8");
        assertTrue(reliable, unicode"连续且上界未铸造时结果应可靠");
    }

    function testResolveUsesStrictGreaterThanAndFreezesFirstAllowedObservation() public {
        MockIdentityRegistryForCount identity = new MockIdentityRegistryForCount(8);
        AgentCountResolver resolver = new AgentCountResolver(address(identity), 10);
        bytes memory params = abi.encode(uint256(7));
        vm.roll(111);

        (bool outcome, bool decided) = resolver.resolve(PREDICATE_ID, params, 110);
        assertTrue(decided && outcome, unicode"计数 8 应严格超过阈值 7");

        identity.setExisting(8, address(0x999));
        (bool frozenOutcome, bool frozenDecided) = resolver.resolve(PREDICATE_ID, params, 110);
        assertTrue(frozenDecided && frozenOutcome, unicode"后续注册不得改写首次观察结果");
        (uint256 observedCount, uint64 observedBlock, bool exists) = resolver.getObservation(params, 110);
        assertEq(observedCount, 8, unicode"首次观察计数错误");
        assertEq(observedBlock, 111, unicode"首次观察块高错误");
        assertTrue(exists, unicode"必须保存首次观察");
    }

    function testEqualThresholdIsDecidedNo() public {
        MockIdentityRegistryForCount identity = new MockIdentityRegistryForCount(8);
        AgentCountResolver resolver = new AgentCountResolver(address(identity), 10);
        vm.roll(111);

        (bool outcome, bool decided) = resolver.resolve(PREDICATE_ID, abi.encode(uint256(8)), 110);

        assertTrue(decided && !outcome, unicode"计数等于阈值不算超过");
    }

    function testMissingZeroBaseOrMintedSearchCeilingIsUnreliable() public {
        MockIdentityRegistryForCount missingBase = new MockIdentityRegistryForCount(0);
        AgentCountResolver missingBaseResolver = new AgentCountResolver(address(missingBase), 10);
        (, bool baseReliable) = missingBaseResolver.currentCount();
        assertTrue(!baseReliable, unicode"token 0 不存在时不得猜测计数基数");

        MockIdentityRegistryForCount ceilingMinted = new MockIdentityRegistryForCount(1);
        ceilingMinted.setExisting(1 << 24, address(0x888));
        AgentCountResolver ceilingResolver = new AgentCountResolver(address(ceilingMinted), 10);
        (, bool ceilingReliable) = ceilingResolver.currentCount();
        assertTrue(!ceilingReliable, unicode"搜索上界已铸造时不得返回截断计数");
    }

    function testLateObservationAndInvalidInputsStayExplicit() public {
        MockIdentityRegistryForCount identity = new MockIdentityRegistryForCount(8);
        AgentCountResolver resolver = new AgentCountResolver(address(identity), 10);
        vm.roll(121);

        (, bool decided) = resolver.resolve(PREDICATE_ID, abi.encode(uint256(7)), 110);
        assertTrue(!decided, unicode"超过最大观察延迟必须未决");
        assertTrue(
            !resolver.resolvable(bytes32(uint256(1)), abi.encode(uint256(7)), 110), unicode"错误谓词不可结算"
        );
        assertTrue(!resolver.resolvable(PREDICATE_ID, hex"1234", 110), unicode"错误参数长度不可结算");
    }
}
