// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {MutualResolver} from "../src/MutualResolver.sol";
import {AttestedResolver} from "../src/AttestedResolver.sol";
import {UsdcSupplyResolver} from "../src/UsdcSupplyResolver.sol";
import {TestBase} from "./support/TestBase.sol";
import {MockERC20} from "./support/MockERC20.sol";

contract MockValidationRegistry {
    struct Status {
        address validatorAddress;
        uint256 agentId;
        uint8 response;
        bytes32 responseHash;
        string tag;
        uint256 lastUpdate;
        bool exists;
    }

    mapping(bytes32 => Status) private _statuses;

    function seedRequest(bytes32 requestHash, address validatorAddress, uint256 agentId) external {
        _statuses[requestHash] = Status({
            validatorAddress: validatorAddress,
            agentId: agentId,
            response: 0,
            responseHash: bytes32(0),
            tag: "",
            lastUpdate: block.timestamp,
            exists: true
        });
    }

    function validationResponse(
        bytes32 requestHash,
        uint8 response,
        string calldata,
        bytes32 responseHash,
        string calldata tag
    ) external {
        Status storage status = _statuses[requestHash];
        require(status.exists, "unknown");
        require(msg.sender == status.validatorAddress, "not validator");
        status.response = response;
        status.responseHash = responseHash;
        status.tag = tag;
        status.lastUpdate = block.timestamp;
    }

    function getValidationStatus(bytes32 requestHash)
        external
        view
        returns (
            address validatorAddress,
            uint256 agentId,
            uint8 response,
            bytes32 responseHash,
            string memory tag,
            uint256 lastUpdate
        )
    {
        Status storage status = _statuses[requestHash];
        require(status.exists, "unknown");
        return
            (
                status.validatorAddress,
                status.agentId,
                status.response,
                status.responseHash,
                status.tag,
                status.lastUpdate
            );
    }
}

contract ResolversTest is TestBase {
    address private constant QUERENT = address(0xA11CE);
    address private constant DIVINER = address(0xD1);
    bytes32 private constant CASE_ID = keccak256(unicode"双边案件一");

    MutualResolver private mutual;
    MockERC20 private token;
    UsdcSupplyResolver private supply;
    MockValidationRegistry private validationRegistry;
    AttestedResolver private attested;

    function setUp() public {
        mutual = new MutualResolver(address(this));
        token = new MockERC20();
        supply = new UsdcSupplyResolver(address(token), 10);
        validationRegistry = new MockValidationRegistry();
        attested = new AttestedResolver(address(validationRegistry), address(this));
        vm.roll(100);
    }

    function testMutualResolverDecidesOnlyWhenBothSidesAgree() public {
        mutual.registerCase(CASE_ID, QUERENT, DIVINER, 110);
        vm.prank(QUERENT);
        mutual.declareOutcome(CASE_ID, true);
        vm.prank(DIVINER);
        mutual.declareOutcome(CASE_ID, true);

        assertTrue(
            !mutual.resolvable(mutual.PREDICATE_ID(), abi.encode(CASE_ID), 110),
            unicode"截止块尚未过去时不得结算"
        );
        vm.roll(111);
        assertTrue(mutual.resolvable(mutual.PREDICATE_ID(), abi.encode(CASE_ID), 110), unicode"截止后应可结算");
        (bool outcome, bool decided) = mutual.resolve(mutual.PREDICATE_ID(), abi.encode(CASE_ID), 110);
        assertTrue(decided && outcome, unicode"双方一致 YES 应得到已决 YES");
    }

    function testMutualDisagreementBecomesUnresolved() public {
        mutual.registerCase(CASE_ID, QUERENT, DIVINER, 110);
        vm.prank(QUERENT);
        mutual.declareOutcome(CASE_ID, true);
        vm.prank(DIVINER);
        mutual.declareOutcome(CASE_ID, false);
        vm.roll(111);
        (, bool decided) = mutual.resolve(mutual.PREDICATE_ID(), abi.encode(CASE_ID), 110);
        assertTrue(!decided, unicode"双方冲突必须返回未决");
    }

    function testMutualMissingDeclarationBecomesUnresolvedAfterBlockDeadline() public {
        mutual.registerCase(CASE_ID, QUERENT, DIVINER, 110);
        vm.prank(QUERENT);
        mutual.declareOutcome(CASE_ID, true);
        vm.roll(111);
        (, bool decided) = mutual.resolve(mutual.PREDICATE_ID(), abi.encode(CASE_ID), 110);
        assertTrue(!decided, unicode"一方缺席必须返回未决");

        vm.expectRevert(MutualResolver.DeclarationClosed.selector);
        vm.prank(DIVINER);
        mutual.declareOutcome(CASE_ID, true);
    }

    function testOnlyRegisteredPartiesCanDeclareOnce() public {
        mutual.registerCase(CASE_ID, QUERENT, DIVINER, 110);
        vm.expectRevert(MutualResolver.NotParty.selector);
        vm.prank(address(0xBAD));
        mutual.declareOutcome(CASE_ID, true);

        vm.prank(QUERENT);
        mutual.declareOutcome(CASE_ID, true);
        vm.expectRevert(MutualResolver.AlreadyDeclared.selector);
        vm.prank(QUERENT);
        mutual.declareOutcome(CASE_ID, false);
    }

    function testUsdcSupplyResolverCachesFirstAllowedObservation() public {
        token.mint(address(0x1), 1_000_000);
        bytes memory params = abi.encode(uint256(900_000));
        assertTrue(!supply.resolvable(supply.PREDICATE_ID(), params, 110), unicode"截止前不可判定");
        vm.roll(111);
        (bool outcome, bool decided) = supply.resolve(supply.PREDICATE_ID(), params, 110);
        assertTrue(decided && outcome, unicode"总量超过阈值应为 YES");

        token.mint(address(0x2), 10_000_000);
        (bool cachedOutcome, bool cachedDecided) = supply.resolve(supply.PREDICATE_ID(), params, 110);
        assertTrue(cachedDecided && cachedOutcome, unicode"后续状态变化不得改写首次观察结果");
        (uint256 observedSupply, uint64 observedBlock, bool exists) = supply.getObservation(params, 110);
        assertEq(observedSupply, 1_000_000, unicode"观察总量错误");
        assertEq(observedBlock, 111, unicode"观察块高错误");
        assertTrue(exists, unicode"必须标记快照存在");
    }

    function testUsdcSupplyUsesStrictlyGreaterThan() public {
        token.mint(address(0x1), 1_000_000);
        bytes memory params = abi.encode(uint256(1_000_000));
        vm.roll(111);
        (bool outcome, bool decided) = supply.resolve(supply.PREDICATE_ID(), params, 110);
        assertTrue(decided && !outcome, unicode"等于阈值不算超过");
    }

    function testUsdcSupplyLateObservationIsExplicitlyUndecided() public {
        token.mint(address(0x1), 1_000_000);
        bytes memory params = abi.encode(uint256(1));
        vm.roll(121);
        (, bool decided) = supply.resolve(supply.PREDICATE_ID(), params, 110);
        assertTrue(!decided, unicode"超过最大观察延迟必须未决而非伪装历史值");
    }

    function testAttestedResolverReadsErc8004YesResponseAfterDeadline() public {
        bytes32 requestHash = keccak256(unicode"人层案件一");
        bytes32 evidenceHash = keccak256(unicode"人层证据一");
        validationRegistry.seedRequest(requestHash, address(attested), 42);
        attested.openCase(requestHash, 42, 110);
        attested.submitOutcome(requestHash, true, "ipfs://evidence/yes", evidenceHash);
        assertTrue(
            !attested.resolvable(attested.PREDICATE_ID(), abi.encode(requestHash, uint256(42)), 110),
            unicode"截止前不得结算"
        );

        vm.roll(111);
        (bool outcome, bool decided) =
            attested.resolve(attested.PREDICATE_ID(), abi.encode(requestHash, uint256(42)), 110);
        assertTrue(decided && outcome, unicode"Registry 的 100 分标准响应应映射为已决 YES");
    }

    function testAttestedResolverMapsZeroResponseToDecidedNo() public {
        bytes32 requestHash = keccak256(unicode"人层案件二");
        validationRegistry.seedRequest(requestHash, address(attested), 43);
        attested.openCase(requestHash, 43, 110);
        attested.submitOutcome(requestHash, false, "ipfs://evidence/no", keccak256(unicode"人层证据二"));
        vm.roll(111);

        (bool outcome, bool decided) =
            attested.resolve(attested.PREDICATE_ID(), abi.encode(requestHash, uint256(43)), 110);
        assertTrue(decided && !outcome, unicode"带项目 tag 的 0 分标准响应应映射为已决 NO");
    }

    function testAttestedResolverKeepsMissingResponseUnresolved() public {
        bytes32 requestHash = keccak256(unicode"人层案件三");
        validationRegistry.seedRequest(requestHash, address(attested), 44);
        attested.openCase(requestHash, 44, 110);
        vm.roll(111);

        (, bool decided) = attested.resolve(attested.PREDICATE_ID(), abi.encode(requestHash, uint256(44)), 110);
        assertTrue(!decided, unicode"Registry 无响应时必须保持未决");
    }

    function testAttestedResolverRejectsWrongRequestTargetAndUnauthorizedAttestor() public {
        bytes32 wrongTarget = keccak256(unicode"错误目标");
        validationRegistry.seedRequest(wrongTarget, address(0xBAD), 45);
        vm.expectRevert(AttestedResolver.InvalidValidationRequest.selector);
        attested.openCase(wrongTarget, 45, 110);

        bytes32 requestHash = keccak256(unicode"正确目标");
        validationRegistry.seedRequest(requestHash, address(attested), 45);
        attested.openCase(requestHash, 45, 110);
        vm.expectRevert(AttestedResolver.NotAttestor.selector);
        vm.prank(address(0xBAD));
        attested.submitOutcome(requestHash, true, "", bytes32(0));
    }

    function testAttestedResolverRejectsLateOrDuplicateResponse() public {
        bytes32 requestHash = keccak256(unicode"人层案件四");
        validationRegistry.seedRequest(requestHash, address(attested), 46);
        attested.openCase(requestHash, 46, 110);
        attested.submitOutcome(requestHash, true, "", bytes32(0));
        vm.expectRevert(AttestedResolver.AlreadyResponded.selector);
        attested.submitOutcome(requestHash, false, "", bytes32(0));

        bytes32 lateHash = keccak256(unicode"迟到案件");
        validationRegistry.seedRequest(lateHash, address(attested), 47);
        attested.openCase(lateHash, 47, 110);
        vm.roll(111);
        vm.expectRevert(AttestedResolver.AttestationClosed.selector);
        attested.submitOutcome(lateHash, true, "", bytes32(0));
    }
}
