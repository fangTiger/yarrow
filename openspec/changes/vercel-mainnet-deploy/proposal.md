# Change: 三易上线 Arc 主网并部署到 Vercel

## Why
参加 Arc Microgrants（截止 2026-10-14 23:59 ET），要求项目已部署在 Arc 主网并可公开访问；现有后端是常驻 Node 进程加本地文件存储，只在本机 Arc Testnet 上运行。

## What Changes
- 链配置改为由环境变量驱动，默认仍为 Arc Testnet；生产设为 Arc 主网（chainId 5042，`https://rpc.mainnet.arc.io`），USDC 合约同为 `0x3600…0000`。
- 主网下前端文案不再出现「测试币」「不花真钱」，隐藏水龙头入口，改为提示准备少量 Arc 主网 USDC。
- 存储抽象为接口：本地沿用文件存储；设置 Upstash Redis 环境变量时改用 Redis（读写、带比较的原子更新、付款凭证 `SET NX` 去重）。
- 后台任务（起卦、三家落笔、总述、翻译）统一经 `keepAlive` 挂钩；Vercel 上接 `waitUntil`，单次函数最长 300 秒。
- 新增 Vercel 入口：构建时用 Build Output API 输出静态站点与单个 `/api/*` 函数。
- 修复同源校验写死 `http://` 的问题，HTTPS 部署下按 `x-forwarded-proto` 判断。

## Impact
- Affected specs: 新增 `vercel-deployment`
- Affected code: `src/sanyi/store.ts`、`src/sanyi/translation/store.ts`、三个解读服务的后台启动处、`src/frontend/server.ts`、`src/arc.ts`、`src/frontend/wallet.ts`、`web/lib/wagmi.ts`、`web/lib/wallet-summary.ts`、`web/components/WalletPaymentGuide.tsx`、`web/i18n/*`、新增 `scripts/build-vercel.ts`、`vercel.json`
