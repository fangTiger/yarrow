// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @title 恰当评分结算数学
/// @notice 所有金额均为 ERC-20 USDC 的 6 位整数单位。
library SettlementMath {
    uint256 internal constant SCORE_SCALE = 1e8;
    uint16 internal constant MIN_PROBABILITY_BPS = 100;
    uint16 internal constant MAX_PROBABILITY_BPS = 9_900;

    error InvalidDistance(uint16 distance);
    error InvalidMultiplier();
    error InvalidProbability(uint16 probabilityBps);
    error UnsafeFee(uint256 fee, uint16 multiplier);

    /// @notice 返回给定倍率下可安全代入最坏分数因子 -3e8 的最大 F。
    function maxSafeFee(uint16 multiplier) internal pure returns (uint256) {
        if (multiplier == 0) revert InvalidMultiplier();
        return uint256(type(int256).max) / uint256(multiplier) / (3 * SCORE_SCALE);
    }

    /// @notice 按偏差 d 直接计算 ΔB，供端点性质与正式结算共同使用。
    /// @dev 严格采用 int256 全程有符号、先乘后除。Solidity 的有符号整除向零取整，
    ///      因而正负非整除结果都不会向负无穷取整。
    function deltaFromDistance(uint256 fee, uint16 multiplier, uint16 distance) internal pure returns (int256 delta) {
        if (distance > 10_000) revert InvalidDistance(distance);
        if (multiplier == 0) revert InvalidMultiplier();
        if (fee > maxSafeFee(multiplier)) revert UnsafeFee(fee, multiplier);

        int256 d = int256(uint256(distance));
        int256 numerator = int256(uint256(multiplier)) * int256(fee) * (int256(1e8) - 4 * d * d);
        delta = numerator / int256(1e8);
    }

    /// @notice probabilityBps 始终表示 YES 概率；YES 的 o=10000，NO 的 o=0。
    function scoreDelta(uint256 fee, uint16 multiplier, uint16 probabilityBps, bool outcome)
        internal
        pure
        returns (int256)
    {
        if (probabilityBps < MIN_PROBABILITY_BPS || probabilityBps > MAX_PROBABILITY_BPS) {
            revert InvalidProbability(probabilityBps);
        }
        uint16 distance = outcome ? uint16(10_000 - probabilityBps) : probabilityBps;
        return deltaFromDistance(fee, multiplier, distance);
    }

    /// @notice 最大可能损失对应的金库预留 3·m·F。
    function reserveAmount(uint256 fee, uint16 multiplier) internal pure returns (uint256) {
        if (multiplier == 0) revert InvalidMultiplier();
        if (fee > maxSafeFee(multiplier)) revert UnsafeFee(fee, multiplier);
        return 3 * uint256(multiplier) * fee;
    }
}
