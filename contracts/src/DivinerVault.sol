// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC20} from "./interfaces/IERC20.sol";
import {SafeERC20} from "./lib/SafeERC20.sol";
import {SettlementMath} from "./lib/SettlementMath.sol";
import {RiskMath} from "./lib/RiskMath.sol";

/// @title 单一易者的 USDC 金库
contract DivinerVault {
    using SafeERC20 for IERC20;

    enum DivinerState {
        ACTIVE,
        SEALED
    }

    struct Reservation {
        uint256 amount;
        uint256 maxProfit;
        uint256 fee;
        bool active;
    }

    IERC20 public immutable token;
    address public immutable controller;
    address public immutable diviner;
    uint16 public immutable mMin;
    uint16 public immutable mMax;

    DivinerState public state;
    uint256 public reservedTotal;
    mapping(uint256 => Reservation) public reservations;

    uint256 private _entered = 1;

    error DuplicateReservation();
    error InvalidAddress();
    error InvalidMultiplier();
    error InvalidSettlement();
    error MissingReservation();
    error NotController();
    error Reentrancy();
    error VaultSealed();

    event Deposited(address indexed funder, uint256 amount);
    event Reserved(uint256 indexed predictionId, uint256 amount, uint256 maxProfit);
    event Settled(uint256 indexed predictionId, int256 delta, address indexed querent);
    event ReservationCancelled(uint256 indexed predictionId, uint256 amount);
    event Sealed(uint256 balance, uint256 requiredMinimum);

    constructor(address token_, address controller_, address diviner_, uint16 mMin_, uint16 mMax_) {
        if (token_ == address(0) || controller_ == address(0) || diviner_ == address(0)) {
            revert InvalidAddress();
        }
        if (mMin_ == 0 || mMin_ > mMax_) revert InvalidMultiplier();
        token = IERC20(token_);
        controller = controller_;
        diviner = diviner_;
        mMin = mMin_;
        mMax = mMax_;
    }

    modifier onlyController() {
        if (msg.sender != controller) revert NotController();
        _;
    }

    modifier nonReentrant() {
        if (_entered != 1) revert Reentrancy();
        _entered = 2;
        _;
        _entered = 1;
    }

    function deposit(uint256 amount) external nonReentrant {
        if (state == DivinerState.SEALED) revert VaultSealed();
        token.safeTransferFrom(msg.sender, address(this), amount);
        emit Deposited(msg.sender, amount);
    }

    function totalAssets() public view returns (uint256) {
        return token.balanceOf(address(this));
    }

    function availableBalance() public view returns (uint256) {
        uint256 assets = totalAssets();
        return assets > reservedTotal ? assets - reservedTotal : 0;
    }

    function calculateMultiplier(uint256 fee, uint64 sampleCount, uint256 totalBrier) external view returns (uint16) {
        return RiskMath.multiplier(totalAssets(), fee, sampleCount, totalBrier, mMin, mMax);
    }

    /// @notice 资金低于 3·m_min·F 时封存。返回 true 表示已经或刚刚封存。
    function sealIfBelow(uint256 fee) external onlyController returns (bool) {
        return _sealIfBelow(fee);
    }

    function _sealIfBelow(uint256 fee) private returns (bool) {
        if (state == DivinerState.SEALED) return true;
        uint256 minimum = SettlementMath.reserveAmount(fee, mMin);
        uint256 assets = totalAssets();
        if (assets < minimum) {
            state = DivinerState.SEALED;
            emit Sealed(assets, minimum);
            return true;
        }
        return false;
    }

    /// @notice ACTIVE 金库越过生存线时返回 false 并封存；已封存金库再次应卦必须回滚。
    function reserve(uint256 predictionId, uint256 fee, uint16 multiplier) external onlyController returns (bool) {
        if (state == DivinerState.SEALED) revert VaultSealed();
        if (multiplier < mMin || multiplier > mMax) revert InvalidMultiplier();
        if (reservations[predictionId].active) revert DuplicateReservation();
        if (_sealIfBelow(fee)) return false;

        uint256 amount = SettlementMath.reserveAmount(fee, multiplier);
        if (availableBalance() < amount) return false;
        uint256 maxProfit = uint256(multiplier) * fee;
        reservations[predictionId] = Reservation({amount: amount, maxProfit: maxProfit, fee: fee, active: true});
        reservedTotal += amount;
        emit Reserved(predictionId, amount, maxProfit);
        return true;
    }

    /// @notice 正 ΔB 从已完全抵押的 controller 拉入；负 ΔB 直接支付提问者。
    function settle(uint256 predictionId, int256 delta, address querent) external onlyController nonReentrant {
        if (querent == address(0)) revert InvalidAddress();
        Reservation storage reservation = reservations[predictionId];
        if (!reservation.active) revert MissingReservation();

        uint256 fee = reservation.fee;
        if (delta > 0) {
            uint256 profit = uint256(delta);
            if (profit > reservation.maxProfit) revert InvalidSettlement();
            token.safeTransferFrom(msg.sender, address(this), profit);
        } else if (delta < 0) {
            uint256 loss = uint256(-(delta + 1)) + 1;
            if (loss > reservation.amount) revert InvalidSettlement();
            token.safeTransfer(querent, loss);
        }

        reservedTotal -= reservation.amount;
        reservation.active = false;
        emit Settled(predictionId, delta, querent);
        _sealIfBelow(fee);
    }

    /// @notice 轮次因法定人数不足而作废时，无损释放尚未结算的预留。
    function cancelReservation(uint256 predictionId) external onlyController nonReentrant {
        Reservation storage reservation = reservations[predictionId];
        if (!reservation.active) revert MissingReservation();
        uint256 amount = reservation.amount;
        reservedTotal -= amount;
        reservation.active = false;
        emit ReservationCancelled(predictionId, amount);
    }
}
