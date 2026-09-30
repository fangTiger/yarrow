import assert from "node:assert/strict";
import test from "node:test";

import type { Account, Chain, PublicClient, Transport, WalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { ViemPredictionSubmitter } from "../src/agent/onchain.js";
import type { PredictionSubmission } from "../src/agent/orchestrator.js";

const account = privateKeyToAccount(`0x${"12".repeat(32)}`);
const predictionBook = `0x${"34".repeat(20)}` as const;
const transactionHash = `0x${"56".repeat(32)}` as const;

function submission(): PredictionSubmission {
  return {
    divinerKey: "takashima",
    roundId: 7n,
    direction: true,
    probabilityBps: 6_100,
    predicateId: `0x${"78".repeat(32)}`,
    params: "0x",
    deadline: 999n,
    modelId: `0x${"90".repeat(32)}`,
    promptHash: `0x${"ab".repeat(32)}`,
    schemaHash: `0x${"cd".repeat(32)}`,
    providerConfigHash: `0x${"ef".repeat(32)}`,
    attemptCount: 1,
    reasoning: "测试判断",
  };
}

function clients(events: string[]): {
  publicClient: PublicClient;
  wallet: WalletClient<Transport, Chain, Account>;
} {
  const request = { address: predictionBook, abi: [], functionName: "submitPrediction", args: [] };
  return {
    publicClient: {
      simulateContract: async () => ({ result: [41n, true], request }),
      estimateContractGas: async () => { events.push("estimate"); return 21_000n; },
      getGasPrice: async () => { events.push("gas-price"); return 7n; },
      getBalance: async () => { events.push("balance"); return 1_000_000n; },
      waitForTransactionReceipt: async () => ({
        status: "success",
        blockNumber: 88n,
        gasUsed: 20_000n,
        effectiveGasPrice: 6n,
      }),
    } as unknown as PublicClient,
    wallet: {
      writeContract: async () => { events.push("write"); return transactionHash; },
    } as unknown as WalletClient<Transport, Chain, Account>,
  };
}

test("预测交易写入前报告估算 gas、gas 价与签名者余额，确认后累计实付 gas", async () => {
  const events: string[] = [];
  const observed: Array<Record<string, bigint>> = [];
  const { publicClient, wallet } = clients(events);
  const submitter = new ViemPredictionSubmitter({
    publicClient,
    predictionBook,
    signers: { takashima: { account, wallet }, wuxing: { account, wallet }, meihua: { account, wallet } },
    beforeSend: (input) => { events.push("gate"); observed.push(input); },
    onConfirmedGasCost: (gasCostWei) => { events.push("confirmed"); observed.push({ gasCostWei }); },
  });

  const receipt = await submitter.submit(submission());

  assert.deepEqual(events, ["estimate", "gas-price", "balance", "gate", "write", "confirmed"]);
  assert.deepEqual(observed, [
    { estimatedGas: 21_000n, gasPriceWei: 7n, signerBalanceWei: 1_000_000n },
    { gasCostWei: 120_000n },
  ]);
  assert.equal(receipt.gasCostWei, 120_000n);
});

test("预测交易发送前预算门禁拒绝时绝不签名写入", async () => {
  const events: string[] = [];
  const { publicClient, wallet } = clients(events);
  const submitter = new ViemPredictionSubmitter({
    publicClient,
    predictionBook,
    signers: { takashima: { account, wallet }, wuxing: { account, wallet }, meihua: { account, wallet } },
    beforeSend: () => { events.push("gate"); throw new Error("累计 gas 预算已满"); },
  });

  await assert.rejects(() => submitter.submit(submission()), /累计 gas 预算已满/);
  assert.deepEqual(events, ["estimate", "gas-price", "balance", "gate"]);
});
