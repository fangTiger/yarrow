import assert from "node:assert/strict";
import test from "node:test";

import { buildReport, renderMarkdown } from "../src/report.js";
import { decodeRevertData } from "../src/revert.js";

test("汇总各状态并渲染中文 Markdown", () => {
  const report = buildReport({
    reportType: "readonly",
    generatedAt: "2026-09-05T00:00:00.000Z",
    network: { name: "Arc Testnet", chainId: 5_042_002, rpcUrl: "https://rpc.testnet.arc.io" },
    results: [
      { id: "one", title: "有代码", status: "PASS", expected: "必须有代码", observed: "83 字节", details: { codeBytes: 83 } },
      { id: "two", title: "调用失败", status: "REVERT", observed: "调用回滚", reason: "无返回数据" },
      { id: "three", title: "官方地址", status: "NOT_FOUND", observed: "未找到" },
    ],
    sources: [],
  });

  assert.deepEqual(report.summary, { PASS: 1, FAIL: 0, REVERT: 1, NOT_FOUND: 1, SKIP: 0 });
  const markdown = renderMarkdown(report);
  assert.match(markdown, /# Arc Testnet 只读探测报告/);
  assert.match(markdown, /\| one \| 有代码 \| PASS \| 83 字节 \|/);
  assert.match(markdown, /无返回数据/);
  assert.ok(markdown.indexOf("| three |") < markdown.indexOf("<details>"), "详情块不应打断 Markdown 表格");
  assert.doesNotMatch(markdown, /<!--/, "预期条件不应使用会打断表格的 HTML 注释");
});

test("Markdown 单元格会转义竖线和换行", () => {
  const report = buildReport({
    reportType: "transaction",
    generatedAt: "2026-09-05T00:00:00.000Z",
    network: { name: "Arc Testnet", chainId: 5_042_002, rpcUrl: "https://rpc.testnet.arc.io" },
    results: [{ id: "x", title: "a|b", status: "FAIL", observed: "第一行\n第二行" }],
    sources: [],
  });

  const markdown = renderMarkdown(report);
  assert.match(markdown, /a\\\|b/);
  assert.match(markdown, /第一行<br>第二行/);
});

test("解码 Error(string)、Panic 和空 revert data", () => {
  const errorData =
    "0x08c379a00000000000000000000000000000000000000000000000000000000000000020" +
    "0000000000000000000000000000000000000000000000000000000000000006" +
    "e4b8ade69687000000000000000000000000000000000000000000000000000000";
  const panicData = "0x4e487b710000000000000000000000000000000000000000000000000000000000000011";

  assert.equal(decodeRevertData(errorData), "Error(中文)");
  assert.equal(decodeRevertData(panicData), "Panic(0x11)：算术溢出或下溢");
  assert.equal(decodeRevertData("0x"), "无返回数据");
  assert.equal(decodeRevertData("0x12345678"), "自定义错误或未知返回数据：0x12345678");
});
