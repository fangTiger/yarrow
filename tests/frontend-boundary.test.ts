import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path: string): Promise<string> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return "";
  }
}

async function reactSources(): Promise<{ app: string; main: string; providers: string; wagmi: string }> {
  const [app, main, providers, wagmi] = await Promise.all([
    source("web/app.tsx"),
    source("web/main.tsx"),
    source("web/providers/Providers.tsx"),
    source("web/lib/wagmi.ts"),
  ]);
  return { app, main, providers, wagmi };
}

test("esbuild 只注入四项公开配置且不引入 Next.js", async () => {
  const [build, packageJson, wagmi] = await Promise.all([
    source("scripts/build-frontend.ts"),
    source("package.json"),
    source("web/lib/wagmi.ts"),
  ]);
  const manifest = JSON.parse(packageJson) as { dependencies?: Record<string, string> };
  assert.equal(manifest.dependencies?.["@rainbow-me/rainbowkit"], "^2.2.11");
  assert.equal(manifest.dependencies?.wagmi, "^2.19.5");
  assert.equal(manifest.dependencies?.react, "18");
  assert.equal(manifest.dependencies?.["react-dom"], "18");
  assert.equal("next" in (manifest.dependencies ?? {}), false);
  assert.match(build, /web\/main\.tsx/);
  for (const key of ["WALLETCONNECT_PROJECT_ID", "ARC_RPC_URL", "ARC_CHAIN_ID", "ARC_EXPLORER"]) {
    assert.match(build, new RegExp(`process\\.env\\.${key}`));
  }
  assert.doesNotMatch(build, /process\.env\.(?:ARC_PRIVATE_KEY|DEEPSEEK_API_KEY|PRIVATE_KEY)/);
  assert.match(wagmi, /__WALLETCONNECT_PROJECT_ID__/);
  assert.match(wagmi, /__ARC_RPC_URL__/);
  assert.match(wagmi, /__ARC_CHAIN_ID__/);
  assert.match(wagmi, /__ARC_EXPLORER__/);
});

test("浏览器可以签钱包交易，但不能接触任何私钥、助记词或账户派生", async () => {
  const [{ app, main, providers, wagmi }, html, wallet, bundle] = await Promise.all([
    reactSources(),
    source("web/index.html"),
    source("src/frontend/wallet.ts"),
    source("web/dist/app.js"),
  ]);
  const sourceText = `${html}\n${app}\n${main}\n${providers}\n${wagmi}\n${wallet}\n${bundle}`;
  assert.doesNotMatch(sourceText, /PRIVATE_KEY|privateKey|mnemonic|viem\/accounts|privateKeyToAccount|mnemonicToAccount/);
  assert.doesNotMatch(sourceText, /preparation\.salt|["']salt["']\s*:/);
  // 第三方 React 依赖的 NODE_ENV 分支只选择生产代码，不读取秘密；其他浏览器 process.env 入口仍禁止。
  assert.doesNotMatch(sourceText.replaceAll("process.env.NODE_ENV", ""), /process\.env/);
  // 钱包签名能力随付款钩子迁至 web/lib/use-fee-payment.ts；该文件同样纳入秘密扫描。
  const feePayment = await source("web/lib/use-fee-payment.ts");
  assert.doesNotMatch(feePayment, /PRIVATE_KEY|privateKey|mnemonic|viem\/accounts|privateKeyToAccount|mnemonicToAccount/);
  assert.match(feePayment, /useWalletClient/);
});
