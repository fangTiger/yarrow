## Why

当前演示仍由本地服务替提问者授权、立誓、开卦和结算，用户既无法用自己的地址承担 gas，也无法在签名前看清资金影响。与此同时，主流程被拆成多个纵向大章节，重复呈现三位易者与结算事实，导致用户无法判断当前步骤、下一步是否自动。

## What Changes

- 将现有 Web Components 前端整体迁移为 React 18 SPA，使用 wagmi 2 与 RainbowKit 2 接入钱包；RainbowKit 负责连接，wagmi 自动添加并切换 Arc Testnet，钱包未安装、拒签、网络错误与双账户余额不足均使用中文产品提示。
- 浏览器钱包签署 ERC-20 USDC `approve`、`commit`、`reveal` 和可选 `settle`；本地服务只保留三位易者预测签名，并只准备、核验用户交易。
- 显式区分 Arc 原生 18 位 USDC（gas）与 ERC-20 六位 USDC（卦金和保证金），每次签名前展示本笔资金影响和预估 gas，确认后展示 Arcscan 链接。
- 把问卦改为单屏工作台：顶部常驻六步进度轨，中心舞台原地切换，三张易者卡原地更新；删除中间应卦按钮和重复结算区块。
- “求卦”后自动完成开卦、三家应卦、等待与结算编排；结算保留明确标为可选的手动触发入口。
- 把卦历改为独立 `#/history` 路由，并把统计术语移到次级说明中，正文只保留自然语言。
- 保留 esbuild 构建，不引入 Next.js；仅把 WalletConnect project id、Arc RPC、chain id 与浏览器地址注入产物，任何私钥与账户派生代码继续 fail-closed。

## Capabilities

### New Capabilities

- `wallet-signed-divination`: 提问者钱包连接、Arc 网络切换、双精度余额门禁、签名前费用预览与用户交易签名边界。
- `single-screen-oracle-workbench`: 常驻进度轨、单屏原地状态切换、自动编排、唯一事实呈现与独立卦历路由。

### Modified Capabilities

- `action-first-oracle`: 从纵向六段渐进页改为单屏六步工作台，保留自然语言优先和诚实披露。
- `night-shrine-terminal-theme`: 保留既有色彩、字体和夜间神社终端语汇，收紧为高密度响应式工作台。

## Impact

主要影响前端依赖与 esbuild 配置、`web/index.html`、React 入口与组件、`web/lib/wagmi.ts`、`web/providers/Providers.tsx`、`src/frontend/wallet.ts`、前端秘密扫描与对应测试。既有服务准备/核验协议复用；合约、部署清单、`.env`、DeepSeek 配置与回放代码不变。
