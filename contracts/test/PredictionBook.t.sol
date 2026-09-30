// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {PredictionBook} from "../src/PredictionBook.sol";
import {DivinationRegistry} from "../src/DivinationRegistry.sol";
import {PredicateRegistry} from "../src/PredicateRegistry.sol";
import {ScoreBook} from "../src/ScoreBook.sol";
import {DivinerVault} from "../src/DivinerVault.sol";
import {IResolver} from "../src/interfaces/IResolver.sol";
import {TestBase} from "./support/TestBase.sol";
import {MockERC20} from "./support/MockERC20.sol";

contract MockResolver is IResolver {
    bool public canResolve;
    bool public outcome;
    bool public decided;

    function setResult(bool canResolve_, bool outcome_, bool decided_) external {
        canResolve = canResolve_;
        outcome = outcome_;
        decided = decided_;
    }

    function resolvable(bytes32, bytes calldata, uint64) external view returns (bool) {
        return canResolve;
    }

    function resolve(bytes32, bytes calldata, uint64) external view returns (bool, bool) {
        return (outcome, decided);
    }
}

contract PredictionBookTest is TestBase {
    address private constant TREASURY = address(0x7001);
    address private constant DIVINER = address(0xD1);
    address private constant DIVINER_TWO = address(0xD2);
    address private constant DIVINER_THREE = address(0xD3);
    bytes32 private constant PREDICATE = keccak256("TEST_PREDICATE");
    bytes32 private constant CONTROLLABLE = keccak256("CONTROLLABLE");
    uint256 private constant FEE = 10_000_000;
    uint256 private constant BOND = 100_000_000;
    uint64 private constant DEADLINE = 120;

    MockERC20 private token;
    DivinationRegistry private rounds;
    PredicateRegistry private predicates;
    ScoreBook private scores;
    PredictionBook private book;
    DivinerVault private vault;
    MockResolver private resolver;

    function setUp() public {
        token = new MockERC20();
        rounds = new DivinationRegistry(address(token), TREASURY, 2, 20);
        predicates = new PredicateRegistry();
        scores = new ScoreBook(address(0));
        book = new PredictionBook(address(token), address(rounds), address(predicates), address(scores));
        vault = new DivinerVault(address(token), address(book), DIVINER, 1, 10);
        resolver = new MockResolver();

        rounds.setEscrowOperator(address(book));
        scores.setRecorder(address(book));
        book.registerDiviner(DIVINER, address(vault));
        predicates.setPredicate(
            PREDICATE, address(resolver), keccak256("bytes"), false, PredicateRegistry.PredicateTier.HEAVEN, true
        );
        predicates.setPredicate(
            CONTROLLABLE, address(resolver), keccak256("bytes"), true, PredicateRegistry.PredicateTier.HUMAN, true
        );

        token.mint(address(this), 2_000_000_000);
        token.approve(address(rounds), type(uint256).max);
        token.approve(address(vault), type(uint256).max);
        vault.deposit(1_000_000_000);
        vm.roll(100);
    }

    function testSubmitComputesMultiplierAndFullyReservesBothSides() public {
        uint256 roundId = _revealedRound();
        (uint256 predictionId, bool accepted) = _submit(roundId, DIVINER, PREDICATE, hex"1234", 9_000);
        assertTrue(accepted, unicode"资金充足时预测应被接受");

        PredictionBook.Prediction memory prediction = book.getPrediction(predictionId);
        assertEq(prediction.roundId, roundId, unicode"roundId 错误");
        assertEq(prediction.diviner, DIVINER, unicode"易者错误");
        assertEq(prediction.multiplier, 1, unicode"无历史应取 m_min");
        assertEq(prediction.reserved, 30_000_000, unicode"金库必须预留 3mF");
        assertEq(prediction.schemaHash, keccak256("prediction-schema-v1"), unicode"结构化输出 schema 哈希错误");
        assertEq(prediction.providerConfigHash, keccak256("provider-config-v1"), unicode"provider 配置哈希错误");
        assertEq(prediction.attemptCount, 1, unicode"生成尝试次数错误");
        assertEq(vault.reservedTotal(), 30_000_000, unicode"金库实际预留错误");
        assertEq(token.balanceOf(address(book)), 10_000_000, unicode"提问者侧必须预留 mF");
        assertEq(rounds.availableBond(roundId), BOND - 10_000_000, unicode"保证金扣减错误");
    }

    function testPositiveDeltaMovesOnlyActualProfitAndRefundsRemainder() public {
        uint256 roundId = _revealedRound();
        (uint256 predictionId,) = _submit(roundId, DIVINER, PREDICATE, hex"1234", 9_000);
        uint256 querentBefore = token.balanceOf(address(this));
        uint256 vaultBefore = token.balanceOf(address(vault));
        resolver.setResult(true, true, true);
        vm.roll(DEADLINE + 1);

        book.settle(predictionId);

        assertEq(token.balanceOf(address(vault)), vaultBefore + 9_600_000, unicode"命中收益应为 0.96mF");
        assertEq(token.balanceOf(address(this)), querentBefore + 400_000 + 90_000_000, unicode"剩余抵押应退回");
        assertEq(token.balanceOf(TREASURY), FEE, unicode"卦金应归协议金库");
        assertEq(
            uint256(book.stateOf(predictionId)),
            uint256(PredictionBook.PredictionState.SETTLED),
            unicode"预测状态错误"
        );
        assertEq(
            uint256(rounds.getRound(roundId).state),
            uint256(DivinationRegistry.RoundState.SETTLED),
            unicode"轮次应已决"
        );
    }

    function testNegativeDeltaPaysQuerentFromDivinerVault() public {
        uint256 roundId = _revealedRound();
        (uint256 predictionId,) = _submit(roundId, DIVINER, PREDICATE, hex"1234", 9_000);
        uint256 querentBefore = token.balanceOf(address(this));
        uint256 vaultBefore = token.balanceOf(address(vault));
        resolver.setResult(true, false, true);
        vm.roll(DEADLINE + 1);

        book.settle(predictionId);

        assertEq(token.balanceOf(address(vault)), vaultBefore - 22_400_000, unicode"翻车损失应为 2.24mF");
        assertEq(
            token.balanceOf(address(this)),
            querentBefore + 10_000_000 + 22_400_000 + 90_000_000,
            unicode"提问者应收回抵押并获得赔付"
        );
    }

    function testUndecidedPermanentlyLocksBothReservationsAndPenalizesScore() public {
        uint256 roundId = _revealedRound();
        (uint256 predictionId,) = _submit(roundId, DIVINER, PREDICATE, hex"1234", 7_000);
        resolver.setResult(true, false, false);
        vm.roll(DEADLINE + 1);

        book.settle(predictionId);

        assertEq(
            uint256(book.stateOf(predictionId)),
            uint256(PredictionBook.PredictionState.UNRESOLVED),
            unicode"必须标为未决"
        );
        assertEq(vault.reservedTotal(), 30_000_000, unicode"未决不得释放易者预留");
        assertEq(token.balanceOf(address(book)), 10_000_000, unicode"未决不得释放提问者抵押");
        assertEq(
            uint256(rounds.getRound(roundId).state),
            uint256(DivinationRegistry.RoundState.UNRESOLVED),
            unicode"轮次未决状态错误"
        );
        ScoreBook.Stats memory stats = scores.getStats(DIVINER);
        assertEq(stats.totalBrier, 100_000_000, unicode"未决必须记最大 Brier 惩罚");
    }

    function testRoundRequiresEveryDivinerToPredictIdenticalTerms() public {
        DivinerVault secondVault = new DivinerVault(address(token), address(book), DIVINER_TWO, 1, 10);
        token.approve(address(secondVault), type(uint256).max);
        secondVault.deposit(200_000_000);
        book.registerDiviner(DIVINER_TWO, address(secondVault));
        uint256 roundId = _revealedRound();
        _submit(roundId, DIVINER, PREDICATE, hex"1234", 7_000);

        vm.expectRevert(PredictionBook.RoundTermsMismatch.selector);
        _submit(roundId, DIVINER_TWO, PREDICATE, hex"5678", 7_000);
    }

    function testControllablePredicateIsRejectedBeforeAnyReserve() public {
        uint256 roundId = _revealedRound();
        vm.expectRevert(PredicateRegistry.QuerentControllable.selector);
        _submit(roundId, DIVINER, CONTROLLABLE, hex"1234", 7_000);
        assertEq(vault.reservedTotal(), 0, unicode"拒绝谓词不得改变预留");
    }

    function testInsolventDivinerIsSealedWithoutConsumingQuerentBond() public {
        DivinerVault smallVault = new DivinerVault(address(token), address(book), DIVINER_TWO, 1, 10);
        token.approve(address(smallVault), type(uint256).max);
        smallVault.deposit(29_999_999);
        book.registerDiviner(DIVINER_TWO, address(smallVault));
        uint256 roundId = _revealedRound();

        (, bool accepted) = _submit(roundId, DIVINER_TWO, PREDICATE, hex"1234", 7_000);
        assertTrue(!accepted, unicode"资不抵押时不得应卦");
        assertEq(uint256(smallVault.state()), uint256(DivinerVault.DivinerState.SEALED), unicode"应永久封存");
        assertEq(rounds.availableBond(roundId), BOND, unicode"拒绝预测不得消费保证金");

        vm.expectRevert(DivinerVault.VaultSealed.selector);
        _submit(roundId, DIVINER_TWO, PREDICATE, hex"1234", 7_000);
        assertEq(rounds.availableBond(roundId), BOND, unicode"封存后回滚不得消费保证金");
    }

    function testRegisteredDivinerVaultCannotBeReplacedToManipulateFrozenQuorum() public {
        DivinerVault replacement = new DivinerVault(address(token), address(book), DIVINER, 1, 10);
        vm.expectRevert(PredictionBook.DivinerAlreadyRegistered.selector);
        book.registerDiviner(DIVINER, address(replacement));
    }

    function testProbabilityBoundsAreEnforced() public {
        uint256 roundId = _revealedRound();
        vm.expectRevert(PredictionBook.InvalidProbability.selector);
        _submit(roundId, DIVINER, PREDICATE, hex"1234", 99);
    }

    function testDirectionMustMatchReportedYesProbability() public {
        uint256 roundId = _revealedRound();
        PredictionBook.PredictionRequest memory request = PredictionBook.PredictionRequest({
            roundId: roundId,
            direction: false,
            probabilityBps: 9_000,
            predicateId: PREDICATE,
            params: hex"1234",
            deadline: DEADLINE,
            modelId: keccak256("model-v1"),
            promptHash: keccak256("prompt-v1"),
            schemaHash: keccak256("prediction-schema-v1"),
            providerConfigHash: keccak256("provider-config-v1"),
            attemptCount: 1
        });
        vm.expectRevert();
        vm.prank(DIVINER);
        book.submitPrediction(request);
    }

    function testSchemaHashMustBeNonZeroBeforeAnyReserve() public {
        uint256 roundId = _revealedRound();
        PredictionBook.PredictionRequest memory request = PredictionBook.PredictionRequest({
            roundId: roundId,
            direction: true,
            probabilityBps: 7_000,
            predicateId: PREDICATE,
            params: hex"1234",
            deadline: DEADLINE,
            modelId: keccak256("model-v1"),
            promptHash: keccak256("prompt-v1"),
            schemaHash: bytes32(0),
            providerConfigHash: keccak256("provider-config-v1"),
            attemptCount: 1
        });
        vm.expectRevert(PredictionBook.InvalidMetadata.selector);
        vm.prank(DIVINER);
        book.submitPrediction(request);
        assertEq(vault.reservedTotal(), 0, unicode"元数据无效不得改变预留");
    }

    function testProviderConfigHashAndAttemptCountMustBeValidBeforeAnyReserve() public {
        uint256 roundId = _revealedRound();
        PredictionBook.PredictionRequest memory missingHash = PredictionBook.PredictionRequest({
            roundId: roundId,
            direction: true,
            probabilityBps: 7_000,
            predicateId: PREDICATE,
            params: hex"1234",
            deadline: DEADLINE,
            modelId: keccak256("model-v1"),
            promptHash: keccak256("prompt-v1"),
            schemaHash: keccak256("prediction-schema-v1"),
            providerConfigHash: bytes32(0),
            attemptCount: 1
        });
        vm.expectRevert(PredictionBook.InvalidMetadata.selector);
        vm.prank(DIVINER);
        book.submitPrediction(missingHash);
        assertEq(vault.reservedTotal(), 0, unicode"provider 配置哈希无效不得改变预留");

        PredictionBook.PredictionRequest memory missingAttempts = PredictionBook.PredictionRequest({
            roundId: roundId,
            direction: true,
            probabilityBps: 7_000,
            predicateId: PREDICATE,
            params: hex"1234",
            deadline: DEADLINE,
            modelId: keccak256("model-v1"),
            promptHash: keccak256("prompt-v1"),
            schemaHash: keccak256("prediction-schema-v1"),
            providerConfigHash: keccak256("provider-config-v1"),
            attemptCount: 0
        });
        vm.expectRevert(PredictionBook.InvalidMetadata.selector);
        vm.prank(DIVINER);
        book.submitPrediction(missingAttempts);
        assertEq(vault.reservedTotal(), 0, unicode"零尝试次数不得改变预留");
    }

    function testCannotSettleBeforeBlockDeadline() public {
        uint256 roundId = _revealedRound();
        (uint256 predictionId,) = _submit(roundId, DIVINER, PREDICATE, hex"1234", 7_000);
        resolver.setResult(true, true, true);
        vm.expectRevert(PredictionBook.NotResolvable.selector);
        book.settle(predictionId);
    }

    function testSingleSubmissionCannotSettleRoundWithThreeRegisteredDiviners() public {
        DivinerVault secondVault = _registerFundedDiviner(DIVINER_TWO);
        DivinerVault thirdVault = _registerFundedDiviner(DIVINER_THREE);
        assertTrue(address(secondVault) != address(thirdVault), unicode"测试金库必须彼此独立");
        uint256 roundId = _revealedRound();
        (uint256 predictionId,) = _submit(roundId, DIVINER, PREDICATE, hex"1234", 7_000);
        resolver.setResult(true, true, true);
        vm.roll(DEADLINE + 1);

        vm.expectRevert(abi.encodeWithSelector(PredictionBook.QuorumNotReached.selector, roundId, uint32(1), uint32(3)));
        book.settle(predictionId);
    }

    function testAllFrozenUnsealedDivinersMustSubmitIdenticalTermsBeforeSettlement() public {
        _registerFundedDiviner(DIVINER_TWO);
        _registerFundedDiviner(DIVINER_THREE);
        uint256 roundId = _revealedRound();
        (uint256 firstPredictionId,) = _submit(roundId, DIVINER, PREDICATE, hex"1234", 7_000);
        _submit(roundId, DIVINER_TWO, PREDICATE, hex"1234", 6_000);
        _submit(roundId, DIVINER_THREE, PREDICATE, hex"1234", 8_000);
        resolver.setResult(true, true, true);
        vm.roll(DEADLINE + 1);

        book.settle(firstPredictionId);

        assertEq(
            uint256(book.stateOf(firstPredictionId)),
            uint256(PredictionBook.PredictionState.SETTLED),
            unicode"三家同题提交后必须允许结算"
        );
    }

    function testDivinerRegisteredAfterFirstSubmissionDoesNotChangeFrozenQuorum() public {
        _registerFundedDiviner(DIVINER_TWO);
        uint256 roundId = _revealedRound();
        (uint256 firstPredictionId,) = _submit(roundId, DIVINER, PREDICATE, hex"1234", 7_000);
        _registerFundedDiviner(DIVINER_THREE);
        _submit(roundId, DIVINER_TWO, PREDICATE, hex"1234", 6_000);
        resolver.setResult(true, true, true);
        vm.roll(DEADLINE + 1);

        book.settle(firstPredictionId);

        (uint32 submitted, uint32 required) = book.quorumStatus(roundId);
        assertEq(submitted, 2, unicode"冻结集合应只含首交时的成员");
        assertEq(required, 2, unicode"轮中新增易者不得追溯改变法定人数");
    }

    function testSealedNonSubmitterDoesNotBlockFrozenQuorum() public {
        DivinerVault doomedVault = new DivinerVault(address(token), address(book), DIVINER_TWO, 1, 10);
        token.approve(address(doomedVault), type(uint256).max);
        doomedVault.deposit(29_999_999);
        book.registerDiviner(DIVINER_TWO, address(doomedVault));
        uint256 roundId = _revealedRound();
        (uint256 firstPredictionId,) = _submit(roundId, DIVINER, PREDICATE, hex"1234", 7_000);
        (, bool accepted) = _submit(roundId, DIVINER_TWO, PREDICATE, hex"1234", 6_000);
        assertTrue(!accepted, unicode"资金越过生存线的易者应拒绝提交并永久封存");
        resolver.setResult(true, true, true);
        vm.roll(DEADLINE + 1);

        book.settle(firstPredictionId);

        (uint32 submitted, uint32 required) = book.quorumStatus(roundId);
        assertEq(submitted, 1, unicode"只有存活提交应计入法定人数");
        assertEq(required, 1, unicode"已封存且未提交者不应阻塞轮次");
    }

    function testAnyoneCanCancelIncompleteRoundAfterDeadlineAndReleaseAllFunds() public {
        _registerFundedDiviner(DIVINER_TWO);
        _registerFundedDiviner(DIVINER_THREE);
        uint256 roundId = _revealedRound();
        (uint256 predictionId,) = _submit(roundId, DIVINER, PREDICATE, hex"1234", 7_000);
        uint256 querentBefore = token.balanceOf(address(this));
        vm.roll(DEADLINE + 1);

        vm.prank(address(0xB0B));
        book.cancelIncompleteRound(roundId);

        assertEq(
            token.balanceOf(address(this)),
            querentBefore + FEE + BOND,
            unicode"作废后应退回完整卦金与保证金"
        );
        assertEq(token.balanceOf(address(book)), 0, unicode"PredictionBook 不得残留本轮奖励抵押");
        assertEq(vault.reservedTotal(), 0, unicode"已提交易者的金库预留必须释放");
        assertEq(
            uint256(book.stateOf(predictionId)),
            uint256(PredictionBook.PredictionState.CANCELLED),
            unicode"预测必须标记作废"
        );
        assertEq(
            uint256(rounds.getRound(roundId).state),
            uint256(DivinationRegistry.RoundState.CANCELLED),
            unicode"轮次必须标记作废"
        );
        assertEq(scores.getStats(DIVINER).sampleCount, 0, unicode"缺席作废不得污染 Brier 样本");
    }

    function testAnyoneCanCancelZeroSubmissionRoundAfterRevealWindow() public {
        _registerFundedDiviner(DIVINER_TWO);
        _registerFundedDiviner(DIVINER_THREE);
        uint256 roundId = _revealedRound();
        uint256 querentBefore = token.balanceOf(address(this));
        DivinationRegistry.Round memory round = rounds.getRound(roundId);
        vm.roll(round.revealDeadline + 1);

        vm.prank(address(0xB0B));
        book.cancelIncompleteRound(roundId);

        assertEq(
            token.balanceOf(address(this)),
            querentBefore + FEE + BOND,
            unicode"零提交作废后应退回完整卦金与保证金"
        );
        assertEq(
            uint256(rounds.getRound(roundId).state),
            uint256(DivinationRegistry.RoundState.CANCELLED),
            unicode"零提交轮次必须可进入作废终态"
        );
    }

    function testIncompleteRoundCannotBeCancelledBeforeDeadline() public {
        _registerFundedDiviner(DIVINER_TWO);
        uint256 roundId = _revealedRound();
        _submit(roundId, DIVINER, PREDICATE, hex"1234", 7_000);

        vm.expectRevert(PredictionBook.CancellationTooEarly.selector);
        book.cancelIncompleteRound(roundId);
    }

    function testCompleteQuorumCannotUseIncompleteCancellationPath() public {
        _registerFundedDiviner(DIVINER_TWO);
        uint256 roundId = _revealedRound();
        _submit(roundId, DIVINER, PREDICATE, hex"1234", 7_000);
        _submit(roundId, DIVINER_TWO, PREDICATE, hex"1234", 6_000);
        vm.roll(DEADLINE + 1);

        vm.expectRevert(PredictionBook.QuorumAlreadyReached.selector);
        book.cancelIncompleteRound(roundId);
    }

    function _revealedRound() private returns (uint256 roundId) {
        string memory question = unicode"测试问题";
        bytes32 salt = keccak256(abi.encodePacked(unicode"测试盐", rounds.nextRoundId()));
        roundId = rounds.nextRoundId();
        bytes32 commitment = rounds.computeCommitment(question, salt, address(this), roundId);
        rounds.commit(commitment, FEE, BOND, roundId);
        uint256 target = block.number + 2;
        vm.roll(target);
        vm.setBlockhash(target, keccak256(abi.encode(roundId, unicode"目标块")));
        vm.roll(target + 1);
        rounds.reveal(roundId, question, salt);
    }

    function _submit(uint256 roundId, address diviner, bytes32 predicateId, bytes memory params, uint16 probability)
        private
        returns (uint256 predictionId, bool accepted)
    {
        vm.prank(diviner);
        PredictionBook.PredictionRequest memory request = PredictionBook.PredictionRequest({
            roundId: roundId,
            direction: probability >= 5_000,
            probabilityBps: probability,
            predicateId: predicateId,
            params: params,
            deadline: DEADLINE,
            modelId: keccak256("model-v1"),
            promptHash: keccak256("prompt-v1"),
            schemaHash: keccak256("prediction-schema-v1"),
            providerConfigHash: keccak256("provider-config-v1"),
            attemptCount: 1
        });
        return book.submitPrediction(request);
    }

    function _registerFundedDiviner(address diviner) private returns (DivinerVault fundedVault) {
        fundedVault = new DivinerVault(address(token), address(book), diviner, 1, 10);
        token.approve(address(fundedVault), type(uint256).max);
        fundedVault.deposit(200_000_000);
        book.registerDiviner(diviner, address(fundedVault));
    }
}
