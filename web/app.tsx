import { ConnectButton, useConnectModal } from "@rainbow-me/rainbowkit";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { formatUnits, type Abi, type Address, type Hex } from "viem";
import {
  useAccount,
  useBalance,
  useChainId,
  usePublicClient,
  useReadContract,
  useSwitchChain,
  useWalletClient,
} from "wagmi";

import { divinationRegistryAbi, divinerVaultAbi, erc20WalletAbi } from "../src/frontend/abis.js";
import type {
  DemoAbandonResponse,
  DemoPrepareResponse,
  DemoRoundPreparation,
  DemoSession,
  DemoTransaction,
} from "../src/demo/service.js";
import {
  QUESTION_SUBJECTS,
  type QuestionClassification,
  type QuestionSubjectKey,
  type QuestionTrack,
} from "../src/oracle/question-classifier.js";
import type { QuestionOracleResult } from "../src/oracle/question-oracle.js";
import {
  describeElementRelation,
  deriveFiveHexagrams,
  type FiveElement,
  type FiveHexagrams,
  type HexagramFigure,
  type HexagramKind,
  type LiuyaoChart,
} from "../src/oracle/liuyao-chart.js";
import {
  buildQuestionFeePlan,
  type QuestionFeeProof,
} from "../src/oracle/fee-payment.js";
import {
  ARC_FAUCET_URL,
  REUSABLE_APPROVAL_USDC6,
  USDC_TOKEN_ADDRESS,
  classifyWalletError,
  formatUsdc6,
  nativeWeiToUsdc6,
  walletShortfalls,
} from "../src/frontend/wallet.js";
import { ARC_CHAIN_ID, ARC_EXPLORER, arcTestnet } from "./lib/wagmi.js";

type Page = "oracle" | "history";
type StepKey = "wallet" | "commit" | "reveal" | "predictions" | "waiting" | "settlement";
type UserTransactionKind = "approval" | "commit" | "reading-fee";
type HistoryFilter = "all" | "yes" | "no" | "pending";

interface ConnectRenderProps {
  account?: { address: string };
  chain?: { unsupported?: boolean };
  mounted: boolean;
  openAccountModal: () => void;
  openChainModal: () => void;
  openConnectModal: () => void;
}

interface LocalReceipt {
  kind: UserTransactionKind;
  hash: Hex;
}

interface TransactionPreview {
  action: string;
  feeUsdc6: bigint;
  bondUsdc6: bigint;
  gasWei18: bigint;
  note: string;
}

interface StageStatus {
  label: string;
  description: string;
  kind: "idle" | "user" | "automatic";
}

interface HistoryPrediction {
  divinerName: string;
  probabilityBps: number;
  settlementDeltaUsdc6: string | null;
}

interface HistoryRound {
  id: string;
  source: "live" | "backtested";
  sourceLabel: string;
  question: string;
  statement: string;
  occurredAt: string;
  outcome: boolean | null;
  primary: { number: number; name: string };
  derived: { number: number; name: string };
  predictions: HistoryPrediction[];
  resolutionTier?: "human" | "heaven";
}

interface OracleSnapshot {
  chain: { name: string; latestBlock: string };
  history: { live: HistoryRound[]; backtested: HistoryRound[] };
}

const PROGRESS_STEPS: ReadonlyArray<{ key: StepKey; label: string; numeral: string }> = [
  { key: "wallet", label: "连接钱包", numeral: "一" },
  { key: "commit", label: "立誓", numeral: "二" },
  { key: "reveal", label: "成卦", numeral: "三" },
  { key: "predictions", label: "三家应卦", numeral: "四" },
  { key: "waiting", label: "等待应验", numeral: "五" },
  { key: "settlement", label: "结算", numeral: "六" },
];

const DIVINERS = [
  { key: "takashima", numeral: "壹", name: "高島易断", waiting: "重时势与实务决断。" },
  { key: "wuxing", numeral: "贰", name: "五行易（断易）", waiting: "重用神、世应与生克。" },
  { key: "meihua", numeral: "叁", name: "梅花心易", waiting: "重随机起卦与外应。" },
] as const;

const CHINESE_NUMERALS = ["〇", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
const FIVE_HEXAGRAM_ORDER: readonly HexagramKind[] = ["primary", "mutual", "reversed", "derived", "opposite"];
const PREFLIGHT_GAS_UNITS = 1_300_000n;
const FALLBACK_GAS_UNITS: Record<UserTransactionKind, bigint> = {
  approval: 80_000n,
  commit: 260_000n,
  "reading-fee": 300_000n,
};

const TIMING_LABELS = ["立誓", "等待 N 块", "服务端揭示", "三家推理", "三笔预测", "等待应验", "三笔结算"] as const;

function shortHash(value: string): string {
  return value.length <= 15 ? value : `${value.slice(0, 7)}…${value.slice(-5)}`;
}

function probabilityPhrase(value: number): string {
  if (value <= 1_000) return "不到一成的可能";
  if (value >= 9_000) return "几乎一定会发生";
  const whole = Math.floor(value / 1_000);
  const tenth = Math.floor((value % 1_000) / 100);
  return `${CHINESE_NUMERALS[whole]}成${tenth > 0 ? CHINESE_NUMERALS[tenth] : ""}的可能`;
}

function percentage(value: number): string {
  return `${(value / 100).toFixed(2)}%`;
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function nextPaint(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

function transactionLink(hash: string): string {
  return `${ARC_EXPLORER}/tx/${hash}`;
}

function formatDuration(milliseconds: number | null): string {
  if (milliseconds === null) return "—";
  if (milliseconds < 1_000) return `${milliseconds}ms`;
  return `${(milliseconds / 1_000).toFixed(1)}s`;
}

async function requestDemo<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({ error: "服务返回了无法读取的结果" })) as { error?: string } & T;
  if (!response.ok) throw new Error(payload.error ?? "本地演示服务暂不可用");
  return payload;
}

function phaseDescription(session: DemoSession | null): StageStatus {
  if (!session) return {
    label: "需要你操作",
    description: "写下问题并点求卦；系统会自动分类、唤起钱包并接续收费流程。",
    kind: "user",
  };
  const descriptions: Record<DemoSession["phase"], string> = {
    committing: "等待钱包确认唯一一笔立誓；首次使用会先确认固定额度授权。",
    "waiting-reveal": "立誓已确认，正在等待可以开卦的区块。",
    revealing: "服务端正在自动揭示承诺，六爻正在链上成形。",
    revealed: "卦已成；三位易者将依次解卦并押上自己的钱。",
    compiling: "正在冻结原问题并登记人层见证，不把它改写成链上指标。",
    predicting: `三家正在依次应卦，已有 ${session.predictions.length} 家完成。`,
    predicted: session.horizon === "short" ? "三家均已押钱；这件事现在需要由你见证。" : "三家均已押钱；长周期问题需要等到真实截止后再由你见证。",
    "waiting-settlement": "提问者的见证已收到，正在经人层 resolver 结算。",
    settling: "服务端结算交易正在逐笔确认。",
    settled: "本轮已完成；交易回执收在顶部细状态行的展开详情里。",
    failed: session.error ?? "本轮暂时中断。",
  };
  const needsUser = session.phase === "committing";
  return {
    label: session.phase === "settled" ? "本轮完成" : needsUser ? "需要你操作" : "自动进行中",
    description: descriptions[session.phase],
    kind: needsUser ? "user" : "automatic",
  };
}

function WalletPanel() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const nativeBalance = useBalance({ address, chainId: ARC_CHAIN_ID, query: { enabled: isConnected } });
  const tokenBalance = useReadContract({
    address: USDC_TOKEN_ADDRESS,
    abi: erc20WalletAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: ARC_CHAIN_ID,
    query: { enabled: Boolean(address) },
  });
  const tokenValue = typeof tokenBalance.data === "bigint" ? tokenBalance.data : null;

  return (
    <ConnectButton.Custom>
      {(renderProps: ConnectRenderProps) => {
        const { account, chain, mounted, openAccountModal, openChainModal, openConnectModal } = renderProps;
        const ready = mounted;
        const connected = ready && account && chain && isConnected;
        return (
          <div className="wallet-area" aria-hidden={!ready}>
            {!connected ? (
              <button className="wallet-connect" type="button" onClick={openConnectModal}>连接钱包</button>
            ) : chain.unsupported || chainId !== ARC_CHAIN_ID ? (
              <button className="wallet-connect wrong" type="button" onClick={openChainModal}>切换到 Arc</button>
            ) : (
              <>
                <button className="wallet-chip" type="button" onClick={openAccountModal}>
                  <span data-wallet-network>Arc Testnet</span>
                  <strong data-wallet-address>{shortHash(address ?? account.address)}</strong>
                  <small>
                    <b data-wallet-token-balance>{tokenValue === null ? "读取中" : `${formatUsdc6(tokenValue)} USDC`}</b>
                    <i>ERC-20</i>
                    <b data-wallet-native-balance>{nativeBalance.data ? `${Number(formatUnits(nativeBalance.data.value, 18)).toFixed(6)} USDC` : "读取中"}</b>
                    <i>gas</i>
                  </small>
                </button>
              </>
            )}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}

function ProgressDock({
  connected,
  session,
  questionResult,
  receipts,
  deadlineReached,
}: {
  connected: boolean;
  session: DemoSession | null;
  questionResult: QuestionOracleResult | null;
  receipts: readonly LocalReceipt[];
  deadlineReached: boolean;
}) {
  const transactions = new Map<string, { kind: DemoTransaction["kind"]; hash: Hex }>();
  for (const receipt of receipts) transactions.set(receipt.hash.toLowerCase(), receipt);
  for (const item of session?.transactions ?? []) transactions.set(item.hash.toLowerCase(), item);
  const values = [...transactions.values()];
  const completed: Record<StepKey, boolean> = {
    wallet: connected,
    commit: values.some((item) => item.kind === "commit" || item.kind === "reading-fee"),
    reveal: session?.hexagram != null || questionResult != null,
    predictions: session?.predictions.length === 3 || questionResult?.readings.length === 3,
    waiting: questionResult != null || deadlineReached || session?.phase === "settling" || session?.phase === "settled",
    settlement: questionResult != null || session?.phase === "settled",
  };
  const current = PROGRESS_STEPS.find((step) => !completed[step.key])?.key ?? "settlement";
  const kinds: Record<StepKey, DemoTransaction["kind"][]> = {
    wallet: [],
    commit: ["approval", "reading-fee", "commit", "fee-distribution"],
    reveal: ["reveal"],
    predictions: ["prediction", "fee-distribution"],
    waiting: [],
    settlement: ["settlement"],
  };

  const completeCount = PROGRESS_STEPS.filter((step) => completed[step.key]).length;
  const currentStep = PROGRESS_STEPS.find((step) => step.key === current)!;
  return (
    <details className="progress-dock">
      <summary className="status-line">
        <span data-state={completeCount === PROGRESS_STEPS.length ? "complete" : "current"}></span>
        <strong>{completeCount === PROGRESS_STEPS.length ? "完成" : currentStep.label}</strong>
        <small>0.050000 USDC</small>
        <b>{values.length} 笔交易・查看</b>
      </summary>
      <nav className="progress-details" aria-label="本轮问卦进度">
        <ol>
        {PROGRESS_STEPS.map((step) => {
          const state = completed[step.key] ? "complete" : current === step.key ? "current" : "pending";
          const userStep = step.key === "wallet" || step.key === "commit";
          return (
            <li key={step.key} data-step={step.key} data-state={state}>
              <span className="step-mark">{step.numeral}</span>
              <div>
                <strong>{step.label}</strong>
                <small>{state === "complete" ? "已完成" : state === "current" ? (userStep ? "需要你操作" : "自动进行中") : "尚未开始"}</small>
                <p>
                  {values.filter((item) => kinds[step.key].includes(item.kind)).map(({ hash }) => (
                    <a key={hash} href={transactionLink(hash)} target="_blank" rel="noreferrer" title="在 Arc Explorer 查看交易">
                      {shortHash(hash)}
                    </a>
                  ))}
                </p>
              </div>
            </li>
          );
        })}
        </ol>
      </nav>
    </details>
  );
}

function TimingPanel({ session }: { session: DemoSession | null }) {
  const timings = session?.timings ?? TIMING_LABELS.map((label) => ({
    key: label,
    label,
    estimatedMilliseconds: 0,
    actualMilliseconds: null,
  }));
  return (
    <details className="timing-card" data-stage-timings>
      <summary>阶段耗时</summary>
      <div>
        <header><span>每一步在等什么</span><small>预计 / 实际</small></header>
        <ol>
          {timings.map((timing) => (
            <li key={timing.key}>
              <span>{timing.label}</span>
              <b>{timing.estimatedMilliseconds > 0 ? formatDuration(timing.estimatedMilliseconds) : "待准备"}</b>
              <strong>{formatDuration(timing.actualMilliseconds)}</strong>
            </li>
          ))}
        </ol>
      </div>
    </details>
  );
}

function HexagramLines({
  lines,
  changingPositions,
  derived,
  visibleCount,
}: {
  lines: readonly number[];
  changingPositions: readonly number[];
  derived: boolean;
  visibleCount: number;
}) {
  const changing = new Set(changingPositions);
  return (
    <div className="hexagram-lines">
      {lines.map((value, index) => {
        const primaryYang = value === 7 || value === 9;
        const yang = derived && changing.has(index + 1) ? !primaryYang : primaryYang;
        const changed = changing.has(index + 1);
        return (
          <span
            className={`hex-line ${yang ? "yang" : "yin"}${changed ? " changing" : ""}`}
            data-revealed={index < visibleCount}
            key={`${derived ? "d" : "p"}-${index}`}
          >
            <i></i><i></i>
          </span>
        );
      })}
    </div>
  );
}

function FigureLines({
  figure,
  changingPositions,
  visibleCount,
}: {
  figure: HexagramFigure;
  changingPositions: readonly number[];
  visibleCount: number;
}) {
  const changing = new Set(changingPositions);
  return (
    <div className="hexagram-lines figure-lines" aria-hidden="true">
      {figure.yangLines.map((yang, index) => {
        const changed = (figure.kind === "primary" || figure.kind === "derived") && changing.has(index + 1);
        return (
          <span
            className={`hex-line ${yang ? "yang" : "yin"}${changed ? " changing" : ""}`}
            data-revealed={index < visibleCount}
            key={`${figure.kind}-${index}`}
          >
            <i></i><i></i>
          </span>
        );
      })}
    </div>
  );
}

function TermDisclosure({
  term,
  value,
  definition,
  actual,
}: {
  term: string;
  value?: string;
  definition: string;
  actual: string;
}) {
  return (
    <details className="term-disclosure">
      <summary><span>{term}</span>{value && <strong>{value}</strong>}</summary>
      <div><p><b>是什么：</b>{definition}</p><p><b>这一卦里：</b>{actual}</p></div>
    </details>
  );
}

const FIGURE_DEFINITIONS: Record<HexagramKind, string> = {
  primary: "本卦由起出的六爻直接组成，用来陈列当前问题的起点。",
  mutual: "互卦抽取本卦二至五爻重新成卦，用来换一个角度看内部结构。",
  derived: "变卦只翻转老阴与老阳，呈现动爻改变后的结构。",
  opposite: "错卦把本卦每爻阴阳全反，作为反面条件的参照。",
  reversed: "综卦把六爻次序上下颠倒，作为位置互换后的参照。",
};

function FiveHexagramConstellation({
  five,
  changingPositions,
  visibleCount,
}: {
  five: FiveHexagrams;
  changingPositions: readonly number[];
  visibleCount: number;
}) {
  const [activeKind, setActiveKind] = useState<HexagramKind>("primary");
  const active = five[activeKind];
  return (
    <section
      className="five-hexagram-constellation"
      data-hexagram-constellation
      aria-label="五卦象群"
    >
      <header className="constellation-header">
        <div><span>卦象</span><strong>五卦</strong></div>
      </header>
      <div className="constellation-grid">
        {FIVE_HEXAGRAM_ORDER.map((kind) => {
          const figure = five[kind];
          return (
            <button
              type="button"
              className="hexagram-node"
              data-kind={figure.kind}
              data-hexagram-kind={figure.kind}
              aria-pressed={activeKind === figure.kind}
              onClick={() => setActiveKind(figure.kind)}
              key={figure.kind}
            >
              <span>{figure.label}<small>{figure.meaning}</small></span>
              <FigureLines figure={figure} changingPositions={changingPositions} visibleCount={visibleCount} />
              <strong>{figure.kingWenNumber}・{figure.name}</strong>
            </button>
          );
        })}
      </div>
      <div className="constellation-focus" aria-live="polite">
        <span>{active.label} / {active.meaning}</span>
        <strong>{active.kingWenNumber}・{active.name}</strong>
        <p><b>卦辞</b>{active.judgement}</p>
        <TermDisclosure
          term="卦义"
          definition={FIGURE_DEFINITIONS[active.kind]}
          actual={`${active.derivation} 当前选中的${active.label}是${active.name}；上方卦辞来自项目现有《周易》语料。`}
        />
      </div>
    </section>
  );
}

function TableLine({ yang, changing, value }: { yang: boolean; changing: boolean; value: number }) {
  return (
    <span className={`table-line ${yang ? "yang" : "yin"}${changing ? " changing" : ""}`}>
      <i></i><i></i><b>{changing ? (value === 9 ? "○" : "×") : value}</b>
      <span className="sr-only">{yang ? "阳爻" : "阴爻"}{changing ? "，动爻" : ""}</span>
    </span>
  );
}

const POSITION_EXPLANATIONS = [
  "初爻主足／基层，指最下方、最贴近日常执行的位置。",
  "二爻主腹／家宅，指内部生活与承接的位置。",
  "三爻主股／门户，指进退转换的门槛位置。",
  "四爻主胸／门外，指由内转外、接触外部条件的位置。",
  "五爻主君位，指居中主持与作决定的位置。",
  "上爻主首／宗庙，指事情最上层或走到尽头的位置。",
] as const;

const SPIRIT_DEFINITIONS: Record<string, string> = {
  青龙: "六神之一，传统排盘的轮值象征名；随日干从初爻顺排。",
  朱雀: "六神之一，传统排盘的轮值象征名；随日干从初爻顺排。",
  勾陈: "六神之一，传统排盘的轮值象征名；随日干从初爻顺排。",
  螣蛇: "六神之一，传统排盘的轮值象征名；随日干从初爻顺排。",
  白虎: "六神之一，传统排盘的轮值象征名；随日干从初爻顺排。",
  玄武: "六神之一，传统排盘的轮值象征名；随日干从初爻顺排。",
};

const RELATION_DEFINITIONS: Record<string, string> = {
  父母: "六亲之一，由爻支五行与卦宫五行的生克关系确定，常用于房产、单位与文书契约。",
  子孙: "六亲之一，由爻支五行与卦宫五行的生克关系确定，常用于技术、医药、解忧与子女。",
  官鬼: "六亲之一，由爻支五行与卦宫五行的生克关系确定，常用于工作、官职、疾病与忧虑。",
  妻财: "六亲之一，由爻支五行与卦宫五行的生克关系确定，常用于钱财、物价、货品与债务。",
  兄弟: "六亲之一，由爻支五行与卦宫五行的生克关系确定，常用于同辈、朋友、同事与竞争者。",
};

function lineName(position: number): string {
  return position === 6 ? "上爻" : position === 1 ? "初爻" : `${CHINESE_NUMERALS[position]}爻`;
}

function positionsText(positions: readonly number[]): string {
  return positions.length ? positions.map(lineName).join("、") : "本卦明爻未出现";
}

function NajiaCell({
  value,
  position,
  isUseGod,
}: {
  value: LiuyaoChart["rows"][number]["primary"];
  position: number;
  isUseGod: boolean;
}) {
  const states = [value.isVoid ? "旬空" : "不空", value.isMonthBroken ? "月破" : "非月破"].join("、");
  return (
    <span className="najia-cell">
      <TermDisclosure
        term={value.relation}
        {...(isUseGod ? { value: "用神" } : {})}
        definition={RELATION_DEFINITIONS[value.relation] ?? "六亲是爻支五行与卦宫五行比较后得到的关系名。"}
        actual={`${lineName(position)}纳${value.stemBranch}${value.element}，六亲为${value.relation}${isUseGod ? "，正是用户确认的用神" : ""}；月令强弱为${value.strength}，${states}。`}
      />
      <small>纳甲 {value.stemBranch}・{value.element}　旺衰 {value.strength}</small>
      {value.isVoid && <em>空</em>}
      {value.isMonthBroken && <em>月破</em>}
    </span>
  );
}

const ELEMENT_POINTS: Record<FiveElement, { x: number; y: number }> = {
  木: { x: 140, y: 24 },
  火: { x: 238, y: 95 },
  土: { x: 201, y: 210 },
  金: { x: 79, y: 210 },
  水: { x: 42, y: 95 },
};
const GENERATING_EDGES: ReadonlyArray<[FiveElement, FiveElement, string]> = [
  ["木", "火", "木生火"], ["火", "土", "火生土"], ["土", "金", "土生金"], ["金", "水", "金生水"], ["水", "木", "水生木"],
];
const OVERCOMING_EDGES: ReadonlyArray<[FiveElement, FiveElement, string]> = [
  ["木", "土", "木克土"], ["土", "水", "土克水"], ["水", "火", "水克火"], ["火", "金", "火克金"], ["金", "木", "金克木"],
];

function FiveElementsPanel({ result }: { result: QuestionOracleResult }) {
  const { chart } = result;
  const focus = chart.focus;
  const strengthMeaning = (row: LiuyaoChart["rows"][number]): string => {
    const isUseGod = row.primary.relation === focus?.useGod;
    const strong = row.primary.strength === "旺" || row.primary.strength === "相";
    if (isUseGod) {
      return strong
        ? `此爻正是本题用神，月令为${row.primary.strength}，表示当前季令给它的支持较强；仍须合看空破、世应与动变。`
        : `此爻正是本题用神，月令为${row.primary.strength}，表示当前季令支持偏弱；弱不等于必凶，仍须合看空破、世应与动变。`;
    }
    const role = row.primary.relation === focus?.originalGod
      ? "原神（生用神）"
      : row.primary.relation === focus?.tabooGod
        ? "忌神（克用神）"
        : row.primary.relation === focus?.enemyGod ? "仇神（生忌神）" : "旁证六亲";
    return `它不是本题用神，在用神体系中作${role}观察；月令为${row.primary.strength}，只说明季令强弱，不单独等于吉凶。`;
  };
  return (
    <section className="five-elements-panel" data-five-elements aria-labelledby="five-elements-title">
      <header>
        <div><span>五行生克</span><h3 id="five-elements-title">从纳甲到六亲，不跳步</h3></div>
        <p>卦宫五行为{chart.palace.element}，在六亲比较里就是“我”。每一爻先由纳甲地支取得五行，再与“我”比较。</p>
      </header>
      <div className="five-elements-overview">
        <figure className="five-elements-diagram" aria-label="五行相生环与相克星">
          <svg viewBox="0 0 280 238" role="img" aria-labelledby="five-elements-diagram-title">
            <title id="five-elements-diagram-title">金色相生环与朱红相克星</title>
            <defs>
              <marker id="arrow-generate" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 Z" /></marker>
              <marker id="arrow-overcome" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 Z" /></marker>
            </defs>
            <g className="element-generate">
              {GENERATING_EDGES.map(([from, to, label]) => <line key={label} x1={ELEMENT_POINTS[from].x} y1={ELEMENT_POINTS[from].y} x2={ELEMENT_POINTS[to].x} y2={ELEMENT_POINTS[to].y} markerEnd="url(#arrow-generate)" />)}
            </g>
            <g className="element-overcome">
              {OVERCOMING_EDGES.map(([from, to, label]) => <line key={label} x1={ELEMENT_POINTS[from].x} y1={ELEMENT_POINTS[from].y} x2={ELEMENT_POINTS[to].x} y2={ELEMENT_POINTS[to].y} markerEnd="url(#arrow-overcome)" />)}
            </g>
            {(Object.keys(ELEMENT_POINTS) as FiveElement[]).map((element) => <g className="element-node" data-active={chart.palace.element === element} key={element} transform={`translate(${ELEMENT_POINTS[element].x} ${ELEMENT_POINTS[element].y})`}><circle r="20" /><text textAnchor="middle" dy="5">{element}</text></g>)}
          </svg>
          <figcaption><span><i className="element-generate-key"></i>相生环</span><span><i className="element-overcome-key"></i>相克星</span></figcaption>
        </figure>
        <div className="element-relations">
          <TermDisclosure term="相生环" value="木 → 火 → 土 → 金 → 水 → 木" definition="相生表示一行滋生下一行：木生火、火生土、土生金、金生水、水生木。" actual={`本卦以${chart.palace.element}为“我”；相生箭头用来判断“生我”的父母与“我生”的子孙。`} />
          <TermDisclosure term="相克星" value="木 → 土 → 水 → 火 → 金 → 木" definition="相克表示一行制约另一行：木克土、土克水、水克火、火克金、金克木。" actual={`本卦以${chart.palace.element}为“我”；相克箭头用来判断“克我”的官鬼与“我克”的妻财。`} />
          <TermDisclosure term="本卦上下卦" value={`上${chart.trigrams.upper.name}${chart.trigrams.upper.element}・下${chart.trigrams.lower.name}${chart.trigrams.lower.element}`} definition="六爻上三爻组成上卦，下三爻组成下卦；八经卦各有固定五行属性。" actual={`本卦上卦为${chart.trigrams.upper.name}、属${chart.trigrams.upper.element}；下卦为${chart.trigrams.lower.name}、属${chart.trigrams.lower.element}。这两个属性描述卦体，逐爻六亲仍以卦宫${chart.palace.element}为“我”。`} />
          <TermDisclosure term="卦宫之我" value={`${chart.palace.name}宫・${chart.palace.element}`} definition="八宫归属给本卦一个宫五行；排六亲时把宫五行称作“我”，不是把提问者本人简化成一种元素。" actual={`本卦归${chart.palace.name}宫，卦宫五行为${chart.palace.element}，在六亲公式中为“我”。同我为兄弟，生我为父母，我生为子孙，克我为官鬼，我克为妻财。`} />
        </div>
      </div>
      <div className="element-line-grid" aria-label="逐爻五行与六亲推导">
        {[...chart.rows].reverse().map((row) => {
          const relation = describeElementRelation(chart.palace.element, row.primary.element);
          return <TermDisclosure
            key={row.position}
            term={`${lineName(row.position)}・${row.primary.element}`}
            value={`${row.primary.stemBranch} → ${relation.relation}・${row.primary.strength}`}
            definition="这一项把纳甲地支的五行与卦宫之“我”逐项比较，并接到当月旺相休囚死。"
            actual={`卦宫五行为${chart.palace.element}（${chart.palace.name}宫），是“我”。${lineName(row.position)}纳甲为「${row.primary.stemBranch}・${row.primary.element}」，${relation.explanation}。这就是这一爻被定为${relation.relation}的原因。${strengthMeaning(row)}`}
          />;
        })}
      </div>
    </section>
  );
}

function LiuyaoChartTable({ result }: { result: QuestionOracleResult }) {
  const { chart } = result;
  const focus = chart.focus;
  const shi = chart.rows[chart.shiPosition - 1]!;
  const ying = chart.rows[chart.yingPosition - 1]!;
  const movingRows = chart.rows.filter((row) => row.changing || row.isHiddenMoving);
  const strongRows = chart.rows.filter((row) => row.primary.strength === "旺" || row.primary.strength === "相");
  const originalPositions = focus ? chart.rows.filter((row) => row.primary.relation === focus.originalGod).map((row) => row.position) : [];
  const tabooPositions = focus ? chart.rows.filter((row) => row.primary.relation === focus.tabooGod).map((row) => row.position) : [];
  const enemyPositions = focus ? chart.rows.filter((row) => row.primary.relation === focus.enemyGod).map((row) => row.position) : [];
  const movementSummary = movingRows.length
    ? movingRows.map((row) => `${lineName(row.position)}${row.isHiddenMoving ? "暗动" : "动"}${row.advanceRetreat ? `・${row.advanceRetreat}` : ""}${row.returnEffect ? `・${row.returnEffect}` : ""}`).join("；")
    : "本卦没有动爻或暗动爻，动变层按静卦读取。";
  return (
    <section className="liuyao-chart" data-liuyao-chart aria-labelledby="liuyao-chart-title">
      <header>
        <div>
          <span>六爻装卦</span>
          <h2 id="liuyao-chart-title">{chart.palace.name}宫・{chart.palace.element}・{chart.palace.sequence}</h2>
        </div>
        <dl>
          <div><dt>取时区块</dt><dd>#{result.block.number}</dd></div>
          <div><dt>区块时间戳</dt><dd>{result.block.timestamp}</dd></div>
          <div><dt>日干支</dt><dd>{chart.day.localDate}・{chart.day.ganzhi}日</dd></div>
          <div><dt>月建</dt><dd>{chart.month.branch}月・{chart.month.element}（{chart.month.range}）</dd></div>
          <div><dt>旬空</dt><dd>{chart.day.voidBranches.join("、")}</dd></div>
        </dl>
      </header>
      <FiveElementsPanel result={result} />
      <section className="reading-guide" aria-labelledby="reading-guide-title">
        <span>先后有序，才不被术语淹没</span>
        <h3 id="reading-guide-title">这一卦怎么读</h3>
        <ol>
          <li><strong>用神</strong><p>你最终确认事项为“{result.subject.label}”，所以先看{focus?.useGod ?? result.subject.useGod}：{positionsText(focus?.useGodPositions ?? [])}{focus?.hiddenUseGodPositions.length ? `；伏在${positionsText(focus.hiddenUseGodPositions)}` : ""}。</p></li>
          <li><strong>旺衰</strong><p>{chart.month.branch}月属{chart.month.element}，按《三命通会》五级表，旺相爻在{positionsText(strongRows.map((row) => row.position))}；这只是月令强弱标签，不单独等于吉凶。</p></li>
          <li><strong>原神／忌神／仇神</strong><p>生用神的{focus?.originalGod}在{positionsText(originalPositions)}；克用神的{focus?.tabooGod}在{positionsText(tabooPositions)}；生忌神的{focus?.enemyGod}在{positionsText(enemyPositions)}。</p></li>
          <li><strong>世应</strong><p>世爻在{lineName(chart.shiPosition)}（{shi.positionSymbol}）代表自己，应爻在{lineName(chart.yingPosition)}（{ying.positionSymbol}）代表对方或环境；先比较两处再下判断。</p></li>
          <li><strong>动变</strong><p>{movementSummary}</p></li>
        </ol>
      </section>
      <div className="chart-term-grid">
        <TermDisclosure term="用神" value={focus?.useGod ?? result.subject.useGod} definition="所问事项对应的核心六亲，是本次排盘先追踪的爻；它不是模型从卦象猜出的。" actual={`事项分类器建议“${result.subject.label}”，你${result.subject.overridden ? "已否决原建议并改选" : "确认沿用建议"}，因此取${focus?.useGod ?? result.subject.useGod}；明爻位置为${positionsText(focus?.useGodPositions ?? [])}。`} />
        <TermDisclosure term="卦宫" value={`${chart.palace.name}宫・${chart.palace.sequence}`} definition="八宫法把六十四卦归入乾坎艮震巽离坤兑，并标记从本宫卦变化到第几世。游魂是第七位，归魂是第八位。" actual={`本卦归${chart.palace.name}宫，宫五行为${chart.palace.element}，位于“${chart.palace.sequence}”。${chart.palace.sequence === "游魂" ? "游魂口径决定世在四、应在初" : chart.palace.sequence === "归魂" ? "归魂口径决定世在三、应在上" : "世应位置按这一宫序确定"}。`} />
        <TermDisclosure term="世爻" value={lineName(chart.shiPosition)} definition="世爻代表提问者自己；与代表对方或环境的应爻相对。" actual={`世在${lineName(chart.shiPosition)}，${POSITION_EXPLANATIONS[chart.shiPosition - 1]} 此爻为${shi.primary.relation}、${shi.primary.strength}。`} />
        <TermDisclosure term="应爻" value={lineName(chart.yingPosition)} definition="应爻代表与提问者相对的对象、环境或外部条件。" actual={`应在${lineName(chart.yingPosition)}，${POSITION_EXPLANATIONS[chart.yingPosition - 1]} 此爻为${ying.primary.relation}、${ying.primary.strength}。`} />
        <TermDisclosure term="月建" value={`${chart.month.branch}月・${chart.month.element}`} definition="月建按太阳节气划月，不按公历每月一日切换，用于判断各爻月令强弱与月破。" actual={`区块时间落在${chart.month.range}，故取${chart.month.branch}月；${chart.month.boundaryUncertain ? "时间靠近节气交界，界面不把月令当作确定结论。" : "未落入本实现的节气交界不确定窗口。"}`} />
        <TermDisclosure term="旺相休囚死" value={`${chart.month.branch}月五级表`} definition="本界面采用《三命通会》逐季五级表：同月令五行为旺、月令所生为相、生月令为休、克月令为囚、受月令克为死。" actual={`六爻依次为${chart.rows.map((row) => `${lineName(row.position)}${row.primary.strength}`).join("、")}。`} />
        <TermDisclosure term="旬空" value={chart.day.voidBranches.join("、")} definition="六十甲子每旬有两个未配到天干的地支，称旬空；这里只作排盘标记。" actual={`${chart.day.ganzhi}日的旬空是${chart.day.voidBranches.join("、")}；标“空”的爻支正落在这两支。`} />
        <TermDisclosure term="六神" value="青龙至玄武" definition="青龙、朱雀、勾陈、螣蛇、白虎、玄武是随日干轮排的六个传统象征名，不是六亲，也不是旺衰。" actual={`${chart.day.stem}日从初爻起依次排为${chart.rows.map((row) => row.sixSpirit).join("、")}。`} />
        <TermDisclosure term="伏神" value={chart.rows.some((row) => row.hidden) ? "本卦有伏神" : "本卦无伏神"} definition="本卦缺少某类六亲时，按本宫首卦相同爻位补出的隐藏六亲。" actual={chart.rows.some((row) => row.hidden) ? chart.rows.filter((row) => row.hidden).map((row) => `${lineName(row.position)}伏${row.hidden?.relation}${row.hidden?.stemBranch}`).join("；") : "本卦五类六亲已显，不需从本宫首卦补伏神。"} />
        <TermDisclosure term="纳甲／六亲" value="逐爻可展开" definition="纳甲把天干地支装入六爻；六亲再用爻支五行与卦宫五行的生克关系命名。" actual={`本卦以${chart.palace.name}宫${chart.palace.element}为比较基准；点击表中每个六亲可看该爻的纳甲、旺衰与是否空破。`} />
        <TermDisclosure term="月破／日破／暗动" definition="月建冲爻为月破；日辰冲休囚静爻为日破，冲旺相静爻为暗动。本界面不把三者混写。" actual={`月破在${positionsText(chart.rows.filter((row) => row.primary.isMonthBroken).map((row) => row.position))}；日破在${positionsText(chart.rows.filter((row) => row.isDayBroken).map((row) => row.position))}；暗动在${positionsText(chart.rows.filter((row) => row.isHiddenMoving).map((row) => row.position))}。`} />
        <TermDisclosure term="进神／退神" definition="动爻地支变到《增删卜易》固定顺逆对时，分别标进神或退神；不是按十二支简单相邻推测。" actual={chart.rows.some((row) => row.advanceRetreat) ? chart.rows.filter((row) => row.advanceRetreat).map((row) => `${lineName(row.position)}${row.primary.branch}变${row.changed.branch}为${row.advanceRetreat}`).join("；") : "本卦动爻没有命中固定进退神对。"} />
        <TermDisclosure term="回头生／回头克" definition="同一动爻的变爻五行回过来生或克本爻，分别称回头生、回头克。" actual={chart.rows.some((row) => row.returnEffect) ? chart.rows.filter((row) => row.returnEffect).map((row) => `${lineName(row.position)}${row.changed.element}对${row.primary.element}为${row.returnEffect}`).join("；") : "本卦动爻与同位变爻没有形成回头生或回头克。"} />
        <TermDisclosure term="六冲／六合" value={chart.nature.primary ?? "非六冲六合"} definition="六冲卦、六合卦按《增删卜易》所列固定卦名表识别，用于描述卦的合冲性质。" actual={`本卦${chart.nature.primary ? `属于${chart.nature.primary}卦` : "不在六冲或六合固定表中"}；变卦${chart.nature.derived ? `属于${chart.nature.derived}卦` : "不在该固定表中"}。`} />
      </div>
      <div className="chart-scroll" tabIndex={0} aria-label="六爻排盘表，可横向滚动">
        <table className="liuyao-table">
          <thead>
            <tr>
              <th scope="col">六神</th>
              <th scope="col">伏神</th>
              <th scope="col">本卦（纳甲・六亲）</th>
              <th scope="col">爻象</th>
              <th scope="col">世应</th>
              <th scope="col">变卦（纳甲・六亲）</th>
            </tr>
          </thead>
          <tbody>
            {[...chart.rows].reverse().map((row) => (
              <tr data-changing={row.changing} key={row.position}>
                <td className="six-spirit" data-tone={["朱雀", "螣蛇", "白虎"].includes(row.sixSpirit) ? "vermilion" : "gold"}><TermDisclosure term={row.sixSpirit} definition={SPIRIT_DEFINITIONS[row.sixSpirit] ?? "六神之一。"} actual={`${chart.day.stem}日起法把${row.sixSpirit}排在${lineName(row.position)}；它不改变该爻的旺衰等级。`} /></td>
                <td className="hidden-spirit">{row.hidden ? <TermDisclosure term={row.hidden.relation} value="伏神" definition="这是本宫首卦在同位补出的隐藏六亲。" actual={`${lineName(row.position)}伏${row.hidden.relation}${row.hidden.stemBranch}${row.hidden.element}${row.hidden.isVoid ? "，且旬空" : ""}。`} /> : <span>—</span>}</td>
                <td><NajiaCell value={row.primary} position={row.position} isUseGod={row.primary.relation === focus?.useGod} /></td>
                <td className="line-cell"><TableLine yang={row.primaryYang} changing={row.changing} value={row.value} /><small>{lineName(row.position)}・{row.positionSymbol}</small>{row.isDayBroken && <em>日破</em>}{row.isHiddenMoving && <em>暗动</em>}</td>
                <td className="shi-ying">{row.marker ?? "·"}</td>
                <td><NajiaCell value={row.changed} position={row.position} isUseGod={row.changed.relation === focus?.useGod} />{row.advanceRetreat && <em>{row.advanceRetreat}</em>}{row.returnEffect && <em>{row.returnEffect}</em>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <footer>
        <p><strong>所依流派：</strong>京房纳甲・八宫世应・六甲旬空；用神、伏神、月破、日破、暗动与动变规则依《增删卜易》。</p>
        <p><strong>历法与旺衰：</strong>区块时间戳转 UTC+8，00:00 换日，不采用子初换日；月建按太阳视黄经节气月。五级“旺相休囚死”明确依《三命通会》，因为《增删卜易》该章把其余合称休囚，并未给出同一张五级表。</p>
        <p><strong>本轮边界：</strong>卦辞已有语料；彖辞与大象辞因项目语料缺失未展示。未实现应期、日月合与十二长生，避免在未选流派时混写。</p>
        <a href="https://ancient-china-books.github.io/zhouyijijiezhuanshu/OEBPS/Text/4157.html" target="_blank" rel="noreferrer">纳甲、六亲出处</a>
        <a href="https://data.guoxueruanjian.com/books/增删卜易（校对：中国男儿）.pdf" target="_blank" rel="noreferrer">《增删卜易》规则</a>
        <a href="https://zh.wikisource.org/wiki/三命通會/卷二" target="_blank" rel="noreferrer">《三命通会》旺衰表</a>
        <a href="https://fatetree.cn/yijing-jingfang-najia.html" target="_blank" rel="noreferrer">八宫对照表</a>
      </footer>
    </section>
  );
}

function DivinerGrid({ session }: { session: DemoSession | null }) {
  const changes = new Map((session?.vaultChanges ?? []).map((item) => [item.divinerKey, item]));
  return (
    <>
      <div className="diviner-heading">
        <span>三家怎么说</span>
      </div>
      <div className="diviner-grid" data-diviner-grid>
        {DIVINERS.map((diviner) => {
          const prediction = session?.predictions.find((item) => item.divinerKey === diviner.key);
          const change = changes.get(diviner.key);
          const working = session?.phase === "compiling" || session?.phase === "predicting";
          const delta = change ? BigInt(change.deltaUsdc6) : null;
          const state = change ? (delta! < 0n ? "lost" : "won") : prediction ? "answered" : working ? "working" : "waiting";
          return (
            <article className="diviner-card" data-diviner-card={diviner.key} data-state={state} key={diviner.key}>
              <header><span>{diviner.numeral}</span><strong>{diviner.name}</strong></header>
              <p className="diviner-verdict">{prediction ? probabilityPhrase(prediction.probabilityBps) : working ? "正在解卦" : "等待应卦"}</p>
              <p className="diviner-reason">{prediction?.reasoning ?? diviner.waiting}</p>
              <footer>
                <strong>留给你的动作</strong>
                <span>{prediction ? (session?.phase === "settled" ? "查看事实与结算。" : session?.horizon === "short" ? "到约定时点，按事实见证。" : "等待截止，再按事实见证。") : "等待三家应卦。"}</span>
              </footer>
            </article>
          );
        })}
      </div>
      {session && (session.predictions.length > 0 || session.vaultChanges.length > 0) && (
        <details className="diviner-finance-details">
          <summary>押注、概率与凭证</summary>
          <div>
            {DIVINERS.map((diviner) => {
              const prediction = session.predictions.find((item) => item.divinerKey === diviner.key);
              const feeTransaction = session.transactions.find((item) => item.kind === "fee-distribution" && item.label.includes(diviner.name));
              const change = changes.get(diviner.key);
              const delta = change ? BigInt(change.deltaUsdc6) : null;
              return (
                <section key={diviner.key}>
                  <strong>{diviner.name}</strong>
                  {prediction && <p><b>已收卦金 {feeTransaction?.amountUsdc6 ? formatUsdc6(BigInt(feeTransaction.amountUsdc6)) : "待分账"} USDC・另押上 {formatUsdc6(50_000n * BigInt(prediction.multiplier))} USDC</b><span>精确概率 {percentage(prediction.probabilityBps)} ・ <a href={transactionLink(prediction.transaction.hash)} target="_blank" rel="noreferrer">{shortHash(prediction.transaction.hash)}</a>{feeTransaction && <> ・ <a href={transactionLink(feeTransaction.hash)} target="_blank" rel="noreferrer">分账凭证</a></>}</span></p>}
                  {change && delta !== null && <p><b>{delta < 0n ? "这一卦赔了钱" : "这一卦赢了钱"}</b><span>金库 {formatUsdc6(BigInt(change.beforeUsdc6))} → {formatUsdc6(BigInt(change.afterUsdc6))} USDC</span></p>}
                </section>
              );
            })}
          </div>
        </details>
      )}
    </>
  );
}

function QuestionReadingGrid({
  result,
  subjectBusy,
  onSubjectChange,
}: {
  result: QuestionOracleResult | null;
  subjectBusy: boolean;
  onSubjectChange: (subject: QuestionSubjectKey) => void;
}) {
  return (
    <>
      <div className="diviner-heading">
        <span>三家怎么说</span>
      </div>
      {result && (
        <details className="subject-control" data-subject-control>
          <summary><span>按{result.subject.label}取{result.subject.useGod}</span><b>{subjectBusy ? "重算中" : "修改"}</b></summary>
          <label>
            <span>事项主题</span>
            <select
              aria-label="修改事项主题"
              value={result.subject.key}
              disabled={subjectBusy}
              onChange={(event) => onSubjectChange(event.target.value as QuestionSubjectKey)}
            >
              {QUESTION_SUBJECTS.map((subject) => <option value={subject.key} key={subject.key}>{subject.label} → {subject.useGod}</option>)}
            </select>
          </label>
        </details>
      )}
      <div className="diviner-grid question-readings" data-question-readings>
        {DIVINERS.map((diviner) => {
          const reading = result?.readings.find((item) => item.divinerKey === diviner.key);
          return (
            <article className="diviner-card" data-state={reading ? "answered" : "waiting"} key={diviner.key}>
              <header><span>{diviner.numeral}</span><strong>{diviner.name}</strong></header>
              <p className="diviner-reason">{reading?.interpretation ?? diviner.waiting}</p>
              <footer>{reading ? <><strong>留给你的动作</strong><span>{reading.counsel}</span></> : <span>等待解读</span>}</footer>
            </article>
          );
        })}
      </div>
    </>
  );
}

function TruthDrawer() {
  return (
    <details className="truth-drawer">
      <summary>完整披露</summary>
      <div>
        <p><b>解读不是神谕。</b>卦象到具体命题存在解释跳跃；模型推理集中在项目方服务器，属于中心化推理。开发排练使用确定性 mock provider，但它不是用户可见的免费选项。</p>
        <p><b>每卦都收费。</b>0.05 USDC 归提供解读的三位易者金库。不可判定问题不让易者押钱，但仍收卦金；收费之后仍直说“没有人能为它负责”，正是对这门生意的完整指认。</p>
        <p><b>钱包边界明确。</b>点击求卦会自动连接与切换网络；未授权时自动接续固定额度授权，稳态只需一次钱包确认。賭轨由服务端托管同地址演示账户自动揭示，并代发无许可结算；浏览器不接触私钥或 salt。</p>
        <p><b>历史不是现场。</b>标为 backtested 的历史数据回放是非现场结果，只用于检查计分和前视偏差，不证明《易经》或模型有预测力。</p>
        <p><b>事实来源有边界。</b>賭轨的人层依赖提问者与白名单人类 attestor；双方不一致即为未决之卦。天层语义是“截止块后首次观察到的值”，只留在卦历和数据证据中。</p>
        <p><b>少赔不等于变准。</b>倍率收缩说明风险管理生效，不表示预测能力提高。</p>
        <p><b>完整责任指认。</b>你刚刚已经支付卦金，钱分进了三位易者的金库。你问的这件事，没有一个将来会揭晓的答案。所以没有人能为它负责——包括刚刚收过你钱的我们。我们仍然可以为你解这一卦。</p>
      </div>
    </details>
  );
}

function HistoryPage() {
  const [rounds, setRounds] = useState<HistoryRound[]>([]);
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const [message, setMessage] = useState("正在读取 Arc Testnet");

  useEffect(() => {
    let active = true;
    void fetch("/api/oracle", { headers: { accept: "application/json" } })
      .then(async (response) => {
        if (!response.ok) throw new Error("卦历读取失败");
        return response.json() as Promise<OracleSnapshot | { empty: true; message: string }>;
      })
      .then((payload) => {
        if (!active) return;
        if ("empty" in payload) {
          setMessage("Arc Testnet ・ 暂无现场记录");
          setRounds([]);
          return;
        }
        setMessage(`${payload.chain.name} ・ 区块 ${payload.chain.latestBlock}`);
        setRounds([...payload.history.live, ...payload.history.backtested]);
      })
      .catch(() => {
        if (active) setMessage("卦历暂时读不到，问卦工作台仍可独立使用。");
      });
    return () => { active = false; };
  }, []);

  const filtered = rounds.filter((round) => filter === "all"
    || (filter === "yes" && round.outcome === true)
    || (filter === "no" && round.outcome === false)
    || (filter === "pending" && round.outcome === null));

  return (
    <section className="page history-page" data-page="history" aria-labelledby="history-title">
      <header className="history-header">
        <div><p className="eyebrow">ARCHIVE / 卦历</p><h1 id="history-title">每一卦，谁说了什么，谁付了代价。</h1></div>
        <p>{message}</p>
      </header>
      <div className="history-toolbar" aria-label="按结果筛选卦历">
        {([
          ["all", "全部"], ["yes", "事实为是"], ["no", "事实为否"], ["pending", "尚未结算"],
        ] as const).map(([value, label]) => (
          <button className={filter === value ? "active" : ""} type="button" onClick={() => setFilter(value)} key={value}>{label}</button>
        ))}
        <span>{filtered.length.toLocaleString("zh-CN")} 卦</span>
      </div>
      <div className="history-list" aria-live="polite">
        {filtered.length === 0 ? (
          <div className="history-empty"><span>空</span><strong>尚无符合条件的卦</strong><p>历史数据回放若出现，会始终标记 backtested・非现场。</p></div>
        ) : filtered.map((round) => (
          <article className="history-card" key={round.id}>
            <header><span className="source-tag" data-source={round.source}>{round.sourceLabel}</span><time>{round.occurredAt}</time></header>
            <h2>{round.question}</h2><p>{round.statement}</p>
            <div><strong>{round.primary.number}・{round.primary.name}</strong><i>之</i><strong>{round.derived.number}・{round.derived.name}</strong><b>{round.outcome === null ? "待" : round.outcome ? "是" : "否"}</b></div>
            <details>
              <summary>展开三家记录</summary>
              {round.predictions.map((prediction) => (
                <p key={prediction.divinerName}><b>{prediction.divinerName}</b><span>{probabilityPhrase(prediction.probabilityBps)}（{percentage(prediction.probabilityBps)}）</span><small>{prediction.settlementDeltaUsdc6 === null ? "尚未结算" : `金库变化 ${formatUsdc6(BigInt(prediction.settlementDeltaUsdc6))} USDC`}</small></p>
              ))}
              <footer>术语：Brier 是概率与事实的平均误差；技能分用于比较“只按历史比例猜”的基线，区间估计用于提醒样本不确定性。</footer>
            </details>
          </article>
        ))}
      </div>
      <aside className="history-disclosure"><strong>两种历史，绝不混写。</strong><p><b>人层・已结算</b>是人间事由提问者见证后实际赔付的轮次；<b>天层・backtested</b> 是 USDC 总量与 agent 计数回放，只作为机制统计证据，不再替代用户的问题。</p></aside>
      <aside className="evidence-panel" aria-label="天层统计证据">
        <span>天层退居证据页</span>
        <strong>这套机制被验证过，不等于易经能预测。</strong>
        <p>1000 回合 backtested 记录持续展示原始 Brier、BSS、Wilson 95% 区间与配对置换检验；现场人间事与历史回放永不混写。</p>
      </aside>
    </section>
  );
}

export function App() {
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const chainId = useChainId();
  const { data: walletClient, refetch: refetchWalletClient } = useWalletClient({ chainId: ARC_CHAIN_ID });
  const publicClient = usePublicClient({ chainId: ARC_CHAIN_ID });
  const { switchChain, switchChainAsync, isPending: switchingNetwork } = useSwitchChain();
  const nativeBalance = useBalance({ address, chainId: ARC_CHAIN_ID, query: { enabled: Boolean(address) } });
  const tokenBalance = useReadContract({
    address: USDC_TOKEN_ADDRESS,
    abi: erc20WalletAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: ARC_CHAIN_ID,
    query: { enabled: Boolean(address) },
  });
  const [page, setPage] = useState<Page>(() => window.location.hash === "#/history" ? "history" : "oracle");
  const [question, setQuestion] = useState("我该不该辞职");
  const [classification, setClassification] = useState<QuestionClassification | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<QuestionSubjectKey | null>(null);
  const [trackOverride, setTrackOverride] = useState<"auto" | QuestionTrack>("auto");
  const [awaitingWallet, setAwaitingWallet] = useState(false);
  const [confirmedTrack, setConfirmedTrack] = useState<QuestionTrack | null>(null);
  const [questionResult, setQuestionResult] = useState<QuestionOracleResult | null>(null);
  const [questionPayment, setQuestionPayment] = useState<QuestionFeeProof | null>(null);
  const [subjectBusy, setSubjectBusy] = useState(false);
  const [session, setSession] = useState<DemoSession | null>(null);
  const [receipts, setReceipts] = useState<LocalReceipt[]>([]);
  const [preview, setPreview] = useState<TransactionPreview | null>(null);
  const [status, setStatus] = useState<StageStatus>(() => phaseDescription(null));
  const [error, setError] = useState("");
  const [flowBusy, setFlowBusy] = useState(false);
  const [settlementBusy, setSettlementBusy] = useState(false);
  const [deadlineReached, setDeadlineReached] = useState(false);
  const [remainingBlocks, setRemainingBlocks] = useState<bigint | null>(null);
  const [ritualCount, setRitualCount] = useState(0);
  const [ritualActive, setRitualActive] = useState(false);
  const [showOptionalSettlement, setShowOptionalSettlement] = useState(false);
  const [walletSignatureCount, setWalletSignatureCount] = useState(0);
  const [recoveryMessage, setRecoveryMessage] = useState("");
  const walletClientRef = useRef(walletClient);

  const connectedToArc = isConnected && chainId === ARC_CHAIN_ID;
  const statusFromSession = useMemo(() => phaseDescription(session), [session]);

  useEffect(() => {
    const route = () => setPage(window.location.hash === "#/history" ? "history" : "oracle");
    window.addEventListener("hashchange", route);
    if (!window.location.hash) window.location.hash = "#/oracle";
    return () => window.removeEventListener("hashchange", route);
  }, []);

  useEffect(() => {
    if (!flowBusy || confirmedTrack !== "wager") return;
    const timer = window.setInterval(() => {
      void fetch("/api/demo", { headers: { accept: "application/json" } })
        .then((response) => response.ok ? response.json() as Promise<DemoSession | null> : null)
        .then((nextSession) => { if (nextSession) setSession(nextSession); })
        .catch(() => undefined);
    }, 450);
    return () => window.clearInterval(timer);
  }, [confirmedTrack, flowBusy]);

  useEffect(() => {
    if (session) setStatus(statusFromSession);
  }, [session, statusFromSession]);

  useEffect(() => {
    walletClientRef.current = walletClient;
  }, [walletClient]);

  const refreshBalances = useCallback(async () => {
    await Promise.all([nativeBalance.refetch(), tokenBalance.refetch()]);
  }, [nativeBalance, tokenBalance]);

  const showFlowError = useCallback((caught: unknown, action = "本轮操作") => {
    const message = caught instanceof Error ? caught.message : "本轮操作暂时没有完成";
    // 诊断插桩：界面按产品规则只显示归类后的中文提示，原始错误仅写入浏览器控制台，便于定位真实失败原因。
    console.error(`[诊断] “${action}”失败`, { name: (caught as Error)?.name, message, cause: (caught as Error)?.cause, raw: caught });
    const walletLike = (typeof caught === "object" && caught !== null && ("code" in caught || "cause" in caught))
      || /insufficient|rejected|chain|network|json-rpc/i.test(message);
    setError(walletLike ? classifyWalletError(caught, action) : message);
    setStatus({
      label: "本轮已中断",
      description: "可以按提示重试，或点击“弃卦重来”立即开始新的一卦。",
      kind: "user",
    });
  }, []);

  const sendUserTransaction = useCallback(async (input: {
    kind: UserTransactionKind;
    action: string;
    contract: Address;
    abi: Abi;
    functionName: string;
    args: readonly unknown[];
    feeUsdc6: bigint;
    bondUsdc6: bigint;
    note: string;
  }): Promise<Hex> => {
    const activeWalletClient = walletClientRef.current;
    if (!address || !activeWalletClient || !publicClient) throw new Error("钱包尚未准备好，请重新连接后再试。");
    let gasUnits = FALLBACK_GAS_UNITS[input.kind];
    try {
      gasUnits = await publicClient.estimateContractGas({
        account: address,
        address: input.contract,
        abi: input.abi,
        functionName: input.functionName,
        args: input.args,
      } as never);
    } catch {
      // 前序状态尚未同步时节点可能无法模拟，使用按实测设置的保守上限。
    }
    const gasPrice = await publicClient.getGasPrice();
    setPreview({ action: input.action, feeUsdc6: input.feeUsdc6, bondUsdc6: input.bondUsdc6, gasWei18: gasUnits * gasPrice, note: input.note });
    setStatus({ label: "需要你操作", description: `请在钱包中确认“${input.action}”。`, kind: "user" });
    await nextPaint();
    const hash = await activeWalletClient.writeContract({
      account: address,
      chain: arcTestnet,
      address: input.contract,
      abi: input.abi,
      functionName: input.functionName,
      args: input.args,
    } as never);
    setWalletSignatureCount((current) => current + 1);
    const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
    if (receipt.status !== "success") throw new Error(`“${input.action}”交易没有成功，请在 Arc Explorer 查看原因。`);
    setReceipts((current) => [...current.filter((item) => item.hash.toLowerCase() !== hash.toLowerCase()), { kind: input.kind, hash }]);
    setStatus({ label: "链上已确认", description: `${input.action}完成：${shortHash(hash)}`, kind: "automatic" });
    await refreshBalances();
    return hash;
  }, [address, publicClient, refreshBalances]);

  const sendAtomicCalls = useCallback(async (input: {
    kind: UserTransactionKind;
    action: string;
    calls: ReadonlyArray<{ to: Address; abi: Abi; functionName: string; args: readonly unknown[] }>;
    feeUsdc6: bigint;
    note: string;
  }): Promise<{ bundleId: string; transactionHashes: Hex[] }> => {
    const activeWalletClient = walletClientRef.current;
    if (!address || !activeWalletClient || !publicClient) throw new Error("钱包尚未准备好，请重新连接后再试。");
    const gasPrice = await publicClient.getGasPrice();
    setPreview({
      action: input.action,
      feeUsdc6: input.feeUsdc6,
      bondUsdc6: 0n,
      gasWei18: FALLBACK_GAS_UNITS[input.kind] * gasPrice,
      note: input.note,
    });
    setStatus({ label: "需要你操作", description: `请在钱包中确认“${input.action}”。`, kind: "user" });
    await nextPaint();
    try {
      const bundle = await activeWalletClient.sendCalls({
        account: address,
        chain: arcTestnet,
        calls: input.calls,
        forceAtomic: true,
      });
      setWalletSignatureCount((current) => current + 1);
      const status = await activeWalletClient.waitForCallsStatus({
        id: bundle.id,
        throwOnFailure: true,
        timeout: 90_000,
      });
      if (!status.atomic || status.status !== "success") throw new Error("钱包没有原子确认整组卦金交易");
      const transactionHashes = (status.receipts ?? [])
        .map((receipt) => receipt.transactionHash)
        .filter((hash): hash is Hex => typeof hash === "string" && /^0x[0-9a-fA-F]{64}$/.test(hash));
      if (!transactionHashes.length) throw new Error("钱包未返回可核验的卦金交易哈希");
      setReceipts((current) => {
        const additions = transactionHashes.map((hash) => ({ kind: input.kind, hash }));
        const byHash = new Map([...current, ...additions].map((item) => [item.hash.toLowerCase(), item]));
        return [...byHash.values()];
      });
      setStatus({ label: "链上已确认", description: `${input.action}完成，整组交易原子落链。`, kind: "automatic" });
      await refreshBalances();
      return { bundleId: bundle.id, transactionHashes };
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "";
      if (/atomic|wallet_sendCalls|method.*(?:not found|support)|capabilit/i.test(message)) {
        throw new Error("当前钱包不支持 EIP-5792 原子批量交易。为保证一次确认且三座金库要么全部收款、要么全部不收，本轮没有扣款；请换用支持原子批量的钱包。", { cause: caught });
      }
      throw caught;
    }
  }, [address, publicClient, refreshBalances]);

  const payQuestionFee = useCallback(async (): Promise<QuestionFeeProof> => {
    if (!address || !publicClient) throw new Error("钱包尚未准备好，请重新连接后再试。");
    const plan = buildQuestionFeePlan();
    const [erc20Balance, gasBalance, gasPrice, ...allowances] = await Promise.all([
      publicClient.readContract({ address: USDC_TOKEN_ADDRESS, abi: erc20WalletAbi, functionName: "balanceOf", args: [address] }),
      publicClient.getBalance({ address }),
      publicClient.getGasPrice(),
      ...plan.approvals.map((share) => publicClient.readContract({
        address: USDC_TOKEN_ADDRESS,
        abi: erc20WalletAbi,
        functionName: "allowance",
        args: [address, share.vault],
      })),
    ]);
    const shortfalls = walletShortfalls({
      erc20BalanceUsdc6: erc20Balance,
      nativeBalanceWei18: gasBalance,
      feeUsdc6: plan.feeUsdc6,
      bondUsdc6: 0n,
      estimatedGasWei18: gasPrice * PREFLIGHT_GAS_UNITS,
    });
    if (shortfalls.missingErc20Usdc6 > 0n || shortfalls.missingNativeWei18 > 0n) {
      throw new Error(`支付卦金需要 ${formatUsdc6(plan.feeUsdc6)} USDC 及少量原生 USDC gas；当前余额不足，请先领取 Arc Testnet 测试币。`);
    }
    const missingApprovals = plan.approvals.filter((share, index) => allowances[index]! < share.amountUsdc6);
    if (missingApprovals.length) {
      await sendAtomicCalls({
        kind: "approval",
        action: "首次固定额度授权",
        calls: missingApprovals.map((share) => ({
          to: USDC_TOKEN_ADDRESS,
          abi: erc20WalletAbi,
          functionName: "approve",
          args: [share.vault, share.amountUsdc6],
        })),
        feeUsdc6: 0n,
        note: "系统自动把三座金库的固定额度授权合成一次确认；不是无限授权，也不会在授权时扣卦金。",
      });
    }
    const paid = await sendAtomicCalls({
      kind: "reading-fee",
      action: "支付卦金并求卦",
      calls: plan.deposits.map((share) => ({
        to: share.vault,
        abi: divinerVaultAbi,
        functionName: "deposit",
        args: [share.amountUsdc6],
      })),
      feeUsdc6: plan.feeUsdc6,
      note: "0.05 USDC 在同一次原子确认中直接分入三位易者的金库；这笔钱购买解读，不购买结果保证。",
    });
    return { payer: address, bundleId: paid.bundleId, transactionHashes: paid.transactionHashes };
  }, [address, publicClient, sendAtomicCalls]);

  const approveIfNeeded = useCallback(async (activePreparation: DemoRoundPreparation): Promise<Hex | null> => {
    if (!address || !publicClient) throw new Error("钱包尚未准备好，请重新连接后再试。");
    const approvalAmount = BigInt(activePreparation.approvalAmountUsdc6);
    const allowance = await publicClient.readContract({
      address: activePreparation.usdcToken,
      abi: erc20WalletAbi,
      functionName: "allowance",
      args: [address, activePreparation.registry],
    });
    if (allowance >= approvalAmount) return null;
    return sendUserTransaction({
      kind: "approval",
      action: "首次固定额度授权",
      contract: activePreparation.usdcToken,
      abi: erc20WalletAbi,
      functionName: "approve",
      args: [activePreparation.registry, approvalAmount],
      feeUsdc6: 0n,
      bondUsdc6: 0n,
      note: `首次需授权一次，之后不再需要。授权金额 ${formatUsdc6(approvalAmount)} USDC，可覆盖 ${activePreparation.approvalRoundCount} 轮；不是无限授权，也不会立即扣款。`,
    });
  }, [address, publicClient, sendUserTransaction]);

  const assertWalletFunds = useCallback(async (activePreparation: DemoRoundPreparation) => {
    if (!address || !publicClient) throw new Error("钱包尚未准备好，请重新连接后再试。");
    const [erc20Balance, gasBalance, gasPrice] = await Promise.all([
      publicClient.readContract({ address: activePreparation.usdcToken, abi: erc20WalletAbi, functionName: "balanceOf", args: [address] }),
      publicClient.getBalance({ address }),
      publicClient.getGasPrice(),
    ]);
    const shortfalls = walletShortfalls({
      erc20BalanceUsdc6: erc20Balance,
      nativeBalanceWei18: gasBalance,
      feeUsdc6: BigInt(activePreparation.feeUsdc6),
      bondUsdc6: BigInt(activePreparation.bondUsdc6),
      estimatedGasWei18: gasPrice * PREFLIGHT_GAS_UNITS,
    });
    if (shortfalls.missingErc20Usdc6 === 0n && shortfalls.missingNativeWei18 === 0n) return;
    const tokenMessage = shortfalls.missingErc20Usdc6 > 0n
      ? `ERC-20 需要 ${formatUsdc6(shortfalls.requiredErc20Usdc6)} USDC，尚缺 ${formatUsdc6(shortfalls.missingErc20Usdc6)} USDC。`
      : "ERC-20 卦金与保证金已足够。";
    const gasMessage = shortfalls.missingNativeWei18 > 0n
      ? `原生 gas 预计需要 ${formatUsdc6(nativeWeiToUsdc6(shortfalls.requiredNativeWei18))} USDC，尚缺 ${formatUsdc6(nativeWeiToUsdc6(shortfalls.missingNativeWei18))} USDC。`
      : "原生 gas 余额已足够。";
    throw new Error(`${tokenMessage} ${gasMessage} 请先领取 Arc Testnet 测试币。`);
  }, [address, publicClient]);

  const playRitual = useCallback(async () => {
    setRitualActive(true);
    setRitualCount(0);
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 60 : 6_000;
    const interval = duration / 6;
    for (let count = 1; count <= 6; count += 1) {
      await sleep(interval);
      setRitualCount(count);
    }
    setRitualActive(false);
  }, []);

  const retryPredictions = useCallback(async (): Promise<DemoSession> => {
    let lastError: unknown;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        setStatus({
          label: "自动进行中",
          description: attempt === 1 ? "三位易者正在依次解卦并押上自己的钱。" : `服务短暂中断，正在自动重试（${attempt}/3）。`,
          kind: "automatic",
        });
        return await requestDemo<DemoSession>("/api/demo/predictions", {});
      } catch (caught) {
        lastError = caught;
        if (attempt < 3) await sleep(1_000 * attempt);
      }
    }
    throw lastError;
  }, []);

  const settleAutomatically = useCallback(async (
    activeSession = session,
    outcomeWaitDurationMilliseconds?: number,
    querentOutcome?: boolean,
  ) => {
    if (settlementBusy || activeSession?.phase === "settled") return;
    if (!activeSession || activeSession.predictions.length !== 3) {
      setError("三家尚未全部应卦，现在还不能结算。");
      return;
    }
    setSettlementBusy(true);
    setShowOptionalSettlement(false);
    try {
      setStatus({ label: "自动进行中", description: "服务端正在逐笔完成三家无许可结算，不再请求钱包签名。", kind: "automatic" });
      const settled = await requestDemo<DemoSession>("/api/demo/settlement", {
        outcomeWaitDurationMilliseconds,
        querentOutcome,
      });
      setSession(settled);
      setDeadlineReached(true);
      setPreview(null);
    } catch (caught) {
      showFlowError(caught, "结算");
      setShowOptionalSettlement(true);
      throw caught;
    } finally {
      setSettlementBusy(false);
    }
  }, [session, settlementBusy, showFlowError]);

  const startNewRound = useCallback(async () => {
    try {
      if (session) {
        const result = await requestDemo<DemoAbandonResponse>("/api/demo/abandon", {});
        setRecoveryMessage(result.recovery.message);
      } else {
        setRecoveryMessage("");
      }
      setSession(null);
      setClassification(null);
      setSelectedSubject(null);
      setTrackOverride("auto");
      setAwaitingWallet(false);
      setConfirmedTrack(null);
      setQuestionResult(null);
      setQuestionPayment(null);
      setSubjectBusy(false);
      setError("");
      setPreview(null);
      setReceipts([]);
      setWalletSignatureCount(0);
      setRemainingBlocks(null);
      setDeadlineReached(false);
      setShowOptionalSettlement(false);
      setStatus(phaseDescription(null));
    } catch (caught) {
      showFlowError(caught, "弃卦重来");
    }
  }, [session, showFlowError]);

  const classifyQuestionFlow = useCallback(async (event: FormEvent) => {
    event.preventDefault();
    if (flowBusy) return;
    if (question.trim().length < 4) {
      setError("请把问题说得再完整一点，至少写四个字。");
      return;
    }
    setFlowBusy(true);
    setError("");
    setClassification(null);
    setSelectedSubject(null);
    setConfirmedTrack(null);
    setQuestionResult(null);
    setQuestionPayment(null);
    setSubjectBusy(false);
    setSession(null);
    setDeadlineReached(false);
    setRemainingBlocks(null);
    setShowOptionalSettlement(false);
    setPreview(null);
    setReceipts([]);
    setWalletSignatureCount(0);
    setRecoveryMessage("");
    setAwaitingWallet(true);
    /* 求卦点击本身就是连接意图；未连接时立刻弹钱包，不要求先点页首按钮。 */
    if (!isConnected || !address) openConnectModal?.();
    try {
      setStatus({ label: "正在判断", description: "中立分类器只检查未来是否会出现单一、可观察的答案。", kind: "automatic" });
      const result = await requestDemo<QuestionClassification>("/api/question/classify", { question: question.trim() });
      const track = trackOverride === "auto" ? result.track : trackOverride;
      setClassification({
        ...result,
        track,
        horizon: track === "question" ? "none" : result.horizon === "none" ? "short" : result.horizon,
        reason: trackOverride === "auto" ? result.reason : `你在高级选项中覆盖了分类轨道；原问题保持不变，按${track === "question" ? "不可判定解读" : "可判定见证"}继续。`,
      });
      setSelectedSubject((current) => current ?? result.subject.key);
      setStatus({ label: "自动进行中", description: "分类完成；钱包就绪后将自动接上授权、付款与起卦。", kind: "automatic" });
    } catch (caught) {
      setAwaitingWallet(false);
      showFlowError(caught, "分类");
    } finally {
      setFlowBusy(false);
    }
  }, [address, flowBusy, isConnected, openConnectModal, question, showFlowError, trackOverride]);

  const runQuestionFlow = useCallback(async () => {
    if (!classification || flowBusy) return;
    setConfirmedTrack("question");
    setFlowBusy(true);
    setError("");
    try {
      if (chainId !== ARC_CHAIN_ID) {
        setStatus({ label: "需要你操作", description: "请确认把钱包切换到 Arc Testnet。", kind: "user" });
        await switchChainAsync({ chainId: ARC_CHAIN_ID });
      }
      const refreshedWalletClient = await refetchWalletClient();
      if (!refreshedWalletClient.data) throw new Error("钱包尚未准备好，请重新连接后再试。");
      walletClientRef.current = refreshedWalletClient.data;
      const payment = await payQuestionFee();
      setQuestionPayment(payment);
      setStatus({ label: "正在起卦", description: "卦金已分入三座金库；现在读取公开区块哈希并复算六爻。", kind: "automatic" });
      const ritual = playRitual();
      const result = await requestDemo<QuestionOracleResult>("/api/question/cast", {
        question: classification.question,
        confirmedTrack: "question",
        confirmedSubject: selectedSubject ?? classification.subject.key,
        payment,
      });
      setQuestionResult(result);
      await ritual;
      setPreview(null);
      setStatus({ label: "本轮完成", description: "三家已收卦金并完成解读；此类问题不要求易者押钱，也没有结果承诺。", kind: "automatic" });
    } catch (caught) {
      setConfirmedTrack(null);
      showFlowError(caught, "付费解卦");
    } finally {
      setFlowBusy(false);
    }
  }, [chainId, classification, flowBusy, payQuestionFee, playRitual, refetchWalletClient, selectedSubject, showFlowError, switchChainAsync]);

  const recalculateSubject = useCallback(async (subject: QuestionSubjectKey) => {
    if (!questionResult || !questionPayment || subjectBusy || subject === questionResult.subject.key) return;
    setSelectedSubject(subject);
    setSubjectBusy(true);
    setError("");
    try {
      const result = await requestDemo<QuestionOracleResult>("/api/question/cast", {
        question: questionResult.question,
        confirmedTrack: "question",
        confirmedSubject: subject,
        payment: questionPayment,
        basisBlock: questionResult.block,
      });
      setQuestionResult(result);
    } catch (caught) {
      showFlowError(caught, "重算");
    } finally {
      setSubjectBusy(false);
    }
  }, [questionPayment, questionResult, showFlowError, subjectBusy]);

  const runWagerFlow = useCallback(async () => {
    if (!classification || flowBusy) return;
    setConfirmedTrack("wager");
    if (!isConnected || !address) throw new Error("自动连接钱包尚未完成");
    setFlowBusy(true);
    setError("");
    try {
      if (chainId !== ARC_CHAIN_ID) {
        setStatus({ label: "需要你操作", description: "请确认把钱包切换到 Arc Testnet。", kind: "user" });
        await switchChainAsync({ chainId: ARC_CHAIN_ID });
      }
      const refreshedWalletClient = await refetchWalletClient();
      if (!refreshedWalletClient.data) throw new Error("钱包尚未准备好，请重新连接后再试。");
      walletClientRef.current = refreshedWalletClient.data;
      const prepared = await requestDemo<DemoPrepareResponse>("/api/demo/round/prepare", {
        question: question.trim(),
        walletAddress: address,
        confirmedTrack: "wager",
        horizon: classification.track === "wager" && classification.horizon !== "none" ? classification.horizon : "short",
      });
      setSession(prepared.session);
      if (prepared.previousRecovery) setRecoveryMessage(prepared.previousRecovery.message);
      await assertWalletFunds(prepared.preparation);
      const approvalHash = await approveIfNeeded(prepared.preparation);
      const commitStartedAt = Date.now();
      const commitHash = await sendUserTransaction({
        kind: "commit",
        action: "立誓",
        contract: prepared.preparation.registry,
        abi: divinationRegistryAbi,
        functionName: "commit",
        args: [
          prepared.preparation.commitment,
          BigInt(prepared.preparation.feeUsdc6),
          BigInt(prepared.preparation.bondUsdc6),
          BigInt(prepared.preparation.roundId),
        ],
        feeUsdc6: BigInt(prepared.preparation.feeUsdc6),
        bondUsdc6: BigInt(prepared.preparation.bondUsdc6),
        note: "立誓时，合约会按 ERC-20 六位精度托管卦金与保证金。",
      });
      setStatus({ label: "自动进行中", description: "立誓已确认；服务端保管的 salt 正等待未来块哈希，随后自动揭示。", kind: "automatic" });
      const revealed = await requestDemo<DemoSession>("/api/demo/round/confirm", {
        approvalHash,
        commitHash,
        commitDurationMilliseconds: Date.now() - commitStartedAt,
      });
      setSession(revealed);
      const ritual = playRitual();
      const predicted = await retryPredictions();
      setSession(predicted);
      await ritual;
      setStatus(predicted.horizon === "short"
        ? { label: "等你见证", description: "短周期问题可在结果出现后由你见证；服务端随后经人层 resolver 结算。", kind: "user" }
        : { label: "等待应验", description: "这个问题需要几天到几周。请在真实截止后回到卦历见证，系统不会假装立即知道结果。", kind: "automatic" });
    } catch (caught) {
      setConfirmedTrack(null);
      showFlowError(caught);
    } finally {
      setFlowBusy(false);
    }
  }, [
    address,
    approveIfNeeded,
    assertWalletFunds,
    chainId,
    flowBusy,
    isConnected,
    playRitual,
    question,
    refetchWalletClient,
    retryPredictions,
    sendUserTransaction,
    showFlowError,
    switchChainAsync,
    classification,
  ]);

  useEffect(() => {
    if (!awaitingWallet || !classification || flowBusy || confirmedTrack || questionResult || session) return;
    if (!isConnected || !address) return;
    setAwaitingWallet(false);
    if (classification.track === "question") void runQuestionFlow();
    else void runWagerFlow();
  }, [address, awaitingWallet, classification, confirmedTrack, flowBusy, isConnected, questionResult, runQuestionFlow, runWagerFlow, session]);

  const displayStatus = status;
  const showFaucet = /余额|不足|领取|gas/.test(error);
  const hexagram = questionResult?.hexagram ?? session?.hexagram;
  const wagerFive = useMemo(
    () => session?.hexagram ? deriveFiveHexagrams(session.hexagram.lines) : null,
    [session?.hexagram],
  );
  const resultFive = questionResult?.hexagram.five ?? wagerFive;
  const changingPositions = questionResult?.hexagram.changingLinePositions ?? session?.hexagram?.changingLinePositions ?? [];
  const hasAnswer = Boolean(questionResult || session?.predictions.length);

  return (
    <div className="workbench-shell" data-progress={Boolean(classification || confirmedTrack || questionResult || session)}>
      <a className="skip-link" href="#workspace">跳至问卦工作台</a>
      <div className="night-pattern" aria-hidden="true"></div>
      <header className="app-header">
        <a className="brand" href="#/oracle" aria-label="返回问卦工作台"><i aria-hidden="true">卜</i><span>问卦<small>THE ORACLE PAYS</small></span></a>
        <nav className="page-tabs" aria-label="主要页面">
          <a href="#/oracle" aria-current={page === "oracle" ? "page" : undefined}>问卦</a>
          <a href="#/history" aria-current={page === "history" ? "page" : undefined}>卦历</a>
        </nav>
        <WalletPanel />
      </header>

      {page === "oracle" && (classification || confirmedTrack || questionResult || session) && (
        <ProgressDock connected={connectedToArc} session={session} questionResult={questionResult} receipts={receipts} deadlineReached={deadlineReached} />
      )}

      <main>
        {page === "history" ? <HistoryPage /> : (
          <section className="page oracle-page" data-page="oracle" id="workspace">
            <div className="workspace-grid">
              <aside className="chapter-mark" aria-hidden="true"><span>問</span><small>ORACLE / 01</small></aside>
              <section className="oracle-stage" aria-labelledby="stage-title">
                <header className="stage-header">
                  <div>
                    <h1 id="stage-title">{hexagram ? `${hexagram.primaryName} 之 ${hexagram.derivedName}` : "你想问什么？"}</h1>
                  </div>
                  {!hexagram && <p className="timing-note">{confirmedTrack === "wager" ? "链上确认 ~0.5s ・ 仪式演出 6s" : "一次点击"}</p>}
                </header>

                {resultFive && (questionResult || !ritualActive) && <FiveHexagramConstellation five={resultFive} changingPositions={changingPositions} visibleCount={ritualCount} />}

                {!questionResult && hexagram && ritualActive && (
                  <section className="ritual-panel" data-phase={ritualActive ? "casting" : "complete"} aria-label="起卦仪式">
                    <div className="ritual-top"><span>{ritualActive ? "六爻自下而上显现" : "本卦与之卦已定"}</span><b>{CHINESE_NUMERALS[ritualCount]} / 六</b></div>
                    <div className="ritual-progress"><span style={{ transform: `scaleX(${ritualCount / 6})` }}></span></div>
                    <div className="hexagram-pair">
                      <div className="hexagram"><small>本卦</small><HexagramLines lines={hexagram.lines} changingPositions={hexagram.changingLinePositions} derived={false} visibleCount={ritualCount} /><strong>{hexagram.primaryKingWenNumber}・{hexagram.primaryName}</strong></div>
                      <i className="change-mark">之</i>
                      <div className="hexagram"><small>之卦</small><HexagramLines lines={hexagram.lines} changingPositions={hexagram.changingLinePositions} derived={true} visibleCount={ritualCount} /><strong>{hexagram.derivedKingWenNumber}・{hexagram.derivedName}</strong></div>
                    </div>
                  </section>
                )}

                {session || questionResult ? (
                  <details className="question-recap">
                    <summary>本轮问题</summary>
                    <strong>{question}</strong>
                    <button type="button" className="restart-action" data-action="new-round" onClick={() => void startNewRound()}>新起一卦</button>
                  </details>
                ) : <form className="ask-form" onSubmit={classifyQuestionFlow}>
                  <label className="sr-only" htmlFor="demo-question">你想问什么？</label>
                  <textarea
                    id="demo-question"
                    value={question}
                    onChange={(event) => setQuestion(event.target.value)}
                    rows={3}
                    maxLength={280}
                    disabled={flowBusy || Boolean(classification)}
                    placeholder="例如：我该不该辞职？或：今天之内会不会收到那条消息？"
                    required
                  />
                  <div className="ask-controls">
                    <button className="primary-action" type="submit" data-action="start-round" disabled={flowBusy || settlementBusy}>
                      <span>求 卦 · 0.05 USDC</span>
                      <small>{flowBusy ? "正在接续流程" : "未连接将自动唤起钱包"}</small>
                    </button>
                  </div>
                  <details className="ask-options">
                    <summary>费用与设置</summary>
                    <div>
                      <label><span>分类覆盖</span><select value={trackOverride} onChange={(event) => setTrackOverride(event.target.value as "auto" | QuestionTrack)}><option value="auto">自动判断</option><option value="question">不可判定・只解读</option><option value="wager">可判定・到期见证</option></select></label>
                    </div>
                    <small>默认不需要展开：分类器只决定易者是否押钱，不决定是否收费；原问题不会改写。</small>
                    <p className="ask-promise">所有起卦都收取 0.05 USDC。分类器只判断易者是否押钱：<strong>不可判定也收卦金并解读，但没有人承诺结果。</strong></p>
                    <p className="signature-note">
                      <strong>稳态从点击求卦到结果只需 1 次钱包确认。</strong>
                      未授权时系统自动接上首次固定额度授权，之后不再需要；賭轨授权金额明确为 10.000000 USDC（可覆盖 18 轮），不是无限授权。
                      当前轮已请求 <b data-signature-count>{walletSignatureCount}</b> 次。
                      <span hidden>{formatUsdc6(REUSABLE_APPROVAL_USDC6)}</span>
                    </p>
                  </details>
                </form>}

                {classification && !questionResult && !session && (
                  <details className="classification-panel" data-track={classification.track} aria-live="polite">
                    <summary>已按{classification.subject.label}取{classification.subject.useGod}</summary>
                    <div>
                      <strong>你问的是「{classification.question}」。</strong>
                      <p>{classification.track === "question"
                        ? "这件事没有一个将来会揭晓的答案。"
                        : "这件事将来会由一个可观察结果揭晓。"}</p>
                      <small>{classification.reason}</small>
                      <small>分类已自动采用并继续；如需调整，可在结果旁修改事项主题。</small>
                    </div>
                  </details>
                )}

                {confirmedTrack === "wager" && !connectedToArc && isConnected && (
                  <aside className="network-alert" role="alert">
                    <div><strong>当前网络不是 Arc Testnet</strong><small>目标网络 Chain ID 5042002。切换后才能求卦。</small></div>
                    <button type="button" onClick={() => switchChain({ chainId: ARC_CHAIN_ID })} disabled={switchingNetwork}>{switchingNetwork ? "切换中" : "一键切换"}</button>
                  </aside>
                )}

                {!hasAnswer && <div className="stage-status" data-state={displayStatus.kind} aria-live="polite">
                  <span>{displayStatus.label}</span><p>{displayStatus.description}</p>
                  {session && session.phase !== "settled" && (
                    <button type="button" className="restart-action" data-action="abandon-round" onClick={() => void startNewRound()}>
                      弃卦重来
                    </button>
                  )}
                </div>}

                {error && (
                  <p className="action-error" role="alert">
                    {error}
                    {showFaucet && <> <a href={ARC_FAUCET_URL} target="_blank" rel="noreferrer">前往 Circle 水龙头</a></>}
                  </p>
                )}

                {recoveryMessage && <details className="recovery-notice"><summary>未完成旧轮</summary><p role="status">{recoveryMessage}</p></details>}

                {hasAnswer && (
                  <section className="responsibility-panel" aria-label="本轮责任说明">
                    <p>已收费；<strong>解读不担保结果。</strong></p>
                  </section>
                )}

                {questionResult && (
                  <>
                    <details className="fee-disclosure">
                      <summary>费用与去向</summary>
                      <section className="fee-distribution-strip" aria-label="三位易者金库卦金分账">
                        <span>高島易断金库<strong>0.016667 USDC</strong></span><span>五行易金库<strong>0.016667 USDC</strong></span><span>梅花心易金库<strong>0.016666 USDC</strong></span><span>合计<strong>0.050000 USDC</strong></span>
                      </section>
                    </details>
                    <details className="reading-details">
                      <summary>完整排盘与推导</summary>
                      <LiuyaoChartTable result={questionResult} />
                    </details>
                  </>
                )}

                {session?.phase === "settled" && (
                  <section className="outcome-panel" aria-live="polite">
                    <span>{session.unresolved ? "双方见证不一致" : "结果揭晓"}</span>
                    <strong>{session.unresolved ? "未决之卦" : `事实最后是：${session.outcome ? "发生了" : "没有发生"}`}</strong>
                    <small>{session.unresolved ? "资金不按虚构结果强行结算" : "人层见证已结算"}</small>
                  </section>
                )}

                {preview && (
                  <details className="transaction-preview" data-transaction-preview aria-live="assertive">
                    <summary>费用预览・{formatUsdc6(preview.feeUsdc6)} USDC</summary>
                    <div className="transaction-preview-body">
                      <div><span>签名前确认</span><strong>即将签名：{preview.action}</strong></div>
                      <dl>
                        <div><dt>卦金</dt><dd>{formatUsdc6(preview.feeUsdc6)} USDC</dd></div>
                        <div><dt>保证金</dt><dd>{formatUsdc6(preview.bondUsdc6)} USDC</dd></div>
                        <div><dt>预估 gas</dt><dd>约 {formatUsdc6(nativeWeiToUsdc6(preview.gasWei18))} USDC <small>原生 18 位</small></dd></div>
                      </dl>
                      <small>{preview.note} 钱包确认前不会发生本笔扣款。</small>
                    </div>
                  </details>
                )}

                {session?.proposition && (
                  <details className="wager-disclosure">
                    <summary>命题与见证说明</summary>
                    <div>
                      <section className="proposition-panel">
                        <span>原问题已冻结为人层命题</span>
                        <blockquote>{session.proposition.statement}</blockquote>
                        <p><strong>不再改写：</strong>三位易者押注的是你真正问的这件事；到期由你见证，经人层 AttestedResolver / MutualResolver 处理。</p>
                        <small>{session.horizon === "short" ? "短周期问题可在现场演示见证。" : "长周期问题需要等待真实截止，不能当场伪造结果。"}</small>
                      </section>
                      {session.phase === "predicted" && session.horizon === "short" && <p>你的见证会交给人层 resolver；如双方不一致，本轮进入未决之卦。</p>}
                      {session.phase === "predicted" && session.horizon === "long" && (
                        <section className="witness-panel long-horizon">
                          <span>长周期・如实等待</span>
                          <strong>人间事常要几天到几周才会有答案。</strong>
                          <p>请在真实截止后回到卦历见证；这里不会为了现场效果假装立即结算。</p>
                        </section>
                      )}
                    </div>
                  </details>
                )}

                {session?.phase === "predicted" && session.horizon === "short" && (
                  <section className="witness-panel" aria-label="提问者见证结果">
                    <span>留给你的动作</span>
                    <strong>到了约定时点，这件事实际发生了吗？</strong>
                    <div className="witness-actions">
                      <button type="button" onClick={() => void settleAutomatically(session, undefined, true)}>发生了</button>
                      <button type="button" onClick={() => void settleAutomatically(session, undefined, false)}>没有发生</button>
                      <button type="button" onClick={() => void settleAutomatically(session)}>仍无法确认</button>
                    </div>
                  </section>
                )}

                {session?.phase === "predicted" && session.horizon === "long" && (
                  <section className="witness-panel long-horizon">
                    <span>留给你的动作</span>
                    <strong>到期后回来见证。</strong>
                  </section>
                )}

              </section>

              <aside className="oracle-sidebar">
                {!questionResult && !session?.predictions.length && <div className="countdown-card" data-countdown data-state={session?.phase === "settled" ? "done" : deadlineReached ? "ready" : session?.phase === "predicted" ? "waiting" : "idle"}>
                  <span>{session?.phase === "settled" ? "本轮完成" : session?.phase === "predicted" ? "等待见证" : "下一步"}</span>
                  <strong>{session?.phase === "settled" ? "钱已经按人层事实重新分配。" : session?.phase === "predicted" ? (session.horizon === "short" ? "结果出现后，由你见证。" : "等待真实截止，不抢跑。") : "写下问题，点击一次求卦。"}</strong>
                  <small>钱包会自动唤起；分类只决定是否押钱，所有起卦均收费。</small>
                  {showOptionalSettlement && (
                    <button type="button" className="optional-action" data-action="optional-settlement" onClick={() => void settleAutomatically().catch(() => undefined)}>
                      重试自动结算 <i>可选</i>
                    </button>
                  )}
                </div>}
                {confirmedTrack === "wager" || session ? <TimingPanel session={session} /> : null}
                {questionResult || !session ? <QuestionReadingGrid result={questionResult} subjectBusy={subjectBusy} onSubjectChange={(subject) => void recalculateSubject(subject)} /> : <DivinerGrid session={session} />}
                <TruthDrawer />
              </aside>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
