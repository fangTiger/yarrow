import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createElement } from "react";
import test from "node:test";
import { FundingGuide } from "../web/components/FundingGuide.js";
import { renderIn } from "./helpers/render-in.js";

test("主网 USDC 获取指引中英均包含三步、两个安全外链与关键提醒", () => {
  const zh = renderIn("zh", createElement(FundingGuide, { mainnet: true, open: true }));
  const en = renderIn("en", createElement(FundingGuide, { mainnet: true, open: true }));

  for (const html of [zh, en]) {
    assert.equal((html.match(/<li/gu) ?? []).length, 3);
    assert.match(html, /https:\/\/bridge\.usdc\.com/u);
    assert.match(html, /https:\/\/across\.to\/arc-bridge/u);
    assert.equal((html.match(/target="_blank"/gu) ?? []).length, 2);
    assert.equal((html.match(/rel="noreferrer"/gu) ?? []).length, 2);
    assert.match(html, /0\.05/u);
    assert.match(html, /0\.001/u);
    assert.match(html, /1[–-]2/u);
  }
  assert.match(zh, /Circle 发行的原生 USDC/u);
  assert.match(zh, /Arc（不是 Arc Testnet）/u);
  assert.match(en, /Circle-issued native USDC/u);
  assert.match(en, /Arc, not Arc Testnet/u);
  assert.doesNotMatch(en, /[\u3400-\u9fff]/u);
});

test("测试网不显示主网获取指引", () => {
  assert.equal(renderIn("zh", createElement(FundingGuide, { mainnet: false })), "");
});

test("零余额入口自动展开且保留复制地址，付款按钮下方另有常驻入口", async () => {
  const wallet = await readFile("web/components/WalletPaymentGuide.tsx", "utf8");
  const form = await readFile("web/components/QuestionForm.tsx", "utf8");

  assert.match(wallet, /<FundingGuide mainnet=\{ARC_NETWORK\.mainnet\} open \/>/u);
  assert.match(wallet, /\{copyAddress\}/u);
  assert.match(wallet, /wallet\.testnetNotice/u);
  assert.match(wallet, /wallet\.faucetHelp/u);
  assert.match(form, /<FundingGuide mainnet=\{ARC_NETWORK\.mainnet\} \/>/u);
});

