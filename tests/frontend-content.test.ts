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

test("前端由 React 根节点与指定 Provider 顺序承载，不再注册 Web Component", async () => {
  const [html, { app, main, providers }] = await Promise.all([source("web/index.html"), reactSources()]);
  assert.match(html, /id=["']root["']/);
  assert.match(html, /\/dist\/app\.js/);
  assert.doesNotMatch(html + app + main, /customElements\.define|extends HTMLElement|<oracle-experience/);
  assert.match(main, /createRoot/);
  assert.match(main, /<Providers>[\s\S]*<App\s*\/>[\s\S]*<\/Providers>/);
  assert.match(providers, /<WagmiProvider[^>]*>[\s\S]*<QueryClientProvider[^>]*>[\s\S]*<RainbowKitProvider[^>]*>[\s\S]*children[\s\S]*<\/RainbowKitProvider>[\s\S]*<\/QueryClientProvider>[\s\S]*<\/WagmiProvider>/);
  assert.match(providers, /darkTheme\s*\(/);
  assert.match(providers, /modalSize=["']compact["']/);
  const build = await source("scripts/build-frontend.ts");
  assert.match(build, /rainbowkit-mainnet\.ts/);
});

test("wagmi 固定 Arc Testnet 单链并通过 RainbowKit ConnectButton 接入", async () => {
  const { app, providers, wagmi } = await reactSources();
  const combined = `${app}\n${providers}\n${wagmi}`;
  assert.match(wagmi, /getDefaultConfig\s*\(/);
  assert.match(wagmi, /id:\s*ARC_CHAIN_ID/);
  assert.match(wagmi, /name:\s*["']Arc Testnet["']/);
  assert.match(wagmi, /nativeCurrency:\s*\{[^}]*decimals:\s*18/);
  assert.match(wagmi, /chains:\s*\[arcTestnet\]/);
  assert.match(wagmi, /ssr:\s*false/);
  assert.match(combined, /ConnectButton(?:\.Custom)?/);
  for (const hook of ["useAccount", "useChainId", "useSwitchChain", "useWalletClient", "usePublicClient"]) {
    assert.match(app, new RegExp(`\\b${hook}\\b`));
  }
  assert.match(app, /switchChain\s*\(\s*\{\s*chainId:\s*ARC_CHAIN_ID/);
});

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

test("主流程一次点击后自动分类并唤起钱包，按钮明示卦金", async () => {
  const [{ app }, css] = await Promise.all([reactSources(), source("web/styles.css")]);
  assert.match(app, /data-page=["']oracle["']/);
  assert.match(app, /className=["'][^"']*workbench/);
  assert.match(css, /\.workbench-shell[\s\S]*100svh/);
  assert.equal((app.match(/data-action=["']start-round["']/g) ?? []).length, 1);
  assert.match(app, /求\s*卦\s*·\s*0\.05 USDC/);
  assert.match(app, /0\.05 USDC/);
  assert.match(app, /\/api\/question\/classify/);
  assert.match(app, /useConnectModal/);
  assert.match(app, /openConnectModal/);
  assert.match(app, /未连接[^\n]{0,60}自动唤起钱包/);
  assert.doesNotMatch(app, /请先使用右上角[^\n]+再点击“求卦”/);
  assert.doesNotMatch(app, /trigger-predictions|请三家应卦|再请三家应卦/);
  assert.match(app, /data-action=["']optional-settlement["'][\s\S]{0,180}可选/);
  assert.doesNotMatch(app, /scrollIntoView/);
});

test("六步被压成含费用与交易入口的细状态行，完整步骤与交易哈希收进次级详情", async () => {
  const [{ app }, css] = await Promise.all([reactSources(), source("web/styles.css")]);
  for (const [key, label] of [
    ["wallet", "连接钱包"],
    ["commit", "立誓"],
    ["reveal", "成卦"],
    ["predictions", "三家应卦"],
    ["waiting", "等待应验"],
    ["settlement", "结算"],
  ]) {
    assert.match(app, new RegExp(`key:\\s*["']${key}["'][\\s\\S]{0,180}label:\\s*["']${label}["']`));
  }
  assert.match(app, /需要你操作/);
  assert.match(app, /自动进行中/);
  assert.match(app, /\/tx\/\${hash\}/);
  assert.match(app, /<details[^>]*className=["'][^"']*progress-dock/);
  assert.match(app, /className=["']status-line["']/);
  assert.match(app, /0\.050000 USDC/);
  assert.match(app, /交易[^<]{0,20}查看/);
  assert.match(css, /\.progress-dock[^}]*max-height:\s*3(?:\.\d+)?rem/);
  assert.doesNotMatch(css, /\.progress-dock\s+ol\s*\{[^}]*min-width:\s*5[0-9]rem/);
});

test("三张易者卡是唯一事实来源，并在原地覆盖等待、应卦与结算状态", async () => {
  const { app } = await reactSources();
  assert.equal((app.match(/data-diviner-grid/g) ?? []).length, 1);
  assert.equal((app.match(/data-diviner-card/g) ?? []).length, 1, "React 应通过同一个卡片模板映射三位易者");
  for (const name of ["高島易断", "五行易（断易）", "梅花心易"]) assert.match(app, new RegExp(name));
  assert.doesNotMatch(app, /data-live-vaults|data-live-scores|payout-list|settlement-results/);
  assert.match(app, /等待应卦/);
  assert.match(app, /vaultChanges/);
  assert.match(app, /这一卦赔了钱|这一卦赢了钱/);
});

test("卦历通过独立哈希路由呈现，不再挂在工作台底部", async () => {
  const { app } = await reactSources();
  assert.match(app, /href=["']#\/oracle["']/);
  assert.match(app, /href=["']#\/history["']/);
  assert.match(app, /hashchange/);
  assert.match(app, /#\/history/);
  assert.match(app, /历史数据回放/);
  assert.match(app, /backtested/);
  assert.match(app, /不是现场发生的|非现场/);
});

test("钱包面板显示地址、双余额、网络、水龙头与签名前费用明细", async () => {
  const [{ app }, wallet] = await Promise.all([reactSources(), source("src/frontend/wallet.ts")]);
  const combined = `${app}\n${wallet}`;
  assert.match(app, /data-wallet-address/);
  assert.match(app, /data-wallet-token-balance/);
  assert.match(app, /data-wallet-native-balance/);
  assert.match(app, /Arc Testnet/);
  assert.match(combined, /https:\/\/faucet\.circle\.com/);
  assert.match(app, /data-transaction-preview/);
  assert.match(app, /卦金/);
  assert.match(app, /保证金/);
  assert.match(app, /预估 gas/);
});

test("两类问题都收费；不可判定轨原子入三库，可判定轨仍由钱包提交 commit", async () => {
  const { app } = await reactSources();
  for (const endpoint of ["/api/question/classify", "/api/question/cast"]) {
    assert.match(app, new RegExp(endpoint.replaceAll("/", "\\/")));
  }
  for (const endpoint of [
    "/api/demo/round/prepare",
    "/api/demo/round/confirm",
    "/api/demo/predictions",
    "/api/demo/settlement",
  ]) assert.match(app, new RegExp(endpoint.replaceAll("/", "\\/")));
  assert.match(app, /runQuestionFlow/);
  assert.match(app, /runWagerFlow/);
  assert.match(app, /sendCalls/);
  assert.match(app, /waitForCallsStatus/);
  assert.match(app, /forceAtomic:\s*true/);
  assert.match(app, /functionName:\s*["']deposit["']/);
  assert.match(app, /retryPredictions/);
  assert.match(app, /querentOutcome/);
  assert.match(app, /settleAutomatically/);
  assert.match(app, /refetchWalletClient/);
  assert.match(app, /writeContract/);
  assert.doesNotMatch(app, /functionName:\s*["']reveal["']/);
  assert.doesNotMatch(app, /functionName:\s*["']settle["']/);
  assert.doesNotMatch(app, /preparation\.salt/);
});

test("UI 明示每卦收费、首次授权、稳态一次确认、七段耗时和弃卦重来", async () => {
  const { app } = await reactSources();
  assert.match(app, /首次需授权一次，之后不再需要/);
  assert.match(app, /10\.000000 USDC/);
  assert.match(app, /所有起卦都收取 0\.05 USDC/);
  assert.match(app, /稳态[^\n]{0,40}1 次钱包确认/);
  for (const label of ["立誓", "等待 N 块", "服务端揭示", "三家推理", "三笔预测", "等待应验", "三笔结算"]) {
    assert.match(app, new RegExp(label));
  }
  assert.match(app, /弃卦重来/);
  assert.match(app, /开始新的一卦/);
});

test("分类自动执行且不等待确认，完整责任与三库分账仍被保留", async () => {
  const { app } = await reactSources();
  assert.match(app, /你问的是/);
  assert.match(app, /分类覆盖/);
  assert.match(app, /trackOverride/);
  assert.doesNotMatch(app, /accept-classification|deny-classification|继续解卦（免费）/);
  assert.match(app, /你问的这件事，没有一个将来会揭晓的答案/);
  assert.match(app, /包括刚刚收过你钱的我们/);
  assert.match(app, /我们仍然可以为你解这一卦/);
  assert.match(app, /卦金[^\n]{0,80}三位易者[^\n]{0,80}金库/);
  assert.match(app, /16667[^\n]{0,80}16667[^\n]{0,80}16666/);
  assert.match(app, /<details[^>]*className=["'][^"']*fee-disclosure/);
  assert.doesNotMatch(app, /零成本证明|問轨无需钱包|零签名零交易/);
});

test("問轨结果先呈现可切换五卦象群，再呈现所问、状态与责任说明", async () => {
  const [{ app }, css] = await Promise.all([reactSources(), source("web/styles.css")]);
  const workspace = app.slice(app.indexOf('<section className="page oracle-page"'));
  assert.match(app, /data-hexagram-constellation/);
  assert.match(app, /data-hexagram-kind=\{figure\.kind\}/);
  assert.match(app, /setActiveKind/);
  assert.match(app, /active\.derivation/);
  assert.match(app, /active\.judgement/);
  assert.match(app, /卦辞/);
  for (const label of ["本卦", "互卦", "变卦", "错卦", "综卦"]) assert.match(app, new RegExp(label));
  const constellation = workspace.indexOf("<FiveHexagramConstellation");
  assert.ok(constellation >= 0, "结果工作台必须渲染五卦象群");
  assert.ok(constellation < workspace.indexOf('<details className="question-recap">'), "象群必须先于折叠的本轮所问");
  assert.ok(constellation < workspace.indexOf('<div className="stage-status"'), "象群必须先于状态条");
  assert.ok(constellation < workspace.indexOf('<section className="responsibility-panel"'), "象群必须先于责任说明");
  assert.match(css, /\.five-hexagram-constellation/);
  assert.match(css, /\.hexagram-node\[data-kind="primary"\]/);
});

test("传统排盘与推导完整保留在默认关闭的总展开区，宽表只在自身横向滚动", async () => {
  const [{ app }, css] = await Promise.all([reactSources(), source("web/styles.css")]);
  assert.match(app, /data-liuyao-chart/);
  assert.match(app, /<details className=["']reading-details["']>/);
  assert.match(app, /<summary>完整排盘与推导<\/summary>/);
  for (const heading of ["六神", "伏神", "本卦（纳甲・六亲）", "爻象", "世应", "变卦（纳甲・六亲）"]) {
    assert.match(app, new RegExp(heading));
  }
  assert.match(app, /京房纳甲・八宫世应・六甲旬空/);
  assert.match(app, /UTC\+8.*00:00.*不采用子初换日/);
  assert.match(app, /五级“旺相休囚死”明确依《三命通会》/);
  assert.match(app, /未实现应期、日月合与十二长生/);
  assert.match(app, /取时区块[\s\S]*区块时间戳[\s\S]*日干支/);
  assert.match(css, /\.chart-scroll\s*\{[^}]*overflow-x:\s*auto/);
  // Chromium 会把未定位滚动容器中的宽表部分计入根页面；定位后只让表自身横向滚动。
  assert.match(css, /\.chart-scroll\s*\{[^}]*position:\s*relative/);
  assert.match(css, /\.liuyao-table\s*\{[^}]*min-width:/);
  assert.match(css, /\.chart-scroll[\s\S]*max-width:\s*100%/);
  assert.match(css, /html[\s\S]*overflow-x:\s*hidden/);
  assert.match(css, /html[\s\S]*overflow-x:\s*clip/);
});

test("五行有独立可视化，逐爻把卦宫之我、生克、六亲、月令和用神串起来", async () => {
  const [{ app }, css] = await Promise.all([reactSources(), source("web/styles.css")]);
  assert.match(app, /data-five-elements/);
  assert.match(app, /five-elements-diagram/);
  assert.match(app, /相生环/);
  assert.match(app, /相克星/);
  for (const relation of ["木生火", "火生土", "土生金", "金生水", "水生木", "木克土", "土克水", "水克火", "火克金", "金克木"]) {
    assert.match(app, new RegExp(relation));
  }
  assert.match(app, /上卦[^\n]{0,80}下卦/);
  assert.match(app, /卦宫五行为.*为“我”/);
  assert.match(app, /relation\.explanation/);
  assert.match(app, /被定为\$\{relation\.relation\}/);
  assert.match(app, /describeElementRelation/);
  assert.match(app, /primary\.strength/);
  assert.match(app, /focus\?\.useGod/);
  assert.match(css, /\.element-generate[^}]*var\(--gold\)/);
  assert.match(css, /\.element-overcome[^}]*var\(--vermilion\)/);
});

test("事项主题在解读旁自动采用且改选即重算，术语与五步引导仍完整保留", async () => {
  const [{ app }, css] = await Promise.all([reactSources(), source("web/styles.css")]);
  assert.match(app, /事项主题/);
  assert.match(app, /classification\.subject/);
  assert.match(app, /setSelectedSubject/);
  assert.match(app, /confirmedSubject/);
  assert.match(app, /data-subject-control/);
  assert.match(app, /按\{result\.subject\.label\}取\{result\.subject\.useGod\}/);
  assert.match(app, /recalculateSubject/);
  assert.match(app, /basisBlock:\s*questionResult\.block/);
  assert.match(app, /payment:\s*questionPayment/);
  assert.doesNotMatch(app, /accept-classification|deny-classification/);

  assert.match(app, /function TermDisclosure/);
  assert.match(app, /<details[^>]*className=["'][^"']*term-disclosure/);
  assert.match(css, /\.term-disclosure/);
  for (const term of [
    "本卦", "互卦", "变卦", "错卦", "综卦", "卦宫", "游魂", "世爻", "应爻",
    "六神", "伏神", "纳甲", "六亲", "旬空", "月建", "旺相休囚死", "月破", "日破", "暗动",
    "进神", "退神", "回头生", "回头克", "六冲", "六合",
  ]) assert.match(app, new RegExp(term));
  assert.match(app, /这一卦里/);
  assert.match(app, /四爻.*胸／门外|胸／门外.*四爻/);
  assert.match(app, /初爻.*足／基层|足／基层.*初爻/);

  const guide = app.slice(app.indexOf("这一卦怎么读"));
  const ordered = ["用神", "旺衰", "原神／忌神／仇神", "世应", "动变"];
  let cursor = -1;
  for (const label of ordered) {
    const next = guide.indexOf(label);
    assert.ok(next > cursor, `阅读引导缺少或错序：${label}`);
    cursor = next;
  }
  assert.match(app, /《三命通会》/);
  assert.match(app, /《增删卜易》/);
  assert.match(app, /彖辞.*大象辞.*语料.*缺失|语料.*缺失.*彖辞.*大象辞/);
});

test("賭轨如实区分短周期见证和长周期等待，人间问题不再映射天层指标", async () => {
  const { app } = await reactSources();
  assert.match(app, /今天之内会不会收到那条消息/);
  assert.match(app, /由你见证/);
  assert.match(app, /长周期|几天到几周|需要等待/);
  assert.match(app, /未决之卦/);
  assert.doesNotMatch(app, /把问题固定成[^\n]+Arc USDC/);
});

test("起卦仪式、倒计时与朱红决印保留", async () => {
  const [{ app }, css] = await Promise.all([reactSources(), source("web/styles.css")]);
  const combined = `${app}\n${css}`;
  assert.match(combined, /链上确认 ~0\.5s/);
  assert.match(combined, /仪式演出 6s/);
  assert.match(app, /6_000|6000/);
  assert.match(app, /data-countdown/);
  assert.match(combined, /事实最后是：/);
  assert.match(combined, /content:\s*["']決["']/);
});

test("正文完整保留诚实披露，统计术语只留在卦历证据区", async () => {
  const { app } = await reactSources();
  assert.match(app, /<details[^>]*className=["'][^"']*truth-drawer/);
  assert.match(app, /<summary>完整披露<\/summary>/);
  assert.match(app, /解释跳跃/);
  assert.match(app, /服务端托管同地址演示账户自动揭示/);
  assert.match(app, /backtested/);
  assert.match(app, /截止块后首次观察到的值/);
  assert.match(app, /人类 attestor/);
  assert.match(app, /风险管理.*不表示.*预测能力/);
  assert.match(app, /mock provider/);
  assert.match(app, /术语：.*Brier/);
  assert.match(app, /BSS/);
  assert.match(app, /Wilson/);
  assert.match(app, /置换检验/);
  assert.match(app, /天层.*backtested|backtested.*天层/);
  assert.match(app, /人层.*已结算|已结算.*人层/);
});

test("结果默认只展开答案层，解释、费用与签名前明细均默认折叠", async () => {
  const { app } = await reactSources();
  for (const className of ["reading-details", "fee-disclosure", "transaction-preview", "truth-drawer"]) {
    assert.match(app, new RegExp(`<details[^>]*className=["'][^"']*${className}[^"']*["']`));
  }
  assert.match(app, /留给你的动作/);
  assert.match(app, /解读不担保结果/);
  assert.equal((app.match(/解读不担保结果/g) ?? []).length, 1, "默认责任短句只能出现一次");
  assert.doesNotMatch(app, /同一卦，三种读法；没有一家替你作决定/);
  assert.doesNotMatch(app, /本卦为体，互卦探隐，综卦观反，变卦测果，错卦警变/);
});

test("賭轨结果同样只展开五卦、三家判断与行动，其余说明默认折叠", async () => {
  const { app } = await reactSources();
  assert.match(app, /deriveFiveHexagrams\(session\.hexagram\.lines\)/);
  assert.match(app, /wagerFive/);
  assert.match(app, /<details[^>]*className=["'][^"']*timing-card/);
  assert.match(app, /<details[^>]*className=["'][^"']*diviner-finance-details/);
  assert.match(app, /<details[^>]*className=["'][^"']*wager-disclosure/);
  assert.match(app, /<details[^>]*className=["'][^"']*recovery-notice/);
  assert.match(app, /<summary>押注、概率与凭证<\/summary>/);
  assert.match(app, /<summary>命题与见证说明<\/summary>/);
  assert.match(app, /留给你的动作/);
  assert.match(app, /到期后回来见证/);
  assert.match(app, /questionResult \|\| session\?\.predictions\.length/);
});

test("视觉系统保留夜间神社终端 token、纵书、和柄并响应移动端", async () => {
  const [{ app }, css] = await Promise.all([reactSources(), source("web/styles.css")]);
  const combined = `${app}\n${css}`.toLowerCase();
  for (const color of ["#0b0e14", "#131a2a", "#1a2235", "#2e4a7d", "#e24a2b", "#c9a227", "#f0ede5"]) {
    assert.match(combined, new RegExp(color));
  }
  assert.match(css, /color-scheme:\s*dark/);
  assert.match(css, /writing-mode:\s*vertical-rl/);
  assert.match(css, /麻の葉|asanoha/);
  assert.match(css, /\.night-pattern\s*\{[^}]*overflow:\s*hidden/);
  assert.match(css, /@media[\s\S]*max-width:\s*700px/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /html[\s\S]*overflow-x:\s*hidden/);
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
  assert.match(app, /useWalletClient/);
});
