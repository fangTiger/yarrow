// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {SettlementMath} from "../src/lib/SettlementMath.sol";
import {TestBase} from "./support/TestBase.sol";

contract SettlementMathHarness {
    function scoreDelta(uint256 fee, uint16 multiplier, uint16 probabilityBps, bool outcome)
        external
        pure
        returns (int256)
    {
        return SettlementMath.scoreDelta(fee, multiplier, probabilityBps, outcome);
    }
}

contract SettlementMathTest is TestBase {
    SettlementMathHarness private harness;

    function setUp() public {
        harness = new SettlementMathHarness();
    }

    function testExactDistanceEndpoints() public pure {
        uint256 fee = 1_234_567;
        uint16 multiplier = 9;
        int256 stake = int256(uint256(multiplier) * fee);

        assertEq(SettlementMath.deltaFromDistance(fee, multiplier, 0), stake, unicode"完全命中应赚 mF");
        assertEq(SettlementMath.deltaFromDistance(fee, multiplier, 5_000), 0, unicode"五成对冲应为零");
        assertEq(SettlementMath.deltaFromDistance(fee, multiplier, 10_000), -3 * stake, unicode"完全反向应亏 3mF");
    }

    function testSignedDivisionRoundsTowardZero() public pure {
        assertEq(SettlementMath.deltaFromDistance(1, 1, 1), 0, unicode"正数小数应向零舍入");
        assertEq(SettlementMath.deltaFromDistance(1, 1, 5_001), 0, unicode"负数小数应向零舍入");
    }

    function testProperScoringRuleExhaustiveScan() public pure {
        uint16[6] memory beliefs = [uint16(100), 1_234, 3_700, 5_000, 7_311, 9_900];
        uint256 fee = 1_000_000_000_000;
        uint16 multiplier = 7;

        for (uint256 qIndex; qIndex < beliefs.length; ++qIndex) {
            uint16 q = beliefs[qIndex];
            int256 bestValue = type(int256).min;
            uint16 bestProbability;
            for (uint16 p = 100; p <= 9_900; ++p) {
                int256 yesDelta = SettlementMath.scoreDelta(fee, multiplier, p, true);
                int256 noDelta = SettlementMath.scoreDelta(fee, multiplier, p, false);
                int256 expectedNumerator = int256(uint256(q)) * yesDelta + int256(uint256(10_000 - q)) * noDelta;
                if (expectedNumerator > bestValue) {
                    bestValue = expectedNumerator;
                    bestProbability = p;
                }
            }
            uint256 distance = bestProbability > q ? bestProbability - q : q - bestProbability;
            assertTrue(distance <= 1, unicode"期望收益最大值必须在真实概率一基点内");
        }
    }

    function testDeltaIsMonotoneInDistance() public pure {
        int256 previous = SettlementMath.deltaFromDistance(10_000_000, 10, 0);
        for (uint16 distance = 1; distance <= 10_000; ++distance) {
            int256 current = SettlementMath.deltaFromDistance(10_000_000, 10, distance);
            assertTrue(current <= previous, unicode"偏差增大时收益不得上升");
            previous = current;
        }
    }

    function testYesNoSymmetry() public pure {
        uint256 fee = 73_000_001;
        uint16 multiplier = 11;
        for (uint16 probability = 100; probability <= 9_900; probability += 97) {
            assertEq(
                SettlementMath.scoreDelta(fee, multiplier, probability, true),
                SettlementMath.scoreDelta(fee, multiplier, 10_000 - probability, false),
                unicode"YES/NO 镜像概率应完全对称"
            );
        }
    }

    function testLargestDocumentedSafeFeeDoesNotOverflow() public pure {
        uint16 multiplier = type(uint16).max;
        uint256 fee = SettlementMath.maxSafeFee(multiplier);
        int256 delta = SettlementMath.deltaFromDistance(fee, multiplier, 10_000);
        assertEq(delta, -int256(3 * uint256(multiplier) * fee), unicode"安全上界必须精确计算且不溢出");
    }

    function testScoreProbabilityRangeIsStrict() public {
        vm.expectRevert(abi.encodeWithSelector(SettlementMath.InvalidProbability.selector, uint16(99)));
        harness.scoreDelta(1_000_000, 1, 99, true);

        vm.expectRevert(abi.encodeWithSelector(SettlementMath.InvalidProbability.selector, uint16(9_901)));
        harness.scoreDelta(1_000_000, 1, 9_901, false);
    }

    function testFuzzDeltaNeverExceedsReserve(uint256 rawFee, uint16 rawMultiplier, uint16 rawProbability, bool outcome)
        public
        pure
    {
        uint256 fee = (rawFee % 1e24) + 1;
        uint16 multiplier = uint16((uint256(rawMultiplier) % 100) + 1);
        uint16 probability = uint16((uint256(rawProbability) % 9_801) + 100);
        int256 delta = SettlementMath.scoreDelta(fee, multiplier, probability, outcome);
        int256 stake = int256(uint256(multiplier) * fee);
        assertTrue(delta <= stake, unicode"收益不得超过 mF");
        assertTrue(delta >= -3 * stake, unicode"损失不得超过 3mF");
    }
}
