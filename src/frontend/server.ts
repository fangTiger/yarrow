import { createServer, type Server } from "node:http";
import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createArcPublicClient } from "../arc.js";
import { createArcDemoDriver } from "../demo/arc-driver.js";
import { createDemoProvider } from "../demo/provider.js";
import { DemoActionService, type DemoStartInput, type DemoWitnessInput } from "../demo/service.js";
import { classifyQuestion } from "../oracle/question-classifier.js";
import { ProviderQuestionInterpreter } from "../oracle/question-interpreter.js";
import { QuestionCastLedger, QuestionOracleService, type QuestionOracleResult } from "../oracle/question-oracle.js";
import { ArcQuestionFeeVerifier } from "../oracle/arc-question-fee-verifier.js";
import type { QuestionFeeProof } from "../oracle/fee-payment.js";
import { readOracleSnapshot } from "./data.js";

export interface DemoActions {
  getSession(): unknown;
  prepareRound(input: DemoStartInput): Promise<unknown>;
  confirmRound(input: unknown): Promise<unknown>;
  triggerPredictions(): Promise<unknown>;
  settleRound(input?: DemoWitnessInput): Promise<unknown>;
  abandonRound(): Promise<unknown>;
}

export interface QuestionActions {
  classify(input: unknown): Promise<unknown>;
  cast(input: unknown): Promise<unknown>;
}

/**
 * 問轨启动时不创建任何持有签名能力的賭轨驱动。
 * 只有首个賭轨写请求抵达后才初始化，并在进程内复用同一实例。
 */
export function createLazyDemoActions(factory: () => Promise<DemoActions>): DemoActions {
  let actions: DemoActions | null = null;
  let pending: Promise<DemoActions> | null = null;
  const load = async (): Promise<DemoActions> => {
    if (actions) return actions;
    pending ??= factory().then((created) => {
      actions = created;
      return created;
    }).catch((error) => {
      pending = null;
      throw error;
    });
    return pending;
  };
  return {
    getSession: () => actions?.getSession() ?? null,
    prepareRound: async (input) => (await load()).prepareRound(input),
    confirmRound: async (input) => (await load()).confirmRound(input),
    triggerPredictions: async () => (await load()).triggerPredictions(),
    settleRound: async (input) => (await load()).settleRound(input),
    abandonRound: async () => actions ? actions.abandonRound() : {
      session: null,
      recovery: { roundId: null, fundsStatus: "none", amountUsdc6: "0", command: null, message: "当前没有需要恢复的賭轨轮次。" },
    },
  };
}

interface FrontendServerOptions {
  rootDir?: string;
  publicDir?: string;
  getSnapshot?: () => Promise<unknown>;
  cacheTtlMs?: number;
  demoActions?: DemoActions;
  questionActions?: QuestionActions;
}

const CONTENT_TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

export function resolveStaticPath(publicDir: string, pathname: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.includes("\0")) return null;
  const requested = decoded === "/" ? "/index.html" : decoded;
  const candidate = resolve(publicDir, `.${requested}`);
  const fromRoot = relative(resolve(publicDir), candidate);
  if (fromRoot.startsWith("..") || isAbsolute(fromRoot)) return null;
  return candidate;
}

function contentType(path: string): string {
  const extension = path.slice(path.lastIndexOf("."));
  return CONTENT_TYPES[extension] ?? "application/octet-stream";
}

function json(response: import("node:http").ServerResponse, status: number, payload: unknown): void {
  response.writeHead(status, {
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}

async function readJsonBody(request: import("node:http").IncomingMessage): Promise<unknown> {
  const contentTypeHeader = request.headers["content-type"] ?? "";
  if (!contentTypeHeader.toLowerCase().startsWith("application/json")) {
    const error = new Error("演示写接口只接受 application/json");
    error.name = "UnsupportedMediaType";
    throw error;
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 8_192) throw new Error("请求体超过 8 KiB 限制");
    chunks.push(buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    throw new Error("请求体不是合法 JSON");
  }
}

function requireSameOrigin(request: import("node:http").IncomingMessage): void {
  const origin = request.headers.origin;
  const host = request.headers.host;
  if (!origin || !host || origin !== `http://${host}`) {
    const error = new Error("拒绝跨源演示操作");
    error.name = "ForbiddenOrigin";
    throw error;
  }
}

export function createFrontendServer(options: FrontendServerOptions = {}): Server {
  const rootDir = options.rootDir ?? process.cwd();
  const publicDir = resolve(options.publicDir ?? resolve(rootDir, "web"));
  const getSnapshot = options.getSnapshot ?? (() => readOracleSnapshot(rootDir));
  const demoActions = options.demoActions;
  const questionActions = options.questionActions;
  const cacheTtlMs = options.cacheTtlMs ?? 15_000;
  let cached: { expiresAt: number; payload: unknown } | null = null;

  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://localhost");
      if (url.pathname === "/api/oracle") {
        if (request.method !== "GET" && request.method !== "HEAD") {
          json(response, 405, { error: "该接口只允许读取" });
          return;
        }
        if (!cached || cached.expiresAt <= Date.now()) {
          try {
            cached = { expiresAt: Date.now() + cacheTtlMs, payload: await getSnapshot() };
          } catch (error) {
            const noDisplayableRound = error instanceof Error && (
              error.message === "链上尚无可展示的起卦轮次"
              || error.message === "链上尚无已揭示且可展示的起卦轮次"
            );
            if (!noDisplayableRound) throw error;
            cached = {
              expiresAt: Date.now() + cacheTtlMs,
              payload: { empty: true, message: error.message },
            };
          }
        }
        response.writeHead(200, {
          "cache-control": "no-store",
          "content-type": "application/json; charset=utf-8",
        });
        response.end(request.method === "HEAD" ? undefined : JSON.stringify(cached.payload));
        return;
      }

      if (url.pathname === "/api/demo") {
        if (request.method !== "GET") {
          json(response, 405, { error: "演示状态接口只允许 GET" });
          return;
        }
        json(response, 200, demoActions?.getSession() ?? null);
        return;
      }

      const questionOperation = url.pathname === "/api/question/classify"
        ? "classify"
        : url.pathname === "/api/question/cast"
          ? "cast"
          : null;
      if (questionOperation) {
        if (request.method !== "POST") {
          json(response, 405, { error: "问卦操作接口只允许 POST" });
          return;
        }
        if (!questionActions) {
          json(response, 503, { error: "本地问卦服务未启用" });
          return;
        }
        try {
          requireSameOrigin(request);
          const body = await readJsonBody(request);
          const result = questionOperation === "classify"
            ? await questionActions.classify(body)
            : await questionActions.cast(body);
          json(response, 200, result);
        } catch (error) {
          const message = error instanceof Error ? error.message : "问卦操作失败";
          const status = error instanceof Error && error.name === "UnsupportedMediaType"
            ? 415
            : error instanceof Error && error.name === "ForbiddenOrigin"
              ? 403
              : /问题长度|提问|問轨|演示模式|显式确认/.test(message)
                ? 400
                : 503;
          json(response, status, { error: message });
        }
        return;
      }

      const demoOperation = url.pathname === "/api/demo/round/prepare"
        ? "prepare"
        : url.pathname === "/api/demo/round/confirm"
          ? "confirm-round"
        : url.pathname === "/api/demo/predictions"
          ? "predictions"
          : url.pathname === "/api/demo/settlement"
            ? "settlement"
            : url.pathname === "/api/demo/abandon"
              ? "abandon"
            : null;
      if (demoOperation) {
        if (request.method !== "POST") {
          json(response, 405, { error: "演示操作接口只允许 POST" });
          return;
        }
        if (!demoActions) {
          json(response, 503, { error: "本地演示操作服务未启用" });
          return;
        }
        try {
          requireSameOrigin(request);
          const body = await readJsonBody(request);
          const result = demoOperation === "prepare"
            ? await demoActions.prepareRound(body as DemoStartInput)
            : demoOperation === "confirm-round"
              ? await demoActions.confirmRound(body)
              : demoOperation === "predictions"
                ? await demoActions.triggerPredictions()
                : demoOperation === "settlement"
                  ? await demoActions.settleRound(
                    typeof body === "object" && body !== null ? body as DemoWitnessInput : {},
                  )
                  : await demoActions.abandonRound();
          cached = null;
          json(response, 200, result);
        } catch (error) {
          const message = error instanceof Error ? error.message : "演示操作失败";
          const status = error instanceof Error && error.name === "UnsupportedMediaType"
            ? 415
            : error instanceof Error && error.name === "ForbiddenOrigin"
              ? 403
              : /正在执行|尚未|已经|显式确认/.test(message)
                ? 409
                : /JSON|请求体|问题长度|演示模式|钱包地址|交易哈希/.test(message)
                  ? 400
                  : 503;
          json(response, status, { error: message });
        }
        return;
      }

      if (request.method !== "GET" && request.method !== "HEAD") {
        json(response, 405, { error: "静态资源只允许读取" });
        return;
      }

      const path = resolveStaticPath(publicDir, url.pathname);
      if (!path) {
        response.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
        response.end("拒绝访问");
        return;
      }
      try {
        const body = await readFile(path);
        response.writeHead(200, {
          "cache-control": path.endsWith("index.html") ? "no-cache" : "public, max-age=3600",
          "content-type": contentType(path),
        });
        response.end(request.method === "HEAD" ? undefined : body);
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        response.writeHead(code === "ENOENT" ? 404 : 500, { "content-type": "text/plain; charset=utf-8" });
        response.end(code === "ENOENT" ? "未找到" : "读取失败");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "未知错误";
      response.writeHead(503, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ error: "Arc Testnet 数据暂不可用", message }));
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const port = Number(process.env.FRONTEND_PORT ?? "4173");
  const demoActions = createLazyDemoActions(async () => {
    const service = new DemoActionService(await createArcDemoDriver());
    return {
      getSession: () => service.getSession(),
      prepareRound: (input) => service.prepareRound({ ...input, mode: "live", confirmLive: true }),
      confirmRound: (input) => service.confirmRound(input as Parameters<DemoActionService["confirmRound"]>[0]),
      triggerPredictions: () => service.triggerPredictions(),
      settleRound: (input) => service.settleRound(input),
      abandonRound: () => service.abandonRound(),
    };
  });
  const publicClient = createArcPublicClient();
  const paymentVerifier = new ArcQuestionFeeVerifier(publicClient);
  const questionCastLedger = new QuestionCastLedger();
  const questionActions: QuestionActions = {
    classify: async (input) => {
      const body = input as { question?: unknown };
      return classifyQuestion(typeof body.question === "string" ? body.question : "");
    },
    cast: async (input) => {
      const body = input as { question?: unknown; confirmedTrack?: unknown; confirmedSubject?: unknown; payment?: unknown; basisBlock?: unknown };
      const provider = createDemoProvider("live", { confirmLive: true, environment: process.env });
      return new QuestionOracleService({
        blockSource: {
          latest: async () => {
            const block = await publicClient.getBlock({ blockTag: "latest" });
            if (!block.hash) throw new Error("最新区块没有可复算哈希");
            return { number: block.number, hash: block.hash, timestamp: block.timestamp };
          },
        },
        interpreter: new ProviderQuestionInterpreter(provider),
        paymentVerifier,
        castLedger: questionCastLedger,
      }).cast({
        question: typeof body.question === "string" ? body.question : "",
        confirmedTrack: body.confirmedTrack === "wager" ? "wager" : "question",
        confirmedSubject: body.confirmedSubject,
        payment: body.payment as QuestionFeeProof,
        ...(body.basisBlock === undefined ? {} : { basisBlock: body.basisBlock as QuestionOracleResult["block"] }),
      });
    },
  };
  const server = createFrontendServer({ demoActions, questionActions });
  server.listen(port, "127.0.0.1", () => {
    console.log(`前端服务已启动：http://127.0.0.1:${port}`);
    console.log("收费入口：所有起卦收取 0.05 USDC，分入三位易者金库；分类只决定易者是否押钱");
    console.log("钱包边界：点击求卦自动连接；首次自动接续固定授权，稳态每卦一次钱包确认");
  });
}
