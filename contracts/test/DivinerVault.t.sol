// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {DivinerVault} from "../src/DivinerVault.sol";
import {TestBase} from "./support/TestBase.sol";
import {MockERC20} from "./support/MockERC20.sol";

contract DivinerVaultTest is TestBase {
    address private constant DIVINER = address(0xD1);
    address private constant QUERENT = address(0xA11CE);
    MockERC20 private token;
    DivinerVault private vault;

    function setUp() public {
        token = new MockERC20();
        vault = new DivinerVault(address(token), address(this), DIVINER, 1, 10);
        token.mint(address(this), 2_000_000_000);
        token.approve(address(vault), type(uint256).max);
        vault.deposit(1_000_000_000);
    }

    function testReserveUsesExactThreeTimesMultiplierFee() public {
        bool accepted = vault.reserve(1, 10_000_000, 2);
        assertTrue(accepted, unicode"资金充足时应接受预留");
        assertEq(vault.reservedTotal(), 60_000_000, unicode"预留必须等于 3mF");
        assertEq(vault.availableBalance(), 940_000_000, unicode"可用余额错误");
    }

    function testNegativeSettlementPaysQuerentAndReleasesReserve() public {
        vault.reserve(1, 10_000_000, 2);
        vault.settle(1, -30_000_000, QUERENT);
        assertEq(token.balanceOf(QUERENT), 30_000_000, unicode"亏损应支付提问者");
        assertEq(token.balanceOf(address(vault)), 970_000_000, unicode"金库扣款错误");
        assertEq(vault.reservedTotal(), 0, unicode"已决后必须释放预留");
    }

    function testPositiveSettlementPullsFullyFundedReward() public {
        vault.reserve(1, 10_000_000, 2);
        uint256 beforeBalance = token.balanceOf(address(vault));
        vault.settle(1, 15_000_000, QUERENT);
        assertEq(token.balanceOf(address(vault)), beforeBalance + 15_000_000, unicode"正收益入库错误");
        assertEq(vault.reservedTotal(), 0, unicode"正收益结算后必须释放预留");
    }

    function testBelowMinimumReserveSealsPermanently() public {
        DivinerVault smallVault = new DivinerVault(address(token), address(this), DIVINER, 1, 10);
        token.approve(address(smallVault), type(uint256).max);
        smallVault.deposit(29_999_999);

        bool accepted = smallVault.reserve(1, 10_000_000, 1);
        assertTrue(!accepted, unicode"低于 3m_minF 时不得应卦");
        assertEq(uint256(smallVault.state()), uint256(DivinerVault.DivinerState.SEALED), unicode"必须封存");

        token.mint(address(smallVault), 1_000_000_000);
        vm.expectRevert(DivinerVault.VaultSealed.selector);
        smallVault.reserve(2, 10_000_000, 1);
        assertEq(uint256(smallVault.state()), uint256(DivinerVault.DivinerState.SEALED), unicode"封存不可逆");

        vm.expectRevert(DivinerVault.VaultSealed.selector);
        smallVault.deposit(1);
    }

    function testSettlementCanTriggerPermanentSeal() public {
        DivinerVault smallVault = new DivinerVault(address(token), address(this), DIVINER, 1, 10);
        token.approve(address(smallVault), type(uint256).max);
        smallVault.deposit(40_000_000);
        assertTrue(smallVault.reserve(1, 10_000_000, 1), unicode"初始应可预留");
        smallVault.settle(1, -15_000_000, QUERENT);
        assertEq(
            uint256(smallVault.state()), uint256(DivinerVault.DivinerState.SEALED), unicode"结算后破线应封存"
        );

        vm.expectRevert(DivinerVault.VaultSealed.selector);
        smallVault.reserve(2, 10_000_000, 1);

        vm.expectRevert(DivinerVault.VaultSealed.selector);
        smallVault.deposit(1);
    }

    function testOnlyControllerCanReserveAndSettle() public {
        vm.expectRevert(DivinerVault.NotController.selector);
        vm.prank(address(0xBAD));
        vault.reserve(1, 10_000_000, 1);

        vault.reserve(1, 10_000_000, 1);
        vm.expectRevert(DivinerVault.NotController.selector);
        vm.prank(address(0xBAD));
        vault.settle(1, 0, QUERENT);
    }

    function testStrangerCannotForcePermanentSealWithArbitraryFee() public {
        vm.expectRevert(DivinerVault.NotController.selector);
        vm.prank(address(0xBAD));
        vault.sealIfBelow(1_000_000_000_000);
        assertEq(
            uint256(vault.state()), uint256(DivinerVault.DivinerState.ACTIVE), unicode"外部地址不得封存金库"
        );
    }

    function testMultiplierReadsActualBankrollAndHistory() public view {
        uint16 multiplier = vault.calculateMultiplier(10_000_000, 10, 0);
        assertTrue(multiplier > 1, unicode"厚金库与全对历史应提高倍率");
        assertTrue(multiplier <= 10, unicode"倍率不得超过上界");
    }
}
