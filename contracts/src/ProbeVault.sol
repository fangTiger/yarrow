// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @title Arc Testnet 原生 USDC 与 EVM 特性探针
/// @notice 仅用于测试网验证；转出资金的探针只允许部署者调用。
contract ProbeVault {
    address public constant USDC_ERC20 = 0x3600000000000000000000000000000000000000;
    address public constant HISTORY_STORAGE = 0x0000F90827F1C53a10cb7A02335B175320002935;
    uint256 public constant NATIVE_TO_ERC20_SCALE = 1e12;

    bytes32 private constant PROBE_EXISTING = keccak256("TRANSFER_EXISTING");
    bytes32 private constant PROBE_FRESH = keccak256("TRANSFER_FRESH");
    bytes32 private constant PROBE_DRAIN = keccak256("DRAIN");

    address public immutable owner;

    error Unauthorized();
    error InvalidHistoryDistance(uint256 distance, uint256 currentBlock);

    /// @param entryPoint 1 表示 receive，2 表示 fallback。
    event NativeReceived(address indexed sender, uint256 amount, uint8 indexed entryPoint);
    event TransferProbe(
        bytes32 indexed probeId,
        address indexed recipient,
        uint256 amount,
        bool success,
        bytes returnData
    );

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    /// @notice 验证空 calldata 的原生 USDC 接收路径。
    receive() external payable {
        emit NativeReceived(msg.sender, msg.value, 1);
    }

    /// @notice 验证非空且未知 calldata 的原生 USDC 接收路径。
    fallback() external payable {
        emit NativeReceived(msg.sender, msg.value, 2);
    }

    /// @notice 向已存在且有余额的 EOA 转出原生 USDC，并捕获内部调用结果。
    function probeTransferExisting(address payable recipient, uint256 amount)
        external
        onlyOwner
        returns (bool success, bytes memory returnData)
    {
        return _probeTransfer(PROBE_EXISTING, recipient, amount);
    }

    /// @notice 向零余额、零 nonce、无代码的新地址转出原生 USDC，并捕获内部调用结果。
    function probeTransferFresh(address payable recipient, uint256 amount)
        external
        onlyOwner
        returns (bool success, bytes memory returnData)
    {
        return _probeTransfer(PROBE_FRESH, recipient, amount);
    }

    /// @notice 尝试把调用时的合约完整余额转出，并捕获内部调用结果。
    function probeDrain(address payable recipient)
        external
        onlyOwner
        returns (bool success, bytes memory returnData)
    {
        return _probeTransfer(PROBE_DRAIN, recipient, address(this).balance);
    }

    /// @notice 对比原生 18 位余额与 ERC-20 6 位余额的 1e12 换算关系。
    function probeBalanceScale()
        external
        view
        returns (
            bool readSuccess,
            uint256 nativeBalance,
            uint256 erc20Balance,
            uint256 scaledErc20Balance,
            bool exactMatch,
            bytes memory returnData
        )
    {
        nativeBalance = address(this).balance;
        (readSuccess, returnData) = USDC_ERC20.staticcall(
            abi.encodeWithSignature("balanceOf(address)", address(this))
        );
        if (!readSuccess || returnData.length < 32) return (false, nativeBalance, 0, 0, false, returnData);

        erc20Balance = abi.decode(returnData, (uint256));
        if (erc20Balance > type(uint256).max / NATIVE_TO_ERC20_SCALE) {
            return (true, nativeBalance, erc20Balance, 0, false, returnData);
        }
        scaledErc20Balance = erc20Balance * NATIVE_TO_ERC20_SCALE;
        exactMatch = nativeBalance == scaledErc20Balance;
    }

    /// @notice 通过 EIP-2935 历史合约读取当前块之前 distance 块的哈希。
    function probeHistoryHash(uint256 distance)
        external
        view
        returns (uint256 targetBlock, bool readSuccess, bytes32 historyHash, bytes memory returnData)
    {
        if (distance == 0 || distance >= block.number) {
            revert InvalidHistoryDistance(distance, block.number);
        }
        targetBlock = block.number - distance;
        (readSuccess, returnData) = HISTORY_STORAGE.staticcall(abi.encode(targetBlock));
        if (readSuccess && returnData.length >= 32) historyHash = abi.decode(returnData, (bytes32));
    }

    /// @notice 直接返回 PREVRANDAO opcode 的当前值。
    function probePrevRandao() external view returns (uint256 value) {
        value = block.prevrandao;
    }

    /// @notice 对比上一块的 BLOCKHASH opcode 与 EIP-2935 返回值。
    function probePreviousBlockHashComparison()
        external
        view
        returns (
            uint256 targetBlock,
            bytes32 opcodeHash,
            bool historyReadSuccess,
            bytes32 historyHash,
            bool matches,
            bytes memory returnData
        )
    {
        if (block.number == 0) revert InvalidHistoryDistance(1, 0);
        targetBlock = block.number - 1;
        opcodeHash = blockhash(targetBlock);
        (historyReadSuccess, returnData) = HISTORY_STORAGE.staticcall(abi.encode(targetBlock));
        if (historyReadSuccess && returnData.length >= 32) historyHash = abi.decode(returnData, (bytes32));
        matches = historyReadSuccess && opcodeHash != bytes32(0) && opcodeHash == historyHash;
    }

    function _probeTransfer(bytes32 probeId, address payable recipient, uint256 amount)
        private
        returns (bool success, bytes memory returnData)
    {
        (success, returnData) = recipient.call{value: amount}("");
        emit TransferProbe(probeId, recipient, amount, success, returnData);
    }
}

