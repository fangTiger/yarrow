// src/frontend/server.ts
import { readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { isAbsolute, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createArcPublicClient } from "../arc.js";
import { createDefaultProvider } from "../agent/default-provider.js";
import { ArcQuestionFeeVerifier } from "../oracle/arc-question-fee-verifier.js";
import { createSanyiApi, type SanyiApi } from "../sanyi/api.js";
import {
  ForbiddenOrigin,
  PayloadTooLarge,
  SanyiInputError,
  statusForError,
  UnsupportedMediaType,
} from "../sanyi/http-errors.js";
import { createSanyiLogger } from "../sanyi/log.js";
import { ReadingService, PaymentAlreadyUsedError } from "../sanyi/reading-service.js";
import type { QuestionSchoolKey } from "../sanyi/schools/index.js";
import { isReadingId, ReadingStore } from "../sanyi/store.js";
interface FrontendServerOptions {
  publicDir?: string;
  api?: SanyiApi;
}
const CONTENT_TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};
const SCHOOL_KEYS = new Set<QuestionSchoolKey>(["chengyi", "jingfang", "shaoyong"]);
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
  const requested = decoded === "/" ? "/index.html" : decoded;
  const candidate = resolve(publicDir, `.${requested}`);
  const fromRoot = relative(resolve(publicDir), candidate);
  return fromRoot.startsWith("..") || isAbsolute(fromRoot) ? null : candidate;
}
function json(response: ServerResponse, status: number, payload: unknown): void {
  response.writeHead(status, {
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}
function requireSameOrigin(request: IncomingMessage): void {
  const host = request.headers.host;
  if (!host || request.headers.origin !== `http://${host}`) {
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
function errorPayload(error: unknown): { error: string; readingId?: string } {
  const message = statusForError(error) === 500
    ? "服务暂时不可用"
    : error instanceof Error ? error.message : "服务暂时不可用";
  return {
    error: message,
    ...(error instanceof PaymentAlreadyUsedError ? { readingId: error.readingId } : {}),
  };
}
export function createFrontendServer(options: FrontendServerOptions = {}): Server {
  const publicDir = resolve(options.publicDir ?? resolve(process.cwd(), "web"));
  const api = options.api;
  return createServer(async (request, response) => {
    const rawPath = (request.url ?? "/").split("?", 1)[0] ?? "/";
    const url = new URL(request.url ?? "/", "http://localhost");
    try {
      if (/^\/api\/(oracle|demo(?:\/|$)|question(?:\/|$))/.test(url.pathname)) {
        json(response, 404, { error: "接口已下线" });
        return;
      }
      const idRoute = url.pathname.match(/^\/api\/readings\/([^/]+)$/);
      const throwRoute = url.pathname.match(/^\/api\/readings\/([^/]+)\/throws$/);
      const retryRoute = url.pathname.match(
        /^\/api\/readings\/([^/]+)\/schools\/([^/]+)\/retry$/,
      );
      const subjectRoute = url.pathname.match(/^\/api\/readings\/([^/]+)\/subject$/);
      const isApi = url.pathname.startsWith("/api/");
      const writing = request.method === "POST";
      if (writing && isApi) {
        requireSameOrigin(request);
      }
      const body = writing && isApi ? await readJsonBody(request) : undefined;
      if (request.method === "GET" && url.pathname === "/api/now" && api) {
        json(response, 200, await api.now());
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/classify" && api) {
        json(response, 200, await api.classify(body));
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/readings" && api) {
        json(response, 200, await api.createReading(body));
        return;
      }
      if (idRoute && request.method === "GET" && api && isReadingId(idRoute[1] ?? "")) {
        json(response, 200, await api.getReading(idRoute[1] as string));
        return;
      }
      if (throwRoute && request.method === "POST" && api && isReadingId(throwRoute[1] ?? "")) {
        json(response, 200, await api.throwCoin(throwRoute[1] as string, body));
        return;
      }
      const retryKey = retryRoute?.[2] as QuestionSchoolKey | undefined;
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
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const publicClient = createArcPublicClient();
  const service = new ReadingService({
    feeVerifier: new ArcQuestionFeeVerifier(publicClient),
    blockSource: {
      latest: async () => {
        const block = await publicClient.getBlock({ blockTag: "latest" });
        if (!block.hash) {
          throw new Error("最新区块没有可复算哈希");
        }
        return { number: block.number, hash: block.hash, timestamp: block.timestamp };
      },
    },
    provider: createDefaultProvider({ maxTokens: 2_048 }),
    store: new ReadingStore("data"),
    logger: createSanyiLogger(),
  });
  const port = Number(process.env.FRONTEND_PORT ?? "4173");
  createFrontendServer({ api: createSanyiApi(service) }).listen(port, "127.0.0.1", () => {
    console.log(`三易服务已启动：http://127.0.0.1:${port}`);
    console.log("问事卦金：0.05 USDC；付款后亲手六掷，三家依同一卦独立落笔");
    console.log("复算材料：付款首笔交易与六个 Arc 区块会随解读存档");
  });
}
