// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IReputationRegistry} from "./interfaces/IReputationRegistry.sol";

/// @title Brier、经验基础概率、BSS、样本量与 Wilson 95% 区间记账
contract ScoreBook {
    uint256 public constant BRIER_SCALE = 1e8;
    uint256 private constant FIXED_ONE = 1e18;
    uint256 private constant Z_95 = 1_960_000_000_000_000_000;
    uint256 private constant Z2_95 = 3_841_600_000_000_000_000;

    struct Stats {
        uint64 sampleCount;
        uint64 correctCount;
        uint64 unresolvedCount;
        uint256 totalBrier;
    }

    struct ScoreEntry {
        uint256 predictionId;
        uint256 roundId;
        uint16 probabilityBps;
        uint256 brier;
        bool outcome;
        bool correct;
        bool unresolved;
    }

    struct OutcomeStats {
        uint64 decidedCount;
        uint64 yesCount;
    }

    struct BacktestInput {
        uint256 replayId;
        uint64 cutoffBlock;
        uint64 resolutionBlock;
        uint64 cutoffTimestamp;
        uint64 resolutionTimestamp;
        uint16 probabilityBps;
        bool direction;
        bool outcome;
    }

    struct BacktestScoreEntry {
        uint256 replayId;
        uint64 cutoffBlock;
        uint64 resolutionBlock;
        uint64 cutoffTimestamp;
        uint64 resolutionTimestamp;
        uint16 probabilityBps;
        uint256 brier;
        bool outcome;
        bool correct;
        bool backtested;
    }

    address public immutable owner;
    IReputationRegistry public immutable reputationRegistry;
    address public recorder;
    address public replayRecorder;

    mapping(address => Stats) private _stats;
    mapping(address => OutcomeStats) private _outcomeStats;
    mapping(address => ScoreEntry[]) private _history;
    mapping(address => Stats) private _backtestStats;
    mapping(address => OutcomeStats) private _backtestOutcomeStats;
    mapping(address => BacktestScoreEntry[]) private _backtestHistory;
    mapping(address => mapping(uint256 => bool)) public hasBacktest;
    mapping(address => uint256) public agentIdOf;
    mapping(address => bool) public hasAgentId;

    error InvalidAddress();
    error InvalidProbability();
    error AgentAlreadyLinked();
    error DuplicateBacktest();
    error InvalidBacktestWindow();
    error NotOwner();
    error NotRecorder();
    error NotReplayRecorder();
    error RecorderAlreadySet();
    error ReplayRecorderAlreadySet();

    event RecorderSet(address indexed recorder);
    event ReplayRecorderSet(address indexed recorder);
    event AgentLinked(address indexed diviner, uint256 indexed agentId);
    event ScoreRecorded(
        address indexed diviner,
        uint256 indexed predictionId,
        uint256 indexed roundId,
        uint256 brier,
        bool outcome,
        bool correct,
        bool unresolved
    );
    event BacktestScoreRecorded(
        address indexed diviner,
        uint256 indexed replayId,
        uint64 cutoffTimestamp,
        uint64 resolutionTimestamp,
        uint256 brier,
        bool outcome,
        bool correct,
        bool backtested
    );

    constructor(address reputationRegistry_) {
        owner = msg.sender;
        reputationRegistry = IReputationRegistry(reputationRegistry_);
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyRecorder() {
        if (msg.sender != recorder) revert NotRecorder();
        _;
    }

    modifier onlyReplayRecorder() {
        if (msg.sender != replayRecorder) revert NotReplayRecorder();
        _;
    }

    function setRecorder(address recorder_) external onlyOwner {
        if (recorder_ == address(0)) revert InvalidAddress();
        if (recorder != address(0)) revert RecorderAlreadySet();
        recorder = recorder_;
        emit RecorderSet(recorder_);
    }

    function setReplayRecorder(address recorder_) external onlyOwner {
        if (recorder_ == address(0)) revert InvalidAddress();
        if (replayRecorder != address(0)) revert ReplayRecorderAlreadySet();
        replayRecorder = recorder_;
        emit ReplayRecorderSet(recorder_);
    }

    function setAgentId(address diviner, uint256 agentId) external onlyOwner {
        if (diviner == address(0)) revert InvalidAddress();
        if (hasAgentId[diviner]) revert AgentAlreadyLinked();
        agentIdOf[diviner] = agentId;
        hasAgentId[diviner] = true;
        emit AgentLinked(diviner, agentId);
    }

    function recordPrediction(
        uint256 predictionId,
        uint256 roundId,
        address diviner,
        uint16 probabilityBps,
        bool direction,
        bool outcome
    ) external onlyRecorder returns (uint256 brier) {
        if (probabilityBps < 100 || probabilityBps > 9_900) revert InvalidProbability();
        uint256 outcomeBps = outcome ? 10_000 : 0;
        uint256 distance =
            probabilityBps > outcomeBps ? uint256(probabilityBps) - outcomeBps : outcomeBps - uint256(probabilityBps);
        brier = distance * distance;
        bool correct = direction == outcome;

        Stats storage stats = _stats[diviner];
        ++stats.sampleCount;
        if (correct) ++stats.correctCount;
        stats.totalBrier += brier;
        OutcomeStats storage outcomes = _outcomeStats[diviner];
        ++outcomes.decidedCount;
        if (outcome) ++outcomes.yesCount;
        _history[diviner].push(
            ScoreEntry({
                predictionId: predictionId,
                roundId: roundId,
                probabilityBps: probabilityBps,
                brier: brier,
                outcome: outcome,
                correct: correct,
                unresolved: false
            })
        );
        _publish(diviner, brier, "settled");
        emit ScoreRecorded(diviner, predictionId, roundId, brier, outcome, correct, false);
    }

    /// @notice 未决之卦计入一个最大 Brier 损失，防止靠质疑逃避评分。
    function recordUnresolvedPrediction(uint256 predictionId, uint256 roundId, address diviner, uint16 probabilityBps)
        external
        onlyRecorder
    {
        Stats storage stats = _stats[diviner];
        ++stats.sampleCount;
        ++stats.unresolvedCount;
        stats.totalBrier += BRIER_SCALE;
        _history[diviner].push(
            ScoreEntry({
                predictionId: predictionId,
                roundId: roundId,
                probabilityBps: probabilityBps,
                brier: BRIER_SCALE,
                outcome: false,
                correct: false,
                unresolved: true
            })
        );
        _publish(diviner, BRIER_SCALE, "unresolved");
        emit ScoreRecorded(diviner, predictionId, roundId, BRIER_SCALE, false, false, true);
    }

    function getStats(address diviner) external view returns (Stats memory) {
        return _stats[diviner];
    }

    function averageBrier(address diviner) external view returns (uint256) {
        Stats storage stats = _stats[diviner];
        if (stats.sampleCount == 0) return 0;
        return stats.totalBrier / stats.sampleCount;
    }

    function historyCount(address diviner) external view returns (uint256) {
        return _history[diviner].length;
    }

    function getHistory(address diviner, uint256 index) external view returns (ScoreEntry memory) {
        return _history[diviner][index];
    }

    /// @notice 回放记录与现场账本完全分离，且不发布为 ERC-8004 现场声誉。
    function recordBacktestBatch(address diviner, BacktestInput[] calldata entries) external onlyReplayRecorder {
        if (diviner == address(0)) revert InvalidAddress();
        Stats storage stats = _backtestStats[diviner];
        for (uint256 index = 0; index < entries.length; ++index) {
            BacktestInput calldata entry = entries[index];
            if (entry.probabilityBps < 100 || entry.probabilityBps > 9_900) revert InvalidProbability();
            if (entry.cutoffBlock >= entry.resolutionBlock || entry.cutoffTimestamp >= entry.resolutionTimestamp) {
                revert InvalidBacktestWindow();
            }
            if (hasBacktest[diviner][entry.replayId]) revert DuplicateBacktest();
            hasBacktest[diviner][entry.replayId] = true;

            uint256 outcomeBps = entry.outcome ? 10_000 : 0;
            uint256 distance = entry.probabilityBps > outcomeBps
                ? uint256(entry.probabilityBps) - outcomeBps
                : outcomeBps - uint256(entry.probabilityBps);
            uint256 brier = distance * distance;
            bool correct = entry.direction == entry.outcome;
            ++stats.sampleCount;
            if (correct) ++stats.correctCount;
            stats.totalBrier += brier;
            OutcomeStats storage outcomes = _backtestOutcomeStats[diviner];
            ++outcomes.decidedCount;
            if (entry.outcome) ++outcomes.yesCount;
            _backtestHistory[diviner].push(
                BacktestScoreEntry({
                    replayId: entry.replayId,
                    cutoffBlock: entry.cutoffBlock,
                    resolutionBlock: entry.resolutionBlock,
                    cutoffTimestamp: entry.cutoffTimestamp,
                    resolutionTimestamp: entry.resolutionTimestamp,
                    probabilityBps: entry.probabilityBps,
                    brier: brier,
                    outcome: entry.outcome,
                    correct: correct,
                    backtested: true
                })
            );
            emit BacktestScoreRecorded(
                diviner,
                entry.replayId,
                entry.cutoffTimestamp,
                entry.resolutionTimestamp,
                brier,
                entry.outcome,
                correct,
                true
            );
        }
    }

    function getBacktestStats(address diviner) external view returns (Stats memory) {
        return _backtestStats[diviner];
    }

    function backtestAverageBrier(address diviner) external view returns (uint256) {
        Stats storage stats = _backtestStats[diviner];
        if (stats.sampleCount == 0) return 0;
        return stats.totalBrier / stats.sampleCount;
    }

    function backtestHistoryCount(address diviner) external view returns (uint256) {
        return _backtestHistory[diviner].length;
    }

    function getBacktestHistory(address diviner, uint256 index) external view returns (BacktestScoreEntry memory) {
        return _backtestHistory[diviner][index];
    }

    /// @notice 返回按基点表示的 Wilson 95% 胜率区间。
    function wilson95(address diviner) external view returns (uint16 lowerBps, uint16 upperBps) {
        return _wilson95(_stats[diviner]);
    }

    function backtestWilson95(address diviner) external view returns (uint16 lowerBps, uint16 upperBps) {
        return _wilson95(_backtestStats[diviner]);
    }

    /// @notice BSS 以该易者全部已决样本的经验 YES 概率常数预测为参照，数值使用 1e8 精度。
    /// @dev 极端基础概率或含未决惩罚时参照不可比较，defined=false。
    function brierSkill(address diviner)
        external
        view
        returns (uint16 empiricalBaseRateBps, uint256 constantBaselineBrier, int256 bss, bool defined)
    {
        return _brierSkill(_stats[diviner], _outcomeStats[diviner]);
    }

    function backtestBrierSkill(address diviner)
        external
        view
        returns (uint16 empiricalBaseRateBps, uint256 constantBaselineBrier, int256 bss, bool defined)
    {
        return _brierSkill(_backtestStats[diviner], _backtestOutcomeStats[diviner]);
    }

    function _brierSkill(Stats storage stats, OutcomeStats storage outcomes)
        private
        view
        returns (uint16 empiricalBaseRateBps, uint256 constantBaselineBrier, int256 bss, bool defined)
    {
        uint256 n = outcomes.decidedCount;
        if (n == 0) return (0, 0, 0, false);
        uint256 yes = outcomes.yesCount;
        uint256 no = n - yes;
        empiricalBaseRateBps = uint16((yes * 10_000 + n / 2) / n);
        constantBaselineBrier = yes * no * BRIER_SCALE / (n * n);
        if (yes == 0 || no == 0 || stats.unresolvedCount != 0 || stats.sampleCount != n) {
            return (empiricalBaseRateBps, constantBaselineBrier, 0, false);
        }
        uint256 referenceTotalBrier = yes * no * BRIER_SCALE / n;
        int256 signedReference = int256(referenceTotalBrier);
        bss = (signedReference - int256(stats.totalBrier)) * int256(BRIER_SCALE) / signedReference;
        defined = true;
    }

    function _wilson95(Stats storage stats) private view returns (uint16 lowerBps, uint16 upperBps) {
        uint256 n = stats.sampleCount;
        if (n == 0) return (0, 10_000);

        uint256 successes = stats.correctCount;
        uint256 p = successes * FIXED_ONE / n;
        uint256 denominator = FIXED_ONE + Z2_95 / n;
        uint256 center = (p + Z2_95 / (2 * n)) * FIXED_ONE / denominator;
        uint256 variance = (p * (FIXED_ONE - p) / FIXED_ONE) / n + Z2_95 / (4 * n * n);
        uint256 root = _sqrt(variance * FIXED_ONE);
        uint256 half = (Z_95 * root / FIXED_ONE) * FIXED_ONE / denominator;

        uint256 lower = center > half ? center - half : 0;
        uint256 upper = center + half > FIXED_ONE ? FIXED_ONE : center + half;
        lowerBps = successes == 0 ? 0 : uint16(lower * 10_000 / FIXED_ONE);
        upperBps = successes == n ? 10_000 : uint16(upper * 10_000 / FIXED_ONE);
    }

    function _publish(address diviner, uint256 brier, string memory status) private {
        if (address(reputationRegistry) == address(0) || !hasAgentId[diviner]) return;
        reputationRegistry.giveFeedback(
            agentIdOf[diviner], int128(int256(brier)), 8, "brier", status, "", "", bytes32(0)
        );
    }

    function _sqrt(uint256 value) private pure returns (uint256 result) {
        if (value == 0) return 0;
        result = 1 << (log2(value) >> 1);
        unchecked {
            result = (result + value / result) >> 1;
            result = (result + value / result) >> 1;
            result = (result + value / result) >> 1;
            result = (result + value / result) >> 1;
            result = (result + value / result) >> 1;
            result = (result + value / result) >> 1;
            result = (result + value / result) >> 1;
            uint256 roundedDown = value / result;
            return result < roundedDown ? result : roundedDown;
        }
    }

    function log2(uint256 value) private pure returns (uint256 result) {
        if (value >> 128 > 0) {
            value >>= 128;
            result += 128;
        }
        if (value >> 64 > 0) {
            value >>= 64;
            result += 64;
        }
        if (value >> 32 > 0) {
            value >>= 32;
            result += 32;
        }
        if (value >> 16 > 0) {
            value >>= 16;
            result += 16;
        }
        if (value >> 8 > 0) {
            value >>= 8;
            result += 8;
        }
        if (value >> 4 > 0) {
            value >>= 4;
            result += 4;
        }
        if (value >> 2 > 0) {
            value >>= 2;
            result += 2;
        }
        if (value >> 1 > 0) result += 1;
    }
}
