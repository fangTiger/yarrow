// src/vercel/api.ts
import { waitUntil } from "@vercel/functions";
import { createFrontendHandler } from "../frontend/server.js";
import { createSanyiRuntime } from "../frontend/runtime.js";
import { setBackgroundKeepAlive } from "../sanyi/background.js";
import { createConsoleLogger } from "../sanyi/log.js";
import { backendFromEnv, FileBackend } from "../sanyi/storage.js";

/** Vercel 函数入口：只处理 /api/*，静态页面由 CDN 直接提供。 */
const backend = backendFromEnv(process.env);
if (backend instanceof FileBackend) {
  // Vercel 文件系统只读且各实例不共享，必须接 Upstash Redis。
  throw new Error("Vercel 部署缺少 Upstash Redis 环境变量（KV_REST_API_URL / KV_REST_API_TOKEN）");
}
// 后台任务交给 waitUntil，响应返回后继续起卦与落笔。
setBackgroundKeepAlive(waitUntil);
const { api, metrics, dailyHexagram, statsToken } = createSanyiRuntime({
  backend,
  logger: createConsoleLogger(),
});

export default createFrontendHandler({ api, metrics, dailyHexagram, statsToken });
