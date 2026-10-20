// src/frontend/server.ts
import { readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { isAbsolute, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createSanyiApi, type SanyiApi } from "../sanyi/api.js";
import {
  ForbiddenOrigin,
  PayloadTooLarge,
  PaymentRequiredError,
  SanyiInputError,
  errorCodeForError,
  type PaymentRequirements,
  statusForError,
  UnsupportedMediaType,
} from "../sanyi/http-errors.js";
import { createSanyiLogger } from "../sanyi/log.js";
import {
  isFrontendMetricEvent,
  NOOP_METRICS,
  type UsageMetrics,
} from "../sanyi/metrics.js";
import { PaymentAlreadyUsedError } from "../sanyi/reading-service.js";
import type { DailyHexagram } from "../sanyi/daily-hexagram.js";
import type { BaziSchoolKey } from "../sanyi/schools/bazi-shared.js";
import type { QuestionSchoolKey } from "../sanyi/schools/index.js";
import type { NamingFamilyKey } from "../sanyi/naming/schema.js";
import { backendFromEnv } from "../sanyi/storage.js";
import { isReadingId } from "../sanyi/store.js";
import { createSanyiRuntime } from "./runtime.js";
interface FrontendServerOptions {
  publicDir?: string;
  api?: SanyiApi;
  metrics?: UsageMetrics;
  statsToken?: string;
  dailyHexagram?: { get(): Promise<DailyHexagram> };
}
const CONTENT_TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
};
const SCHOOL_KEYS = new Set<QuestionSchoolKey | BaziSchoolKey | NamingFamilyKey>([
  "chengyi", "jingfang", "shaoyong", "shenxiaozhan", "yuchuntai", "rentieqiao",
  "wuxing", "shiwen", "yinyi",
]);
export function resolveStaticPath(publicDir: string, pathname: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.includes("\0")) {
    return null;
  }
  const requested = decoded === "/" ? "/index.html"
    : decoded.endsWith("/") ? `${decoded}index.html` : decoded;
  const candidate = resolve(publicDir, `.${requested}`);
  const fromRoot = relative(resolve(publicDir), candidate);
  return fromRoot.startsWith("..") || isAbsolute(fromRoot) ? null : candidate;
}
function json(response: ServerResponse, status: number, payload: unknown, cacheControl = "no-store"): void {
  response.writeHead(status, {
    "cache-control": cacheControl,
    "content-type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}
function empty(response: ServerResponse, status: number): void {
  response.writeHead(status, { "cache-control": "no-store" });
  response.end();
}
function requireSameOrigin(request: IncomingMessage): void {
  const host = request.headers.host;
  // HTTPS 由 Vercel 等反向代理终止，按其转发的协议核对；浏览器无法伪造该请求头。
  const forwarded = request.headers["x-forwarded-proto"];
  const protocol = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",", 1)[0]?.trim() || "http";
  if (!host || request.headers.origin !== `${protocol}://${host}`) {
    throw new ForbiddenOrigin();
  }
}
async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const type = request.headers["content-type"] ?? "";
  if (type.toLowerCase().split(";", 1)[0]?.trim() !== "application/json") {
    throw new UnsupportedMediaType();
  }
  const chunks: Buffer[] = [];
  let size = 0;
  let oversized = false;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    oversized ||= size > 8_192;
    if (!oversized) {
      chunks.push(buffer);
    }
  }
  if (oversized) {
    throw new PayloadTooLarge();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    throw new SanyiInputError("请求体不是合法 JSON");
  }
}
function errorPayload(error: unknown): {
  error: string; code?: string; readingId?: string; payment?: PaymentRequirements;
} {
  const message = statusForError(error) === 500
    ? "服务暂时不可用"
    : error instanceof Error ? error.message : "服务暂时不可用";
  const code = errorCodeForError(error);
  return {
    error: message,
    ...(code ? { code } : {}),
    ...(error instanceof PaymentAlreadyUsedError ? { readingId: error.readingId } : {}),
    // 402：附上付款要求，agent 无须另查 /api/payment 即可付款。
    ...(error instanceof PaymentRequiredError ? { payment: error.payment } : {}),
  };
}
export type FrontendRequestHandler = (request: IncomingMessage, response: ServerResponse) => Promise<void>;

/** 请求处理函数：常驻服务与 Vercel 函数共用。 */
export function createFrontendHandler(options: FrontendServerOptions = {}): FrontendRequestHandler {
  const publicDir = resolve(options.publicDir ?? resolve(process.cwd(), "web"));
  const api = options.api;
  const metrics = options.metrics ?? NOOP_METRICS;
  return async (request, response) => {
    const rawPath = (request.url ?? "/").split("?", 1)[0] ?? "/";
    const url = new URL(request.url ?? "/", "http://localhost");
    try {
      if (/^\/api\/(oracle|demo(?:\/|$)|question(?:\/|$))/.test(url.pathname)) {
        json(response, 404, { error: "接口已下线" });
        return;
      }
      const idRoute = url.pathname.match(/^\/api\/readings\/([^/]+)$/);
      const translateRoute = url.pathname.match(/^\/api\/readings\/([^/]+)\/translate$/);
      const castRoute = url.pathname.match(/^\/api\/readings\/([^/]+)\/cast$/);
      const summaryRoute = url.pathname.match(/^\/api\/readings\/([^/]+)\/summary\/retry$/);
      const retryRoute = url.pathname.match(
        /^\/api\/readings\/([^/]+)\/schools\/([^/]+)\/retry$/,
      );
      const boundaryRoute = url.pathname.match(/^\/api\/readings\/([^/]+)\/day-boundary$/);
      const feedbackRoute = url.pathname.match(/^\/api\/readings\/([^/]+)\/feedback$/);
      const subjectRoute = url.pathname.match(/^\/api\/readings\/([^/]+)\/subject$/);
      const isApi = url.pathname.startsWith("/api/");
      const writing = request.method === "POST";
      if (writing && isApi) {
        requireSameOrigin(request);
      }
      const body = writing && isApi ? await readJsonBody(request) : undefined;
      if (request.method === "POST" && url.pathname === "/api/events") {
        const event = body && typeof body === "object" && !Array.isArray(body)
          ? (body as Record<string, unknown>).event
          : undefined;
        if (!isFrontendMetricEvent(event)) {
          throw new SanyiInputError("事件名无效", "invalid-event");
        }
        await metrics.increment(event);
        empty(response, 204);
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/stats") {
        if (!options.statsToken) {
          json(response, 404, { error: "未找到接口" });
          return;
        }
        const token = request.headers["x-stats-token"];
        if (typeof token !== "string" || token !== options.statsToken) {
          json(response, 403, { error: "拒绝访问" });
          return;
        }
        const rawDays = url.searchParams.get("days");
        const days = rawDays === null ? 14 : Number(rawDays);
        if (!Number.isInteger(days) || days < 1 || days > 60 || (rawDays !== null && !/^\d+$/u.test(rawDays))) {
          throw new SanyiInputError("days 必须是 1–60 的整数", "invalid-days");
        }
        json(response, 200, { days: await metrics.recentDays(days) });
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/daily-hexagram" && options.dailyHexagram) {
        json(response, 200, await options.dailyHexagram.get(), "public, max-age=300");
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/payment" && api) {
        json(response, 200, await api.payment());
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/now" && api) {
        json(response, 200, await api.now());
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/classify" && api) {
        json(response, 200, await api.classify(body));
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/day-master" && api) {
        json(response, 200, await api.dayMaster(body));
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/readings" && api) {
        json(response, 200, await api.createReading(body));
        return;
      }
      if (idRoute && request.method === "GET" && api && isReadingId(idRoute[1] ?? "")) {
        const lang = url.searchParams.get("lang") ?? undefined;
        json(response, 200, await api.getReading(idRoute[1] as string, lang));
        return;
      }
      if (translateRoute && request.method === "POST" && api && isReadingId(translateRoute[1] ?? "")) {
        json(response, 202, await api.translateReading(translateRoute[1] as string, body));
        return;
      }
      if (castRoute && request.method === "POST" && api && isReadingId(castRoute[1] ?? "")) {
        json(response, 200, await api.continueCasting(castRoute[1] as string));
        return;
      }
      if (summaryRoute && request.method === "POST" && api && isReadingId(summaryRoute[1] ?? "")) {
        json(response, 200, await api.retrySummary(summaryRoute[1] as string));
        return;
      }
      const retryKey = retryRoute?.[2] as QuestionSchoolKey | BaziSchoolKey | NamingFamilyKey | undefined;
      if (
        retryRoute
        && request.method === "POST"
        && api
        && isReadingId(retryRoute[1] ?? "")
        && retryKey
        && SCHOOL_KEYS.has(retryKey)
      ) {
        json(response, 200, await api.retrySchool(retryRoute[1] as string, retryKey));
        return;
      }
      if (boundaryRoute && request.method === "POST" && api && isReadingId(boundaryRoute[1] ?? "")) {
        json(response, 200, await api.changeDayBoundary(boundaryRoute[1] as string, body));
        return;
      }
      if (feedbackRoute && request.method === "POST" && api && isReadingId(feedbackRoute[1] ?? "")) {
        json(response, 200, await api.setPeriodFeedback(feedbackRoute[1] as string, body));
        return;
      }
      if (subjectRoute && request.method === "POST" && api && isReadingId(subjectRoute[1] ?? "")) {
        json(response, 200, await api.changeSubject(subjectRoute[1] as string, body));
        return;
      }
      if (isApi) {
        json(response, 404, { error: "未找到接口" });
        return;
      }
      if (request.method !== "GET" && request.method !== "HEAD") {
        json(response, 405, { error: "静态资源只允许读取" });
        return;
      }
      const path = resolveStaticPath(publicDir, rawPath);
      if (!path) {
        json(response, 403, { error: "拒绝访问" });
        return;
      }
      try {
        const content = await readFile(path);
        const extension = path.slice(path.lastIndexOf("."));
        response.writeHead(200, {
          "cache-control": path.endsWith("index.html") ? "no-cache" : "public, max-age=3600",
          "content-type": CONTENT_TYPES[extension] ?? "application/octet-stream",
        });
        response.end(request.method === "HEAD" ? undefined : content);
      } catch (error) {
        const status = (error as NodeJS.ErrnoException).code === "ENOENT" ? 404 : 500;
        json(response, status, { error: status === 404 ? "未找到" : "读取失败" });
      }
    } catch (error) {
      json(response, statusForError(error), errorPayload(error));
    }
  };
}

export function createFrontendServer(options: FrontendServerOptions = {}): Server {
  return createServer(createFrontendHandler(options));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const clock = () => new Date();
  const { api, service, network, recipient, metrics, dailyHexagram, statsToken } = createSanyiRuntime({
    backend: backendFromEnv(process.env),
    logger: createSanyiLogger("log", clock),
    clock,
  });
  const port = Number(process.env.FRONTEND_PORT ?? "4173");
  const host = process.env.FRONTEND_HOST ?? "127.0.0.1";
  createFrontendServer({ api, metrics, dailyHexagram, statsToken }).listen(port, host, () => {
    console.log(`三易服务已启动：http://${host}:${port}（${network.name}）`);
    console.log(`三易收款地址：${recipient}`);
    console.log("问事卦金：0.05 USDC；付款后自动六掷，三家依同一卦独立落笔");
    console.log("复算材料：付款首笔交易与六个 Arc 区块会随解读存档");
    // 服务重启后续掷未完成的卦。
    void service.resumePendingCasts().then((ids) => {
      if (ids.length > 0) {
        console.log(`续掷未完成的卦：${ids.length} 卦`);
      }
    });
  });
}
