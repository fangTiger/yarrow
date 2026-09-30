// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

contract MockERC20 {
    string public constant name = unicode"测试 USDC";
    string public constant symbol = "USDC";
    uint8 public constant decimals = 6;

    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address recipient, uint256 amount) external {
        totalSupply += amount;
        balanceOf[recipient] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address recipient, uint256 amount) external returns (bool) {
        _transfer(msg.sender, recipient, amount);
        return true;
    }

    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[sender][msg.sender];
        require(allowed >= amount, unicode"授权不足");
        if (allowed != type(uint256).max) allowance[sender][msg.sender] = allowed - amount;
        _transfer(sender, recipient, amount);
        return true;
    }

    function _transfer(address sender, address recipient, uint256 amount) private {
        require(recipient != address(0), unicode"收款人为零地址");
        require(balanceOf[sender] >= amount, unicode"余额不足");
        balanceOf[sender] -= amount;
        balanceOf[recipient] += amount;
    }
}
