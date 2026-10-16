// scripts/prune-vercel-deployments.ts
// 清理 Vercel 旧部署，只保留生产域名当前指向的那一个（以及比它更新、可能仍在构建的部署）。
// 用法：npm run vercel:prune            只列出将删除的部署
//       npm run vercel:prune -- --apply  真正删除（不可恢复）
// 只按部署地址逐个删除，绝不使用「按项目名删除」，以免误删项目本身与环境变量。
import { execFileSync } from "node:child_process";

const PROJECT = "yarrow";
const PRODUCTION_ALIAS = "yarrow-six.vercel.app";
const BATCH = 20;
const apply = process.argv.includes("--apply");

interface Deployment {
  url: string;
  state: string;
  target: string | null;
  createdAt: number;
}

function vercel(args: string[]): string {
  return execFileSync("vercel", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
}

const current = JSON.parse(vercel(["inspect", PRODUCTION_ALIAS, "--format", "json"])) as {
  url: string; readyState: string; createdAt: number;
};
if (current.readyState !== "READY" || !current.url.startsWith(`${PROJECT}-`)) {
  throw new Error(`生产域名当前部署状态异常，停止清理：${current.url}（${current.readyState}）`);
}

// 分页取全部部署。
const all: Deployment[] = [];
let next: number | null = null;
do {
  const page = JSON.parse(vercel(["ls", PROJECT, "--json", ...(next ? ["--next", String(next)] : [])])) as {
    deployments: Deployment[]; pagination: { next: number | null };
  };
  all.push(...page.deployments);
  next = page.pagination.next;
} while (next);

const stale = all.filter((item) => item.url !== current.url && item.createdAt < current.createdAt);
console.log(`共 ${all.length} 个部署；保留生产部署 ${current.url}`
  + `（${new Date(current.createdAt).toISOString()}）及其后的 ${all.filter((item) => item.createdAt > current.createdAt).length} 个`);
console.log(`待删除旧部署 ${stale.length} 个${apply ? "" : "（未删除；加 --apply 执行）"}`);
if (!apply || stale.length === 0) process.exit(0);

for (let index = 0; index < stale.length; index += BATCH) {
  const urls = stale.slice(index, index + BATCH).map((item) => item.url);
  vercel(["remove", ...urls, "--yes"]);
  console.log(`已删除 ${Math.min(index + BATCH, stale.length)} / ${stale.length}`);
}
