// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Hexagram} from "../src/lib/Hexagram.sol";
import {TestBase} from "./support/TestBase.sol";

contract HexagramTest is TestBase {
    function testAllHeadsProducesQianChangingToKun() public pure {
        bytes32 seed = bytes32((uint256(1) << 18) - 1);
        (uint8[6] memory lines, uint8 primary, uint8 derived, uint8 primaryKingWen, uint8 derivedKingWen) =
            Hexagram.derive(seed);

        for (uint256 i; i < 6; ++i) {
            assertEq(lines[i], 9, unicode"全正面每爻都应为老阳");
        }
        assertEq(primary, 63, unicode"乾卦二进制索引错误");
        assertEq(derived, 0, unicode"六个老阳应变为坤");
        assertEq(primaryKingWen, 1, unicode"乾应为文王序 1");
        assertEq(derivedKingWen, 2, unicode"坤应为文王序 2");
    }

    function testAllTailsProducesKunChangingToQian() public pure {
        (uint8[6] memory lines, uint8 primary, uint8 derived, uint8 primaryKingWen, uint8 derivedKingWen) =
            Hexagram.derive(bytes32(0));

        for (uint256 i; i < 6; ++i) {
            assertEq(lines[i], 6, unicode"全反面每爻都应为老阴");
        }
        assertEq(primary, 0, unicode"坤卦二进制索引错误");
        assertEq(derived, 63, unicode"六个老阴应变为乾");
        assertEq(primaryKingWen, 2, unicode"坤应为文王序 2");
        assertEq(derivedKingWen, 1, unicode"乾应为文王序 1");
    }

    function testLinesAreStoredBottomUpAndMovingLinesFlip() public pure {
        uint256 bits = uint256(1) | (uint256(3) << 3) | (uint256(7) << 6) | (uint256(0) << 9) | (uint256(2) << 12)
            | (uint256(6) << 15);
        (uint8[6] memory lines, uint8 primary, uint8 derived,,) = Hexagram.derive(bytes32(bits));

        uint8[6] memory expectedLines = [uint8(7), 8, 9, 6, 7, 8];
        for (uint256 i; i < 6; ++i) {
            assertEq(lines[i], expectedLines[i], unicode"六爻自下而上顺序错误");
        }
        assertEq(primary, 21, unicode"本卦索引错误");
        assertEq(derived, 25, unicode"之卦索引错误");
    }

    function testKnownKingWenNumbers() public pure {
        assertEq(Hexagram.kingWenNumber(63), 1, unicode"乾序号错误");
        assertEq(Hexagram.kingWenNumber(0), 2, unicode"坤序号错误");
        assertEq(Hexagram.kingWenNumber(17), 3, unicode"屯序号错误");
        assertEq(Hexagram.kingWenNumber(34), 4, unicode"蒙序号错误");
        assertEq(Hexagram.kingWenNumber(21), 63, unicode"既济序号错误");
        assertEq(Hexagram.kingWenNumber(42), 64, unicode"未济序号错误");
    }

    function testCompleteKingWenLookupPermutation() public pure {
        uint8[64] memory expected = [
            uint8(2),
            24,
            7,
            19,
            15,
            36,
            46,
            11,
            16,
            51,
            40,
            54,
            62,
            55,
            32,
            34,
            8,
            3,
            29,
            60,
            39,
            63,
            48,
            5,
            45,
            17,
            47,
            58,
            31,
            49,
            28,
            43,
            23,
            27,
            4,
            41,
            52,
            22,
            18,
            26,
            35,
            21,
            64,
            38,
            56,
            30,
            50,
            14,
            20,
            42,
            59,
            61,
            53,
            37,
            57,
            9,
            12,
            25,
            6,
            10,
            33,
            13,
            44,
            1
        ];
        bool[65] memory seen;
        for (uint8 index; index < 64; ++index) {
            uint8 actual = Hexagram.kingWenNumber(index);
            assertEq(actual, expected[index], unicode"文王序查表项错误");
            assertTrue(!seen[actual], unicode"文王序不得重复");
            seen[actual] = true;
        }
    }

    function testHighSeedBitsDoNotAffectCasting() public pure {
        (, uint8 lowPrimary, uint8 lowDerived,,) = Hexagram.derive(bytes32((uint256(1) << 18) - 1));
        (, uint8 highPrimary, uint8 highDerived,,) = Hexagram.derive(bytes32(type(uint256).max));
        assertEq(lowPrimary, highPrimary, unicode"只应读取 seed 的低 18 位");
        assertEq(lowDerived, highDerived, unicode"高位不得影响之卦");
    }
}
