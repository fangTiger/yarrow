// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ScoreBook} from "../src/ScoreBook.sol";
import {TestBase} from "./support/TestBase.sol";

contract MockReputationRegistry {
    uint256 public calls;
    uint256 public lastAgentId;
    int128 public lastValue;
    uint8 public lastDecimals;
    string public lastTag1;
    string public lastTag2;

    function giveFeedback(
        uint256 agentId,
        int128 value,
        uint8 valueDecimals,
        string calldata tag1,
        string calldata tag2,
        string calldata,
        string calldata,
        bytes32
    ) external {
        ++calls;
        lastAgentId = agentId;
        lastValue = value;
        lastDecimals = valueDecimals;
        lastTag1 = tag1;
        lastTag2 = tag2;
    }
}

contract ScoreBookTest is TestBase {
    address private constant DIVINER = address(0xD1);
    MockReputationRegistry private reputation;
    ScoreBook private scoreBook;

    function setUp() public {
        reputation = new MockReputationRegistry();
        scoreBook = new ScoreBook(address(reputation));
        scoreBook.setRecorder(address(this));
        scoreBook.setReplayRecorder(address(this));
        scoreBook.setAgentId(DIVINER, 42);
    }

    function testRecordsBrierAccuracyAndPublishesErc8004Feedback() public {
        uint256 brier = scoreBook.recordPrediction(7, 3, DIVINER, 8_000, true, true);
        ScoreBook.Stats memory stats = scoreBook.getStats(DIVINER);

        assertEq(brier, 4_000_000, unicode"Brier 应为概率偏差平方");
        assertEq(stats.sampleCount, 1, unicode"样本数错误");
        assertEq(stats.correctCount, 1, unicode"命中数错误");
        assertEq(stats.totalBrier, 4_000_000, unicode"累计 Brier 错误");
        assertEq(scoreBook.averageBrier(DIVINER), 4_000_000, unicode"平均 Brier 错误");
        assertEq(reputation.calls(), 1, unicode"必须发布一条 ERC-8004 反馈");
        assertEq(reputation.lastAgentId(), 42, unicode"agentId 错误");
        assertEq(uint256(uint128(reputation.lastValue())), brier, unicode"反馈数值错误");
        assertEq(reputation.lastDecimals(), 8, unicode"Brier 精度应为 8 位");
        assertTrue(keccak256(bytes(reputation.lastTag1())) == keccak256("brier"), unicode"反馈标签错误");
    }

    function testUnresolvedCountsAsMaximumBrierPenalty() public {
        scoreBook.recordUnresolvedPrediction(7, 3, DIVINER, 7_000);
        ScoreBook.Stats memory stats = scoreBook.getStats(DIVINER);
        assertEq(stats.sampleCount, 1, unicode"未决也必须进入样本量");
        assertEq(stats.unresolvedCount, 1, unicode"未决计数错误");
        assertEq(stats.totalBrier, 100_000_000, unicode"未决应记最大 Brier 惩罚");
        assertTrue(
            keccak256(bytes(reputation.lastTag2())) == keccak256("unresolved"), unicode"未决反馈标签错误"
        );
    }

    function testWilsonIntervalHandlesNoHistoryAndSuccesses() public {
        (uint16 emptyLow, uint16 emptyHigh) = scoreBook.wilson95(DIVINER);
        assertEq(emptyLow, 0, unicode"无样本 Wilson 下界应为 0");
        assertEq(emptyHigh, 10_000, unicode"无样本 Wilson 上界应为 100%");

        for (uint256 i; i < 5; ++i) {
            scoreBook.recordPrediction(i + 1, i + 10, DIVINER, 9_000, true, true);
        }
        (uint16 low, uint16 high) = scoreBook.wilson95(DIVINER);
        assertTrue(low >= 5_600 && low <= 5_700, unicode"五次全中 Wilson 下界应约为 56.6%");
        assertEq(high, 10_000, unicode"全中 Wilson 上界应为 100%");
    }

    function testBrierSkillUsesEmpiricalBaseRateConstantPrediction() public {
        for (uint256 i; i < 20; ++i) {
            bool outcome = i == 0;
            scoreBook.recordPrediction(i + 1, i + 10, DIVINER, 5_000, true, outcome);
        }

        (uint16 baseRateBps, uint256 constantBrier, int256 bss, bool defined) = scoreBook.brierSkill(DIVINER);
        assertEq(baseRateBps, 500, unicode"YES 基础概率应为 5%");
        assertEq(constantBrier, 4_750_000, unicode"经验常数预测 Brier 应为 0.0475");
        assertEq(bss, -426_315_789, unicode"BSS 应以经验基础概率而非 0.25 为参照");
        assertTrue(defined, unicode"同时存在 YES/NO 时 BSS 应有定义");
    }

    function testBrierSkillIsUndefinedForExtremeBaseRateOrUnresolvedSamples() public {
        scoreBook.recordPrediction(1, 1, DIVINER, 9_000, true, true);
        (, uint256 constantBrier, , bool defined) = scoreBook.brierSkill(DIVINER);
        assertEq(constantBrier, 0, unicode"全 YES 的常数参照损失应为零");
        assertTrue(!defined, unicode"参照损失为零时 BSS 必须标为不可定义");

        scoreBook.recordUnresolvedPrediction(2, 2, DIVINER, 5_000);
        (, , , defined) = scoreBook.brierSkill(DIVINER);
        assertTrue(!defined, unicode"含未决惩罚时不得伪造 BSS");
    }

    function testOnlyRecorderCanWrite() public {
        vm.expectRevert(ScoreBook.NotRecorder.selector);
        vm.prank(address(0xBAD));
        scoreBook.recordPrediction(1, 1, DIVINER, 5_000, true, true);
    }

    function testRecorderAndAgentLinkCannotBeReplaced() public {
        vm.expectRevert();
        scoreBook.setRecorder(address(0xBAD));
        assertEq(scoreBook.recorder(), address(this), unicode"记录员绑定后不得替换");

        vm.expectRevert();
        scoreBook.setAgentId(DIVINER, 99);
        assertEq(scoreBook.agentIdOf(DIVINER), 42, unicode"易者身份绑定后不得替换");
    }

    function testStoresReadableDivinationHistory() public {
        scoreBook.recordPrediction(77, 9, DIVINER, 8_000, true, false);
        scoreBook.recordUnresolvedPrediction(78, 10, DIVINER, 6_000);
        assertEq(scoreBook.historyCount(DIVINER), 2, unicode"卦历条数错误");

        ScoreBook.ScoreEntry memory settled = scoreBook.getHistory(DIVINER, 0);
        assertEq(settled.predictionId, 77, unicode"卦历 predictionId 错误");
        assertEq(settled.roundId, 9, unicode"卦历 roundId 错误");
        assertEq(settled.probabilityBps, 8_000, unicode"卦历概率错误");
        assertTrue(!settled.outcome && !settled.correct && !settled.unresolved, unicode"已决卦历内容错误");

        ScoreBook.ScoreEntry memory unresolved = scoreBook.getHistory(DIVINER, 1);
        assertEq(unresolved.predictionId, 78, unicode"未决卦历 predictionId 错误");
        assertEq(unresolved.brier, 100_000_000, unicode"未决卦历惩罚错误");
        assertTrue(unresolved.unresolved, unicode"未决卦历必须显式标记");
    }

    function testBacktestBatchStoresRealTimestampsWithoutPollutingLiveStatsOrReputation() public {
        ScoreBook.BacktestInput[] memory entries = new ScoreBook.BacktestInput[](2);
        entries[0] = _backtestInput(1, 1_000, 1_016, 1_788_000_000, 1_788_000_008, 7_000, true, true);
        entries[1] = _backtestInput(2, 1_020, 1_036, 1_788_000_010, 1_788_000_018, 4_000, false, false);

        scoreBook.recordBacktestBatch(DIVINER, entries);

        ScoreBook.Stats memory liveStats = scoreBook.getStats(DIVINER);
        ScoreBook.Stats memory backtestStats = scoreBook.getBacktestStats(DIVINER);
        assertEq(liveStats.sampleCount, 0, unicode"回放不得混入现场样本");
        assertEq(backtestStats.sampleCount, 2, unicode"回放样本数错误");
        assertEq(backtestStats.correctCount, 2, unicode"回放命中数错误");
        assertEq(backtestStats.totalBrier, 25_000_000, unicode"回放累计 Brier 错误");
        assertEq(reputation.calls(), 0, unicode"回放不得发布成现场 ERC-8004 声誉");
        assertEq(scoreBook.backtestHistoryCount(DIVINER), 2, unicode"回放历史条数错误");

        ScoreBook.BacktestScoreEntry memory first = scoreBook.getBacktestHistory(DIVINER, 0);
        assertTrue(first.backtested, unicode"回放条目必须显式标记 backtested");
        assertEq(first.cutoffTimestamp, 1_788_000_000, unicode"截止块真实时间戳错误");
        assertEq(first.resolutionTimestamp, 1_788_000_008, unicode"结算块真实时间戳错误");
    }

    function testBacktestWriterIsBoundOnceAndRejectsUnauthorizedWrites() public {
        vm.expectRevert(ScoreBook.ReplayRecorderAlreadySet.selector);
        scoreBook.setReplayRecorder(address(0xBAD));

        ScoreBook.BacktestInput[] memory entries = new ScoreBook.BacktestInput[](1);
        entries[0] = _backtestInput(1, 1_000, 1_016, 1_788_000_000, 1_788_000_008, 7_000, true, true);
        vm.expectRevert(ScoreBook.NotReplayRecorder.selector);
        vm.prank(address(0xBAD));
        scoreBook.recordBacktestBatch(DIVINER, entries);
    }

    function testBacktestRejectsDuplicateIdAndInvalidCausalTimeOrder() public {
        ScoreBook.BacktestInput[] memory entries = new ScoreBook.BacktestInput[](1);
        entries[0] = _backtestInput(1, 1_000, 1_016, 1_788_000_000, 1_788_000_008, 7_000, true, true);
        scoreBook.recordBacktestBatch(DIVINER, entries);
        vm.expectRevert(ScoreBook.DuplicateBacktest.selector);
        scoreBook.recordBacktestBatch(DIVINER, entries);

        entries[0] = _backtestInput(2, 1_020, 1_019, 1_788_000_010, 1_788_000_009, 7_000, true, true);
        vm.expectRevert(ScoreBook.InvalidBacktestWindow.selector);
        scoreBook.recordBacktestBatch(DIVINER, entries);
    }

    function _backtestInput(
        uint256 replayId,
        uint64 cutoffBlock,
        uint64 resolutionBlock,
        uint64 cutoffTimestamp,
        uint64 resolutionTimestamp,
        uint16 probabilityBps,
        bool direction,
        bool outcome
    ) private pure returns (ScoreBook.BacktestInput memory) {
        return ScoreBook.BacktestInput({
            replayId: replayId,
            cutoffBlock: cutoffBlock,
            resolutionBlock: resolutionBlock,
            cutoffTimestamp: cutoffTimestamp,
            resolutionTimestamp: resolutionTimestamp,
            probabilityBps: probabilityBps,
            direction: direction,
            outcome: outcome
        });
    }
}
