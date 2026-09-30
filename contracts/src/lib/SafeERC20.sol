// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC20} from "../interfaces/IERC20.sol";

/// @notice 兼容返回 true 或不返回数据的 ERC-20 调用。
library SafeERC20 {
    error TokenCallFailed(address token, bytes data);

    function safeTransfer(IERC20 token, address recipient, uint256 amount) internal {
        _call(token, abi.encodeCall(token.transfer, (recipient, amount)));
    }

    function safeTransferFrom(IERC20 token, address sender, address recipient, uint256 amount) internal {
        _call(token, abi.encodeCall(token.transferFrom, (sender, recipient, amount)));
    }

    function forceApprove(IERC20 token, address spender, uint256 amount) internal {
        bytes memory callData = abi.encodeCall(token.approve, (spender, amount));
        (bool success, bytes memory returnData) = address(token).call(callData);
        if (success && (returnData.length == 0 || abi.decode(returnData, (bool)))) return;
        _call(token, abi.encodeCall(token.approve, (spender, 0)));
        _call(token, callData);
    }

    function _call(IERC20 token, bytes memory data) private {
        (bool success, bytes memory returnData) = address(token).call(data);
        if (!success || (returnData.length != 0 && !abi.decode(returnData, (bool)))) {
            revert TokenCallFailed(address(token), data);
        }
    }
}
