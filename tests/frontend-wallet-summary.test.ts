import assert from "node:assert/strict";
import test from "node:test";
import { ARC_MAINNET } from "../src/arc-network.js";
import { walletSummary } from "../web/lib/wallet-summary.js";
const address = "0x737301a6A40ea453A877627c409EF5756a395DB9";
test("未连接显示连接钱包", () => {
  assert.equal(walletSummary({}).label, "连接钱包");
});
test("网络不符显示切网", () => {
  assert.equal(walletSummary({ address, chainId: 1 }).label, "切换到 Arc Testnet");
});
test("已连接截断地址并格式化六位精度余额", () => {
  const value = walletSummary({ address, chainId: 5042002, balanceUsdc6: 1_234_567n });
  assert.equal(value.label, "0x7373…5DB9");
  assert.equal(value.balance, "1.23 USDC");
  assert.equal(value.network, "Arc Testnet");
  assert.equal(value.showFaucet, false);
});
test("零余额显示领取测试币且未知余额不误报零", () => {
  assert.equal(walletSummary({ address, chainId: 5042002, balanceUsdc6: 0n }).showFaucet, true);
  assert.equal(walletSummary({ address, chainId: 5042002 }).showFaucet, false);
});
test("主网：切网指向主网，零余额提示充值而不是领测试币", () => {
  assert.equal(walletSummary({ address, chainId: 5042002 }, undefined, ARC_MAINNET).label, "切换到 Arc 主网");
  const empty = walletSummary({ address, chainId: 5042, balanceUsdc6: 0n }, undefined, ARC_MAINNET);
  assert.equal(empty.network, "Arc 主网");
  assert.equal(empty.showFaucet, false);
  assert.equal(empty.showFunding, true);
  assert.equal(walletSummary({ address, chainId: 5042, balanceUsdc6: 1n }, undefined, ARC_MAINNET).showFunding, false);
});
