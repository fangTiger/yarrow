// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @title 六爻派生与文王六十四卦序
library Hexagram {
    // 下标为“初爻最低位、阳=1”的 0..63 二进制索引，值为文王序 1..64。
    bytes internal constant KING_WEN =
        hex"021807130f242e0b103328363e37202208031d3c273f30052d112f3a1f311c2b171b04293416121a23154026381e320e142a3b3d352539090c19060a210d2c01";

    error InvalidHexagramIndex(uint8 index);

    /// @notice 从 seed 的低 18 位派生六爻；每组三位依次对应一爻，初爻在最低三位。
    function derive(bytes32 seed)
        internal
        pure
        returns (
            uint8[6] memory lines,
            uint8 primaryIndex,
            uint8 derivedIndex,
            uint8 primaryKingWen,
            uint8 derivedKingWen
        )
    {
        uint256 bits = uint256(seed);
        for (uint8 i; i < 6; ++i) {
            uint8 coins = uint8((bits >> (uint256(i) * 3)) & 7);
            uint8 heads = (coins & 1) + ((coins >> 1) & 1) + ((coins >> 2) & 1);
            uint8 line = 6 + heads;
            lines[i] = line;

            bool primaryYang = line == 7 || line == 9;
            bool moving = line == 6 || line == 9;
            if (primaryYang) primaryIndex |= uint8(1 << i);
            if (primaryYang != moving) derivedIndex |= uint8(1 << i);
        }
        primaryKingWen = kingWenNumber(primaryIndex);
        derivedKingWen = kingWenNumber(derivedIndex);
    }

    function kingWenNumber(uint8 binaryIndex) internal pure returns (uint8) {
        if (binaryIndex >= 64) revert InvalidHexagramIndex(binaryIndex);
        return uint8(KING_WEN[binaryIndex]);
    }
}
