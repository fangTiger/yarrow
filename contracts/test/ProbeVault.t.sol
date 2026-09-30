// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ProbeVault} from "../src/ProbeVault.sol";

interface Vm {
    function deal(address account, uint256 newBalance) external;
    function prank(address sender) external;
    function expectRevert(bytes calldata revertData) external;
    function mockCall(address callee, bytes calldata data, bytes calldata returnData) external;
    function roll(uint256 newHeight) external;
    function setBlockhash(uint256 blockNumber, bytes32 blockHash) external;
}

contract RevertingReceiver {
    receive() external payable {
        revert(unicode"拒绝接收");
    }
}

contract ProbeVaultTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant USDC = 0x3600000000000000000000000000000000000000;
    address private constant HISTORY = 0x0000F90827F1C53a10cb7A02335B175320002935;

    ProbeVault private vault;

    function setUp() public {
        vault = new ProbeVault();
        vm.deal(address(this), 10 ether);
    }

    function testReceiveAndFallbackAcceptNativeUsdc() public {
        (bool receiveOk,) = address(vault).call{value: 1e12}("");
        require(receiveOk, unicode"receive 应成功");

        (bool fallbackOk,) = address(vault).call{value: 2e12}(hex"deadbeef");
        require(fallbackOk, unicode"fallback 应成功");
        require(address(vault).balance == 3e12, unicode"接收余额错误");
    }

    function testOnlyOwnerCanRunTransferProbe() public {
        vm.expectRevert(abi.encodeWithSelector(ProbeVault.Unauthorized.selector));
        vm.prank(address(0xBAD));
        vault.probeTransferExisting(payable(address(0xBEEF)), 1);
    }

    function testExistingTransferReturnsSuccess() public {
        vm.deal(address(vault), 2e12);
        address payable receiver = payable(address(0xBEEF));
        (bool success, bytes memory returnData) = vault.probeTransferExisting(receiver, 1e12);

        require(success, unicode"已有地址转账应成功");
        require(returnData.length == 0, unicode"成功调用不应返回数据");
        require(receiver.balance == 1e12, unicode"接收方余额错误");
    }

    function testFreshTransferCapturesInnerRevert() public {
        vm.deal(address(vault), 2e12);
        RevertingReceiver receiver = new RevertingReceiver();
        (bool success, bytes memory returnData) = vault.probeTransferFresh(payable(address(receiver)), 1e12);

        require(!success, unicode"内部回滚必须被捕获");
        require(returnData.length > 0, unicode"必须保留回滚数据");
        require(address(vault).balance == 2e12, unicode"失败后余额不应变化");
    }

    function testDrainTransfersCompleteBalance() public {
        vm.deal(address(vault), 3e12);
        address payable receiver = payable(address(0xCAFE));
        (bool success,) = vault.probeDrain(receiver);

        require(success, unicode"清空余额应成功");
        require(address(vault).balance == 0, unicode"合约余额必须清零");
        require(receiver.balance == 3e12, unicode"接收方应收到完整余额");
    }

    function testBalanceScaleComparesNative18AndErc20SixDecimals() public {
        vm.deal(address(vault), 12_345_678 * 1e12);
        vm.mockCall(
            USDC,
            abi.encodeWithSignature("balanceOf(address)", address(vault)),
            abi.encode(uint256(12_345_678))
        );

        (bool readSuccess, uint256 nativeBalance, uint256 erc20Balance, uint256 scaledBalance, bool exactMatch,) =
            vault.probeBalanceScale();

        require(readSuccess, unicode"ERC-20 读取应成功");
        require(nativeBalance == 12_345_678 * 1e12, unicode"原生余额错误");
        require(erc20Balance == 12_345_678, unicode"ERC-20 余额错误");
        require(scaledBalance == nativeBalance, unicode"换算余额错误");
        require(exactMatch, unicode"18 位与 6 位应精确对应");
    }

    function testHistoryHashUsesEip2935AddressAndBlockNumber() public {
        vm.roll(100);
        uint256 distance = 1;
        uint256 targetBlock = block.number - distance;
        bytes32 expectedHash = keccak256(unicode"历史哈希");
        vm.mockCall(HISTORY, abi.encode(targetBlock), abi.encode(expectedHash));

        (uint256 returnedBlock, bool readSuccess, bytes32 returnedHash,) = vault.probeHistoryHash(distance);

        require(readSuccess, unicode"历史合约读取应成功");
        require(returnedBlock == targetBlock, unicode"目标块高错误");
        require(returnedHash == expectedHash, unicode"历史哈希错误");
    }

    function testPrevRandaoReturnsCurrentOpcodeValue() public view {
        require(vault.probePrevRandao() == block.prevrandao, unicode"PREVRANDAO 读取错误");
    }

    function testPreviousBlockComparisonReturnsBothSources() public {
        vm.roll(100);
        uint256 targetBlock = block.number - 1;
        bytes32 opcodeHash = keccak256(unicode"上一块哈希");
        vm.setBlockhash(targetBlock, opcodeHash);
        vm.mockCall(HISTORY, abi.encode(targetBlock), abi.encode(opcodeHash));

        (uint256 returnedBlock, bytes32 returnedOpcode, bool readSuccess, bytes32 returnedHistory, bool matches,) =
            vault.probePreviousBlockHashComparison();

        require(readSuccess, unicode"历史合约读取应成功");
        require(returnedBlock == targetBlock, unicode"上一块块高错误");
        require(returnedOpcode == opcodeHash, unicode"opcode 哈希错误");
        require(returnedHistory == opcodeHash, unicode"历史合约哈希错误");
        require(matches, unicode"两个来源应一致");
    }
}
