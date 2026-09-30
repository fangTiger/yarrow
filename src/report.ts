import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export const REPORT_STATUSES = ["PASS", "FAIL", "REVERT", "NOT_FOUND", "SKIP"] as const;

export type ProbeStatus = (typeof REPORT_STATUSES)[number];
export type ReportType = "readonly" | "transaction";

export interface ProbeResult {
  id: string;
  title: string;
  status: ProbeStatus;
  expected?: string;
  observed: string;
  reason?: string;
  txHash?: string;
  blockNumber?: string;
  details?: Record<string, unknown>;
}

export interface ReportSource {
  name: string;
  url: string;
  kind: "用户已确认" | "官方文档" | "非官方候选";
  note?: string;
}

export interface ArcReport {
  schemaVersion: "1.0";
  reportType: ReportType;
  generatedAt: string;
  network: {
    name: string;
    chainId: number;
    rpcUrl: string;
    blockNumber?: string;
  };
  summary: Record<ProbeStatus, number>;
  results: ProbeResult[];
  sources: ReportSource[];
}

export type ReportInput = Omit<ArcReport, "schemaVersion" | "summary">;

export function buildReport(input: ReportInput): ArcReport {
  const summary = Object.fromEntries(REPORT_STATUSES.map((status) => [status, 0])) as Record<ProbeStatus, number>;
  for (const result of input.results) summary[result.status] += 1;

  return {
    schemaVersion: "1.0",
    ...input,
    summary,
  };
}

function escapeCell(value: unknown): string {
  if (value === undefined || value === null || value === "") return "—";
  const text = typeof value === "object" ? stringifyJson(value, 0) : String(value);
  return text.replaceAll("|", "\\|").replaceAll("\r\n", "<br>").replaceAll("\n", "<br>");
}

function reportTitle(reportType: ReportType): string {
  return reportType === "readonly" ? "Arc Testnet 只读探测报告" : "Arc Testnet 交易探测报告";
}

export function renderMarkdown(report: ArcReport): string {
  const lines = [
    `# ${reportTitle(report.reportType)}`,
    "",
    `- 生成时间：${report.generatedAt}`,
    `- 网络：${report.network.name}`,
    `- Chain ID：${report.network.chainId}`,
    `- RPC：${report.network.rpcUrl}`,
    `- 探测块高：${report.network.blockNumber ?? "—"}`,
    `- 汇总：${REPORT_STATUSES.map((status) => `${status}=${report.summary[status]}`).join("，")}`,
    "",
    "## 探测结果",
    "",
    "| ID | 项目 | 状态 | 观测 | 原因 | 交易哈希 | 预期 |",
    "| --- | --- | --- | --- | --- | --- | --- |",
  ];

  for (const result of report.results) {
    lines.push(
      `| ${escapeCell(result.id)} | ${escapeCell(result.title)} | ${result.status} | ${escapeCell(result.observed)} | ${escapeCell(result.reason)} | ${escapeCell(result.txHash)} | ${escapeCell(result.expected)} |`,
    );
  }

  const detailedResults = report.results.filter(
    (result): result is ProbeResult & { details: Record<string, unknown> } =>
      result.details !== undefined && Object.keys(result.details).length > 0,
  );
  if (detailedResults.length > 0) {
    lines.push("", "## 详细数据", "");
    for (const result of detailedResults) {
      lines.push(`<details><summary>${escapeCell(result.id)}</summary>`, "", "```json", stringifyJson(result.details, 2), "```", "", "</details>", "");
    }
  }

  if (report.sources.length > 0) {
    lines.push("", "## 地址与资料来源", "");
    for (const source of report.sources) {
      lines.push(`- [${source.name}](${source.url})（${source.kind}）${source.note ? `：${source.note}` : ""}`);
    }
  }

  lines.push("");
  return lines.join("\n");
}

export function stringifyJson(value: unknown, spaces = 2): string {
  return JSON.stringify(value, (_key, item: unknown) => (typeof item === "bigint" ? item.toString() : item), spaces);
}

export function reportTimestamp(date = new Date()): string {
  return date.toISOString().replaceAll(":", "-").replaceAll(".", "-");
}

export async function writeReport(report: ArcReport, prefix: string, directory = "reports"): Promise<{ jsonPath: string; markdownPath: string }> {
  await mkdir(directory, { recursive: true });
  const jsonPath = path.join(directory, `${prefix}.json`);
  const markdownPath = path.join(directory, `${prefix}.md`);
  await Promise.all([
    writeFile(jsonPath, `${stringifyJson(report)}\n`, "utf8"),
    writeFile(markdownPath, renderMarkdown(report), "utf8"),
  ]);
  return { jsonPath, markdownPath };
}
