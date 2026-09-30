import assert from "node:assert/strict";
import test from "node:test";

import {
  ARC_BROWSER_CHAIN,
  ARC_CHAIN_HEX,
  ERC20_USDC_DECIMALS,
  NATIVE_USDC_DECIMALS,
  USDC_TOKEN_ADDRESS,
  classifyWalletError,
  connectArcWallet,
  formatUsdc6,
  nativeWeiToUsdc6,
  walletShortfalls,
} from "../src/frontend/wallet.js";

test("Arc 浏览器链配置固定为实测网络，原生与 ERC-20 USDC 精度严格分离", () => {
  assert.equal(ARC_BROWSER_CHAIN.id, 5_042_002);
  assert.equal(ARC_CHAIN_HEX, "0x4cef52");
  assert.equal(ARC_BROWSER_CHAIN.nativeCurrency.decimals, 18);
  assert.equal(NATIVE_USDC_DECIMALS, 18);
  assert.equal(ERC20_USDC_DECIMALS, 6);
  assert.equal(USDC_TOKEN_ADDRESS, "0x3600000000000000000000000000000000000000");
});

test("首次授权固定为十 USDC 并明确覆盖十八轮，不使用无限额度", async () => {
  const wallet = await import("../src/frontend/wallet.js") as typeof import("../src/frontend/wallet.js") & {
    REUSABLE_APPROVAL_USDC6?: bigint;
    REUSABLE_APPROVAL_ROUND_COUNT?: number;
  };
  assert.equal(wallet.REUSABLE_APPROVAL_USDC6, 10_000_000n);
  assert.equal(wallet.REUSABLE_APPROVAL_ROUND_COUNT, 18);
  assert.notEqual(wallet.REUSABLE_APPROVAL_USDC6, (1n << 256n) - 1n);
});

test("原生十八位 gas 只按 10^12 向上换算到六位展示，不得与 ERC-20 数量混用", () => {
  assert.equal(nativeWeiToUsdc6(1_000_000_000_000n), 1n);
  assert.equal(nativeWeiToUsdc6(999_999_999_999n), 1n);
  assert.equal(nativeWeiToUsdc6(12_345_678_901_234_567n), 12_346n);
  assert.equal(formatUsdc6(550_000n), "0.550000");
});

test("余额门禁分别报告六位托管资金和十八位 gas 的真实差额", () => {
  assert.deepEqual(walletShortfalls({
    erc20BalanceUsdc6: 400_000n,
    nativeBalanceWei18: 2_000_000_000_000n,
    feeUsdc6: 50_000n,
    bondUsdc6: 500_000n,
    estimatedGasWei18: 3_500_000_000_000n,
  }), {
    requiredErc20Usdc6: 550_000n,
    missingErc20Usdc6: 150_000n,
    requiredNativeWei18: 3_500_000_000_000n,
    missingNativeWei18: 1_500_000_000_000n,
  });
});

test("钱包原始错误被归类为可理解的中文提示", () => {
  assert.equal(classifyWalletError({ code: 4001 }, "立誓"), "你取消了“立誓”签名，本笔没有扣款。可以重新点击求卦再试一次。");
  assert.match(classifyWalletError({ code: 4902 }, "切换网络"), /Arc Testnet.*5042002/);
  assert.match(classifyWalletError(new Error("insufficient funds for gas"), "开卦"), /原生 USDC.*gas.*水龙头/);
  assert.doesNotMatch(classifyWalletError(new Error("Internal JSON-RPC error"), "开卦"), /JSON-RPC|Internal/);
});

test("连接钱包时通过 viem 自动添加并切换 Arc Testnet", async () => {
  const calls: string[] = [];
  let chainId = "0x1";
  let known = false;
  const provider = {
    async request({ method }: { method: string }): Promise<unknown> {
      calls.push(method);
      if (method === "eth_requestAccounts") return ["0x0000000000000000000000000000000000000011"];
      if (method === "eth_chainId") return chainId;
      if (method === "wallet_switchEthereumChain") {
        if (!known) throw { code: 4902, message: "unknown chain" };
        chainId = ARC_CHAIN_HEX;
        return null;
      }
      if (method === "wallet_addEthereumChain") {
        known = true;
        return null;
      }
      throw new Error(`未处理 ${method}`);
    },
  };

  const connected = await connectArcWallet(provider);
  assert.equal(connected.address.toLowerCase(), "0x0000000000000000000000000000000000000011");
  assert.equal(await connected.walletClient.getChainId(), 5_042_002);
  assert.deepEqual(calls, [
    "eth_requestAccounts",
    "eth_chainId",
    "wallet_switchEthereumChain",
    "wallet_addEthereumChain",
    "wallet_switchEthereumChain",
    "eth_chainId",
    "eth_chainId",
  ]);
});
