// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {RiskMath} from "../src/lib/RiskMath.sol";
import {TestBase} from "./support/TestBase.sol";

contract RiskMathTest is TestBase {
    function testNoHistoryUsesPriorAndClampsToMinimum() public pure {
        assertEq(RiskMath.kellyBps(0, 0), 0, unicode"无历史的 Beta(1,1) 后验无正优势");
        assertEq(RiskMath.multiplier(100_000_000, 1_000_000, 0, 0, 1, 10), 1, unicode"无历史取最小倍率");
    }

    function testAllCorrectRaisesKellyAndMultiplier() public pure {
        assertEq(RiskMath.kellyBps(10, 0), 8_333, unicode"十次全对的后验 Kelly 比例错误");
        assertEq(RiskMath.multiplier(12_000_000, 1_000_000, 10, 0, 1, 10), 9, unicode"全对倍率错误");
    }

    function testAllWrongClampsToMinimum() public pure {
        uint256 worstBrierSum = 10 * RiskMath.BRIER_SCALE;
        assertEq(RiskMath.kellyBps(10, worstBrierSum), 0, unicode"全错不应有正 Kelly 比例");
        assertEq(
            RiskMath.multiplier(1_000_000_000, 1_000_000, 10, worstBrierSum, 2, 20),
            2,
            unicode"全错必须夹到最小倍率"
        );
    }

    function testThickerVaultNeverProducesSmallerMultiplier() public pure {
        uint16 thin = RiskMath.multiplier(4_000_000, 1_000_000, 20, 100_000_000, 1, 20);
        uint16 thick = RiskMath.multiplier(40_000_000, 1_000_000, 20, 100_000_000, 1, 20);
        assertTrue(thick >= thin, unicode"金库更厚时倍率不得下降");
    }

    function testBetterHistoryNeverProducesSmallerMultiplier() public pure {
        uint16 accurate = RiskMath.multiplier(20_000_000, 1_000_000, 20, 50_000_000, 1, 20);
        uint16 inaccurate = RiskMath.multiplier(20_000_000, 1_000_000, 20, 1_500_000_000, 1, 20);
        assertTrue(accurate >= inaccurate, unicode"历史更准时倍率不得下降");
    }

    function testMultiplierClampsBothBounds() public pure {
        assertEq(RiskMath.multiplier(1, 1_000_000, 0, 0, 3, 9), 3, unicode"下界夹取失败");
        assertEq(RiskMath.multiplier(1e24, 1, 100, 0, 3, 9), 9, unicode"上界夹取失败");
    }
}
