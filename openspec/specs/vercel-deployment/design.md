# vercel-deployment 技术设计

## 概览

Vercel 部署使用 Build Output API：静态前端由 CDN 服务，所有 `/api/*` 路由进入一个 Node.js 22 函数。运行时强制使用 Upstash Redis 共享 reading、译文、付款声明和指标，并将异步编排交给 `waitUntil` 保活。

## 模块与文件

- `vercel.json`：关闭框架自动识别，使用 `npm ci` 和 `npm run vercel:build`。
- `scripts/build-frontend.ts`：打包 React 前端，只注入明确列出的公开 Arc 与 WalletConnect 配置。
- `scripts/build-vercel.ts`
  - 复制静态页面、字体、品牌资源、示例和 `llms.txt`。
  - 用 esbuild 打包 `src/vercel/api.ts`。
  - 生成 `.vc-config.json`，运行时为 `nodejs22.x`、`maxDuration` 为 300 秒。
  - 生成路由配置，把 `/api/*` 指向单一函数。
- `src/vercel/api.ts`：创建 Redis 后端、设置 `waitUntil` 保活、组装运行时并导出 HTTP handler。
- `src/frontend/runtime.ts`：`createSanyiRuntime` 统一创建链客户端、付款核验、三类 reading、翻译和指标服务。
- `src/sanyi/storage.ts`：`RedisBackend`、`backendFromEnv`、`updateDocument` 和原子付款声明。
- `src/sanyi/background.ts`：`setBackgroundKeepAlive`、`keepAlive` 抽象常驻进程与 Vercel 的差异。
- `src/arc-network.ts`：`resolveArcNetwork` 解析主网/测试网及可覆盖的 RPC、浏览器地址。
- `src/frontend/server.ts`：`createFrontendHandler` 复用路由，并按 `x-forwarded-proto` 做 HTTPS 同源校验。

## 数据流

1. 构建阶段按 `ARC_CHAIN_ID` 生成浏览器链配置；5042 为 Arc 主网，缺省为测试网。
2. `build-vercel` 产出静态目录和一个 `/api` 函数，前端源码与服务端秘密不进入静态目录。
3. 函数冷启动时 `backendFromEnv` 读取 Upstash 或 Vercel KV 兼容变量；若退回文件后端则立即报错。
4. `createSanyiRuntime` 用同一环境解析服务端链、收款地址和模型 provider。
5. API 请求创建 reading 后先把状态写入 Redis，再启动六掷、三家、总述或翻译后台 Promise。
6. `keepAlive` 把 Promise 交给 Vercel `waitUntil`，HTTP 响应返回后同一函数实例继续工作。
7. 后续轮询可落在其他实例；它们从 Redis 读取同一 reading 和译文状态。
8. 所有更新使用 CAS 重试，付款声明使用 Redis `SET NX`，指标使用 Lua 原子累加。

## 关键决策

- Vercel 不允许文件后端启动，避免只读或实例隔离文件系统造成静默丢状态。
- 常驻服务与无状态函数复用同一个 handler 和 runtime，减少环境行为分叉。
- 主网必须显式设置 `SANYI_FEE_RECIPIENT`，不能使用测试默认收款地址。
- RPC 或浏览器 URL 若带有与链身份相反的 `mainnet`/`testnet` 标记，启动时拒绝。
- HTTPS 在代理处终止，因此 Origin 比较使用 `x-forwarded-proto` 的首个协议值。

## 约束与已知限制

- 前端构建和服务端运行时都读取 Arc 环境变量，部署配置必须保证两阶段一致。
- 单次函数最长 300 秒；超过后由 `reading-resilience` 在后续读取时把停滞状态转成可重试。
- `waitUntil` 只能保活当前请求启动的任务，不能替代跨请求队列或常驻 worker。
- 翻译每日预算和 semaphore 当前是每个函数实例内状态，不是 Redis 全局限制。

## 测试

- `tests/sanyi-storage.test.ts`：Redis 跨实例读取、CAS、`SET NX`、指标累加和网络解析。
- `tests/frontend-server.test.ts`：HTTPS 转发协议、Origin、JSON 与路由边界。
- `tests/sanyi-resilience.test.ts`：300 秒平台中断后的状态恢复。
- `tests/usage-metrics.test.ts`：Redis 后端上的指标生命周期。
- `tests/frontend-boundary.test.ts`：浏览器包边界与秘密隔离。
