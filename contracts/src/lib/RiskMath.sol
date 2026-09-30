// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @title 基于历史 Brier 分数的确定性身銭倍率
library RiskMath {
    uint256 internal constant BRIER_SCALE = 1e8;
    uint256 internal constant BPS = 10_000;

    error InvalidFee();
    error InvalidBounds(uint16 minimum, uint16 maximum);
    error InvalidBrierHistory(uint64 sampleCount, uint256 totalBrier);

    /// @notice 计算偶赔率下的 Kelly 风险比例，返回基点。
    /// @dev 把每次预测的 `1 - Brier` 当作 [0,1] 的分数成功量，并使用 Beta(1,1) 先验：
    ///      a = 1 + Σ(1-Brier)，b = 1 + ΣBrier，后验均值 r=a/(a+b)。
    ///      偶赔率的 Kelly 最优比例为 max(0, 2r-1)。因此无历史时 r=1/2、比例为 0；
    ///      历史 Brier 越低，a 越大，风险比例单调上升。
    function kellyBps(uint64 sampleCount, uint256 totalBrier) internal pure returns (uint16) {
        uint256 maximumBrier = uint256(sampleCount) * BRIER_SCALE;
        if (totalBrier > maximumBrier) revert InvalidBrierHistory(sampleCount, totalBrier);

        uint256 successCredit = maximumBrier - totalBrier;
        uint256 denominator = (uint256(sampleCount) + 2) * BRIER_SCALE;
        uint256 twiceSuccess = 2 * (BRIER_SCALE + successCredit);
        if (twiceSuccess <= denominator) return 0;
        return uint16(((twiceSuccess - denominator) * BPS) / denominator);
    }

    /// @notice m=floor(kelly·B/F)，随后夹在 [mMin,mMax]。
    /// @dev kellyBps 最大为 10000；调用方使用实际 USDC 金库余额，故乘积在正常资金范围内。
    function multiplier(uint256 bankroll, uint256 fee, uint64 sampleCount, uint256 totalBrier, uint16 mMin, uint16 mMax)
        internal
        pure
        returns (uint16)
    {
        if (fee == 0) revert InvalidFee();
        if (mMin == 0 || mMin > mMax) revert InvalidBounds(mMin, mMax);

        uint256 riskBps = kellyBps(sampleCount, totalBrier);
        if (riskBps == 0) return mMin;

        // 在已确定会超过上界时先返回，既保持精确夹取，也避免无意义的大数乘法。
        uint256 saturationBankroll = (uint256(mMax) * fee * BPS + riskBps - 1) / riskBps;
        if (bankroll >= saturationBankroll) return mMax;

        uint256 raw = (bankroll * riskBps) / (fee * BPS);
        if (raw < mMin) return mMin;
        if (raw > mMax) return mMax;
        return uint16(raw);
    }
}
