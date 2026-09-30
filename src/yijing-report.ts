import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export type E2EStatus = "PASS" | "FAIL" | "SKIP";

export interface E2EStep {
  id: string;
  title: string;
  status: E2EStatus;
  actor: string;
  transactionHash?: string;
  blockNumber?: string;
  gasUsed?: string;
  gasCostUsdc?: string;
  observed: string;
  details?: Record<string, unknown>;
}

export interface E2EReport {
  schemaVersion: "1.0";
  generatedAt: string;
  network: { name: string; chainId: number };
  deploymentFile: string;
  parameters: {
    waitBlocks: string;
    revealWindow: string;
    feeUsdc: string;
    bondUsdc: string;
    mMin: number;
    mMax: number;
  };
  steps: E2EStep[];
  checks: {
    fullLifecycle: E2EStatus;
    thirdPartyForfeit: E2EStatus;
    unresolvedLocks: E2EStatus;
    permissionlessSettlement: E2EStatus;
  };
  agents: Array<{ name: string; address: string; agentId: string; transactionHash: string; metadataUri: string }>;
  totals: {
    gasCostUsdc: string;
    vaultFundingUsdc: string;
    forfeitedUsdc: string;
    permanentlyLockedUsdc: string;
    deployerRemainingUsdc: string;
  };
  notes: string[];
}

const HEXAGRAM_NAMES = [
  "",
  "乾为天", "坤为地", "水雷屯", "山水蒙", "水天需", "天水讼", "地水师", "水地比",
  "风天小畜", "天泽履", "地天泰", "天地否", "天火同人", "火天大有", "地山谦", "雷地豫",
  "泽雷随", "山风蛊", "地泽临", "风地观", "火雷噬嗑", "山火贲", "山地剥", "地雷复",
  "天雷无妄", "山天大畜", "山雷颐", "泽风大过", "坎为水", "离为火", "泽山咸", "雷风恒",
  "天山遁", "雷天大壮", "火地晋", "地火明夷", "风火家人", "火泽睽", "水山蹇", "雷水解",
  "山泽损", "风雷益", "泽天夬", "天风姤", "泽地萃", "地风升", "泽水困", "水风井",
  "泽火革", "火风鼎", "震为雷", "艮为山", "风山渐", "雷泽归妹", "雷火丰", "火山旅",
  "巽为风", "兑为泽", "风水涣", "水泽节", "风泽中孚", "雷山小过", "水火既济", "火水未济",
] as const;

export function hexagramName(kingWenNumber: number): string {
  const name = HEXAGRAM_NAMES[kingWenNumber];
  if (!name) throw new Error(`未知文王序：${kingWenNumber}`);
  return name;
}

export function formatUsdc6(value: bigint): string {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const integer = absolute / 1_000_000n;
  const fraction = (absolute % 1_000_000n).toString().padStart(6, "0");
  return `${negative ? "-" : ""}${integer}.${fraction}`;
}

function escapeCell(value: unknown): string {
  if (value === undefined || value === null || value === "") return "—";
  return String(value).replaceAll("|", "\\|").replaceAll("\r\n", "<br>").replaceAll("\n", "<br>");
}

function stringify(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) => (typeof item === "bigint" ? item.toString() : item), 2);
}

export function renderE2EReport(report: E2EReport): string {
  const lines = [
    "# Arc Testnet 易经占卜链上端到端报告",
    "",
    `- 生成时间：${report.generatedAt}`,
    `- 网络：${report.network.name}（Chain ID ${report.network.chainId}）`,
    `- 部署清单：\`${report.deploymentFile}\``,
    `- 完整生命周期：${report.checks.fullLifecycle}`,
    "",
    "## 参数",
    "",
    `- waitBlocks：${report.parameters.waitBlocks}；revealWindow：${report.parameters.revealWindow}`,
    `- m_min / m_max：${report.parameters.mMin} / ${report.parameters.mMax}`,
    `- 卦金 F：${report.parameters.feeUsdc} USDC；保证金 D：${report.parameters.bondUsdc} USDC`,
    "",
    "## 逐步交易",
    "",
    "| 步骤 | 状态 | 发起者 | 交易哈希 | 块高 | gas | 成本（USDC） | 链上观测 |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
  ];

  for (const step of report.steps) {
    lines.push(
      `| ${escapeCell(step.title)} | ${step.status} | ${escapeCell(step.actor)} | ${escapeCell(step.transactionHash)} | ${escapeCell(step.blockNumber)} | ${escapeCell(step.gasUsed)} | ${escapeCell(step.gasCostUsdc)} | ${escapeCell(step.observed)} |`,
    );
  }

  lines.push(
    "",
    "## 三项额外验证",
    "",
    `- 第三方弃卦：${report.checks.thirdPartyForfeit}`,
    `- 未决永久锁定：${report.checks.unresolvedLocks}`,
    `- 无许可结算：${report.checks.permissionlessSettlement}`,
    "",
    "## ERC-8004 身份",
    "",
    "| 易者 | 地址 | agentId | 注册交易 | metadata URI |",
    "| --- | --- | --- | --- | --- |",
  );
  for (const agent of report.agents) {
    lines.push(
      `| ${escapeCell(agent.name)} | ${agent.address} | ${agent.agentId} | ${agent.transactionHash} | ${escapeCell(agent.metadataUri)} |`,
    );
  }

  lines.push(
    "",
    "## 成本与余额",
    "",
    `- gas 总成本：${report.totals.gasCostUsdc} USDC`,
    `- 三库注资：${report.totals.vaultFundingUsdc} USDC`,
    `- 弃卦没收：${report.totals.forfeitedUsdc} USDC`,
    `- 未决永久锁定：${report.totals.permanentlyLockedUsdc} USDC`,
    `- 部署者剩余余额：${report.totals.deployerRemainingUsdc} USDC`,
  );
  if (report.notes.length > 0) lines.push("", "## 说明", "", ...report.notes.map((note) => `- ${note}`));

  const detailed = report.steps.filter((step) => step.details !== undefined);
  if (detailed.length > 0) {
    lines.push("", "## 状态详情", "");
    for (const step of detailed) {
      lines.push(`<details><summary>${escapeCell(step.title)}</summary>`, "", "```json", stringify(step.details), "```", "", "</details>", "");
    }
  }
  lines.push("");
  return lines.join("\n");
}

export async function writeE2EReport(report: E2EReport, fileName: string, directory = "reports"): Promise<string> {
  await mkdir(directory, { recursive: true });
  const filePath = path.join(directory, fileName);
  await writeFile(filePath, renderE2EReport(report), "utf8");
  return filePath;
}
