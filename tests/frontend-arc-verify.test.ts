// tests/frontend-arc-verify.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { keccak256, toHex, type Hex } from "viem";
import { normalizeQuestion } from "../src/sanyi/classify.js";
import { deriveThrow } from "../src/sanyi/throws.js";
import {
  ARC_NATIVE_USDC, ARC_USDC, isVerifiablePayment, normalizeCastQuestion, recomputeCoins, verifyOnArc,
  type ArcReader, type ThrowEvidence,
} from "../web/lib/arc-verify.js";

const TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const PAYER = "0xb7394e865eb6f22df7aa199e59887e8aac0947a2";
const RECIPIENT = "0x81d48d2c5d0744e8ef7a5c35cdceb0a27a1c707b";
const hashOf = (label: string) => keccak256(toHex(label));
const topic = (address: string) => `0x${address.slice(2).padStart(64, "0")}`;

/** 构造一卦：付款在 100 号区块，六掷在 101–106 号区块，存档铜钱由服务端公式算出。 */
function fixture(question = "Will my new business partnership work out this year?") {
  const payment = hashOf("payment");
  const blocks = new Map<bigint, Hex>();
  const throws: ThrowEvidence[] = [1, 2, 3, 4, 5, 6].map((index) => {
    const number = 100n + BigInt(index);
    const blockHash = hashOf(`block-${index}`);
    blocks.set(number, blockHash);
    const result = deriveThrow({ paymentTxHash: payment, blockHash, question, index });
    return { index, blockNumber: number.toString(), blockHash, coins: result.coins };
  });
  blocks.set(100n, hashOf("block-0"));
  const reader = (overrides: {
    amount?: bigint; to?: string; status?: "success" | "reverted"; emitter?: string;
    extra?: ReadonlyArray<{ address: string; topics: readonly string[]; data: string }>;
  } = {}): ArcReader => ({
    async getTransactionReceipt(hash) {
      if (hash !== payment) throw new Error("not found");
      return {
        status: overrides.status ?? "success", blockNumber: 100n,
        logs: [...(overrides.extra ?? []), { address: overrides.emitter ?? ARC_USDC,
          topics: [TRANSFER, topic(PAYER), topic(overrides.to ?? RECIPIENT)],
          data: toHex(overrides.amount ?? 50_000n, { size: 32 }) }],
      };
    },
    async getBlock(number) {
      return { hash: blocks.get(number) ?? null, timestamp: 1_760_000_000n + number };
    },
  });
  return { payment, throws, reader, blocks, question };
}

test("浏览器复算与服务端 deriveThrow 逐位一致，问题规范化一致", () => {
  for (let i = 0; i < 200; i += 1) {
    const payment = hashOf(`p${i}`);
    const block = hashOf(`b${i}`);
    const question = i % 2 ? `  这次  面试\t能过吗 ${i} ` : `Will it work out ${i}?`;
    const index = (i % 6) + 1;
    assert.deepEqual(recomputeCoins(payment, block, question, index),
      [...deriveThrow({ paymentTxHash: payment, blockHash: block, question, index }).coins]);
    assert.equal(normalizeCastQuestion(question), normalizeQuestion(question));
  }
});

test("示例的全零付款哈希不可验证，真实哈希可验证", () => {
  assert.equal(isVerifiablePayment(`0x${"0".repeat(64)}`), false);
  assert.equal(isVerifiablePayment(undefined), false);
  assert.equal(isVerifiablePayment("0x1234"), false);
  assert.equal(isVerifiablePayment(hashOf("x")), true);
});

test("链上数据与存档一致：付款与六掷全部通过", async () => {
  const { payment, throws, reader, question } = fixture();
  const result = await verifyOnArc(reader(), { paymentTxHash: payment, recipient: RECIPIENT, question, throws });
  assert.equal(result.ok, true);
  assert.equal(result.payment.amountUsdc6, 50_000n);
  assert.equal(result.payment.from, PAYER);
  assert.equal(result.payment.blockNumber, 100n);
  assert.equal(result.throws.length, 6);
  assert.ok(result.throws.every((item) => item.hashOk && item.afterPayment && item.coinsOk));
});

test("付款不符：收款方不对、金额不对、交易失败、查无此交易", async () => {
  const { payment, reader } = fixture();
  assert.equal((await verifyOnArc(reader({ to: PAYER }), { paymentTxHash: payment, recipient: RECIPIENT }))
    .payment.reason, "wrong-recipient");
  assert.equal((await verifyOnArc(reader({ amount: 40_000n }), { paymentTxHash: payment, recipient: RECIPIENT }))
    .payment.reason, "wrong-amount");
  assert.equal((await verifyOnArc(reader({ status: "reverted" }), { paymentTxHash: payment }))
    .payment.reason, "reverted");
  const missing = await verifyOnArc(reader(), { paymentTxHash: hashOf("other") });
  assert.equal(missing.ok, false);
  assert.equal(missing.payment.reason, "not-found");
});

test("区块哈希被改、铜钱被改、起卦区块早于付款时逐掷标出", async () => {
  const { payment, throws, reader, question } = fixture();
  const tampered = throws.map((item) => item.index === 2 ? { ...item, blockHash: hashOf("fake") }
    : item.index === 4 ? { ...item, coins: item.coins.map((coin) => (coin ? 0 : 1)) as typeof item.coins }
      : item.index === 6 ? { ...item, blockNumber: "99" } : item);
  const result = await verifyOnArc(reader(), { paymentTxHash: payment, recipient: RECIPIENT, question,
    throws: tampered });
  assert.equal(result.ok, false);
  assert.equal(result.payment.ok, true);
  const byIndex = new Map(result.throws.map((item) => [item.index, item]));
  assert.equal(byIndex.get(2)?.hashOk, false);
  assert.equal(byIndex.get(4)?.coinsOk, false);
  assert.equal(byIndex.get(6)?.afterPayment, false);
  assert.ok([1, 3, 5].every((index) => byIndex.get(index)?.ok));
});

test("问题改动一字，复算即不一致（问题参与抽签）", async () => {
  const { payment, throws, reader } = fixture();
  const result = await verifyOnArc(reader(), { paymentTxHash: payment, recipient: RECIPIENT,
    question: "Will my new business partnership work out next year?", throws });
  assert.equal(result.ok, false);
  assert.ok(result.throws.some((item) => !item.coinsOk));
});

test("验证面板：示例只给说明不显示按钮，真实付款显示按钮；英文无汉字", async () => {
  Object.assign(globalThis, {
    __ARC_CHAIN_ID__: "5042", __ARC_RPC_URL__: "https://rpc.mainnet.arc.io",
    __ARC_EXPLORER__: "https://arcscan.app", __WALLETCONNECT_PROJECT_ID__: "0".repeat(32),
  });
  const { createElement } = await import("react");
  const { renderIn } = await import("./helpers/render-in.js");
  const { ArcVerify, ArcVerifyPanel } = await import("../web/components/ArcVerify.js");
  const sample = renderIn("zh", createElement(ArcVerify, { paymentHash: `0x${"0".repeat(64)}` }));
  assert.match(sample, /示例不含真实付款/u);
  assert.doesNotMatch(sample, /<button/u);
  assert.doesNotMatch(sample, /github\.com/u, "示例不显示求助入口");
  for (const lang of ["zh", "en"] as const) {
    const html = renderIn(lang, createElement(ArcVerifyPanel, { paymentHash: hashOf("real") }));
    assert.match(html, /<button[^>]*>(在 Arc 上验证|Verify on Arc)<\/button>/u);
    assert.match(html, /href="https:\/\/github\.com\/fangTiger\/yarrow\/issues"/u);
    if (lang === "en") assert.doesNotMatch(html, /[\p{Script=Han}]/u);
  }
  const cast = renderIn("en", createElement(ArcVerify, { paymentHash: hashOf("real"), question: "Q?",
    throws: fixture().throws }));
  assert.match(cast, /recomputes every throw/u);
});

test("原生 0.05 USDC 付款：浏览器核验通过并按 0.05 显示", async () => {
  const { payment, throws, reader, question } = fixture();
  const native = reader({ emitter: ARC_NATIVE_USDC, amount: 50_000_000_000_000_000n });
  const result = await verifyOnArc(native, { paymentTxHash: payment, recipient: RECIPIENT, question, throws });
  assert.equal(result.ok, true);
  assert.equal(result.payment.kind, "native");
  assert.equal(result.payment.amountUsdc6, 50_000n);
  const off = await verifyOnArc(reader({ emitter: ARC_NATIVE_USDC, amount: 50_000_000_000_000_001n }),
    { paymentTxHash: payment, recipient: RECIPIENT });
  assert.equal(off.payment.reason, "wrong-amount");
});

test("ERC-20 付款带 0xfffe 镜像与 bundler 补偿时仍认 ERC-20", async () => {
  const { payment, reader } = fixture();
  const mirror = { address: ARC_NATIVE_USDC, topics: [TRANSFER, topic(PAYER), topic(RECIPIENT)],
    data: toHex(50_000_000_000_000_000n, { size: 32 }) };
  const gas = { address: ARC_NATIVE_USDC,
    topics: [TRANSFER, topic("0x0000000071727de22e5e9d8baf0edac6f37da032"), topic(PAYER)],
    data: toHex(10_240_865_000_000_000n, { size: 32 }) };
  const result = await verifyOnArc(reader({ extra: [gas, mirror] }), { paymentTxHash: payment, recipient: RECIPIENT });
  assert.equal(result.payment.ok, true);
  assert.equal(result.payment.kind, "erc20");
});
