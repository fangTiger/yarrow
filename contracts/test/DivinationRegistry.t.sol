// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {DivinationRegistry} from "../src/DivinationRegistry.sol";
import {TestBase} from "./support/TestBase.sol";
import {MockERC20} from "./support/MockERC20.sol";

contract DivinationRegistryTest is TestBase {
    address private constant TREASURY = address(0x7001);
    address private constant STRANGER = address(0xBAD);
    address private constant RECEIVER = address(0xBEEF);
    address private constant HISTORY = 0x0000F90827F1C53a10cb7A02335B175320002935;
    uint256 private constant FEE = 300_000;
    uint256 private constant BOND = 3_000_000;

    MockERC20 private token;
    DivinationRegistry private registry;

    function setUp() public {
        token = new MockERC20();
        registry = new DivinationRegistry(address(token), TREASURY, 2, 20);
        token.mint(address(this), 20_000_000);
        token.approve(address(registry), type(uint256).max);
        vm.roll(100);
    }

    function testCommitmentUsesEveryRequiredDomainField() public {
        string memory question = unicode"Arc 会继续增长吗？";
        bytes32 salt = keccak256(unicode"高熵盐");
        uint256 roundId = registry.nextRoundId();
        bytes32 expected =
            keccak256(abi.encode(question, salt, address(this), roundId, block.chainid, address(registry)));
        assertEq(
            registry.computeCommitment(question, salt, address(this), roundId),
            expected,
            unicode"commitment 域字段不完整"
        );

        registry.commit(expected, FEE, BOND, roundId);
        DivinationRegistry.Round memory round = registry.getRound(roundId);
        assertEq(round.commitment, expected, unicode"承诺未保存");
        assertEq(round.querent, address(this), unicode"提问者错误");
        assertEq(round.commitBlock, 100, unicode"提交块高错误");
        assertEq(round.revealDeadline, 122, unicode"揭示截止块错误");
        assertEq(token.balanceOf(address(registry)), FEE + BOND, unicode"卦金和保证金必须托管");
    }

    function testRevealMustWaitPastTargetBlockAndDerivesSeed() public {
        string memory question = unicode"本轮能否成卦？";
        bytes32 salt = keccak256(unicode"盐二");
        uint256 roundId = _commit(question, salt);
        uint256 targetBlock = 102;
        bytes32 futureHash = keccak256(unicode"目标块哈希");

        vm.roll(targetBlock);
        vm.expectRevert(DivinationRegistry.RevealTooEarly.selector);
        registry.reveal(roundId, question, salt);

        vm.setBlockhash(targetBlock, futureHash);
        vm.roll(targetBlock + 1);
        registry.reveal(roundId, question, salt);

        DivinationRegistry.Round memory round = registry.getRound(roundId);
        assertEq(round.seed, keccak256(abi.encode(salt, futureHash)), unicode"seed 公式错误");
        assertEq(uint256(round.state), uint256(DivinationRegistry.RoundState.REVEALED), unicode"轮次状态错误");
        for (uint256 i; i < 6; ++i) {
            assertTrue(round.lines[i] >= 6 && round.lines[i] <= 9, unicode"爻值必须在 6 到 9");
        }
    }

    function testRevealRejectsWrongSenderAndWrongOpening() public {
        string memory question = unicode"原问题";
        bytes32 salt = keccak256(unicode"原盐");
        uint256 roundId = _commit(question, salt);
        vm.roll(102);
        vm.setBlockhash(102, keccak256(unicode"块哈希"));
        vm.roll(103);

        vm.expectRevert(DivinationRegistry.NotQuerent.selector);
        vm.prank(STRANGER);
        registry.reveal(roundId, question, salt);

        vm.expectRevert(DivinationRegistry.CommitmentMismatch.selector);
        registry.reveal(roundId, unicode"篡改问题", salt);
    }

    function testAnyoneCanForfeitOnlyAfterDeadline() public {
        uint256 roundId = _commit(unicode"会不会弃卦？", keccak256(unicode"弃卦盐"));
        vm.roll(122);
        vm.expectRevert(DivinationRegistry.ForfeitTooEarly.selector);
        vm.prank(STRANGER);
        registry.forfeit(roundId);

        vm.roll(123);
        vm.prank(STRANGER);
        registry.forfeit(roundId);
        DivinationRegistry.Round memory round = registry.getRound(roundId);
        assertEq(uint256(round.state), uint256(DivinationRegistry.RoundState.FORFEITED), unicode"弃卦状态错误");
        assertEq(token.balanceOf(TREASURY), FEE + BOND, unicode"弃卦资金必须全部没收归金库");
    }

    function testHistoryContractIsUsedAfterOpcodeWindow() public {
        DivinationRegistry longWindowRegistry = new DivinationRegistry(address(token), TREASURY, 2, 500);
        token.approve(address(longWindowRegistry), type(uint256).max);
        string memory question = unicode"长窗口仍能揭示吗？";
        bytes32 salt = keccak256(unicode"长窗口盐");
        bytes32 commitment = longWindowRegistry.computeCommitment(question, salt, address(this), 0);
        longWindowRegistry.commit(commitment, FEE, BOND, 0);

        bytes32 historyHash = keccak256(unicode"EIP-2935 历史哈希");
        vm.mockCall(HISTORY, abi.encode(uint256(102)), abi.encode(historyHash));
        vm.roll(400);
        longWindowRegistry.reveal(0, question, salt);
        assertEq(
            longWindowRegistry.getRound(0).seed,
            keccak256(abi.encode(salt, historyHash)),
            unicode"超过 opcode 窗口时必须使用历史合约"
        );
    }

    function testEscrowOperatorConsumesBondAndFinalizesFee() public {
        string memory question = unicode"托管如何结算？";
        bytes32 salt = keccak256(unicode"托管盐");
        uint256 roundId = _commit(question, salt);
        vm.roll(102);
        vm.setBlockhash(102, keccak256(unicode"托管块哈希"));
        vm.roll(103);
        registry.reveal(roundId, question, salt);
        registry.setEscrowOperator(address(this));

        uint256 balanceBefore = token.balanceOf(address(this));
        registry.consumeBond(roundId, RECEIVER, 1_000_000);
        assertEq(token.balanceOf(RECEIVER), 1_000_000, unicode"保证金领取错误");
        registry.markPredicted(roundId);
        registry.finalizeSettled(roundId);

        assertEq(token.balanceOf(TREASURY), FEE, unicode"正常结算后卦金应归金库");
        assertEq(
            token.balanceOf(address(this)), balanceBefore + BOND - 1_000_000, unicode"剩余保证金应退还提问者"
        );
        assertEq(token.balanceOf(address(registry)), 0, unicode"已决轮次不得残留托管资金");
    }

    function testEscrowOperatorCanOnlyBeBoundOnce() public {
        registry.setEscrowOperator(address(this));
        vm.expectRevert();
        registry.setEscrowOperator(STRANGER);
        assertEq(registry.escrowOperator(), address(this), unicode"托管操作员绑定后不得替换");
    }

    function testDelayConfigurationMustStayInsideHistoryWindow() public {
        vm.expectRevert(DivinationRegistry.InvalidBlockWindows.selector);
        new DivinationRegistry(address(token), TREASURY, 0, 20);

        vm.expectRevert(DivinationRegistry.InvalidBlockWindows.selector);
        new DivinationRegistry(address(token), TREASURY, 100, 8_000);
    }

    function testWaitBlocksMustBeFarBelowHistoryLimit() public {
        vm.expectRevert(DivinationRegistry.InvalidBlockWindows.selector);
        new DivinationRegistry(address(token), TREASURY, 129, 20);
    }

    function testRegistryExposesKingWenLookupForDisplay() public view {
        assertEq(registry.kingWenNumber(63), 1, unicode"登记合约必须公开乾卦文王序");
        assertEq(registry.kingWenNumber(0), 2, unicode"登记合约必须公开坤卦文王序");
        assertEq(registry.kingWenNumber(21), 63, unicode"登记合约必须公开既济文王序");
        assertEq(registry.kingWenNumber(42), 64, unicode"登记合约必须公开未济文王序");
    }

    function _commit(string memory question, bytes32 salt) private returns (uint256 roundId) {
        roundId = registry.nextRoundId();
        bytes32 commitment = registry.computeCommitment(question, salt, address(this), roundId);
        registry.commit(commitment, FEE, BOND, roundId);
    }
}
