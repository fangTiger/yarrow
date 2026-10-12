import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { encodeFunctionData } from "viem";
import { erc20WalletAbi } from "../src/frontend/abis.js";

test("钱包 ABI 支持标准 transfer", () => {
  assert.match(encodeFunctionData({ abi: erc20WalletAbi, functionName: "transfer",
    args: [`0x${"11".repeat(20)}`, 50_000n] }), /^0xa9059cbb/u);
});
test("付款钩子使用服务器配置与单笔写合约并等待回执", async () => {
  const source = await readFile("web/lib/use-fee-payment.ts", "utf8");
  assert.match(source, /getPayment\(/u);
  assert.match(source, /writeContract\(/u);
  assert.match(source, /functionName: "transfer"/u);
  assert.match(source, /waitForTransactionReceipt\(/u);
  assert.match(source, /transactionHash: receipt.transactionHash/u);
  assert.match(source, /walletErrorMessage\(/u);
  assert.doesNotMatch(source, /sendCalls|forceAtomic|deposit|allowance|approve/u);
});
test("首页与结果页均放置钱包栏且收款说明来自配置", async () => {
  const [home, reading, button, bar, styles] = await Promise.all([
    readFile("web/pages/Home.tsx", "utf8"), readFile("web/pages/Reading.tsx", "utf8"),
    readFile("web/components/PaymentButton.tsx", "utf8"), readFile("web/components/WalletBar.tsx", "utf8"),
    readFile("web/styles/components.css", "utf8"),
  ]);
  assert.match(home, /<WalletBar/u);
  assert.match(reading, /<WalletBar/u);
  assert.match(button, /t\("payment\.recipient"/u);
  assert.match(button, /payment\.recipient/u);
  assert.match(bar, /ConnectButton\.Custom/u);
  assert.match(bar, /balanceOf/u);
  assert.match(bar, /openAccountModal/u);
  assert.match(bar, /t\("wallet\.faucet"\)/u);
  assert.match(styles, /\.wallet-button[^}]*min-height: 44px/su);
});
