import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";

test("README 包含运行、安全和报告说明", async () => {
  const readme = await readFile("docs/legacy/arc-testnet-feasibility.md", "utf8");
  for (const required of [
    "https://faucet.circle.com",
    "ARC_PRIVATE_KEY",
    "npm run probe:readonly",
    "npm run probe:arc",
    "PASS",
    "FAIL",
    "REVERT",
    "reports/arc-probe-",
    "getPriceNoOlderThan",
    "Pyth Pro",
    "五个不同块高",
  ]) {
    assert.match(readme, new RegExp(required.replaceAll(".", "\\.")), `README 缺少：${required}`);
  }
});

test("示例配置不诱导把私钥写入 .env", async () => {
  const example = await readFile(".env.example", "utf8");
  assert.doesNotMatch(example, /^ARC_PRIVATE_KEY=/m);
  assert.match(example, /私钥只通过 shell 环境变量传入/);
});

test("README 包含前端启动、只读数据来源与仪式诚实说明", async () => {
  const readme = await readFile("docs/legacy/arc-testnet-feasibility.md", "utf8");
  for (const required of [
    "npm run frontend:dev",
    "http://127.0.0.1:4173",
    "/api/oracle",
    "backtested",
    "6.0 秒起卦仪式",
    "不会签名或发送交易",
  ]) {
    assert.match(readme, new RegExp(required.replaceAll(".", "\\.")), `README 缺少前端说明：${required}`);
  }
});

test("中英文 README 互相链接，并写明线上地址与 Arc 主网", async () => {
  const [english, chinese] = await Promise.all([
    readFile("README.md", "utf8"),
    readFile("README.zh-CN.md", "utf8"),
  ]);
  assert.match(english, /\[中文\]\(README\.zh-CN\.md\)/);
  assert.match(chinese, /\[English\]\(README\.md\)/);
  for (const readme of [english, chinese]) {
    assert.match(readme, /https:\/\/yarrow-six\.vercel\.app/);
    assert.match(readme, /`5042`/);
    assert.match(readme, /SANYI_FEE_RECIPIENT/);
  }
});
