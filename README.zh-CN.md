# 三易 · Yarrow

[English](README.md) · **中文**

三易是运行在 **Arc 主网**上的中式命理应用。用户可以问事、看生辰八字或起名，由三位古代易学名家各自独立解读，再用一段白话总述说清三家的共同结论。每次解读收费 **0.05 USDC**，在 Arc 上支付。

🔗 **线上地址：** https://yarrow-six.vercel.app

> 仅供参考与自省，不构成医疗、法律或投资建议。

## 功能

| 类型 | 需要填写 | 三家 |
|---|---|---|
| **问事**（六爻起卦） | 一个问题 | 程颐（义理派）、京房（纳甲六爻）、邵雍（梅花易数） |
| **命理 / 运势**（八字） | 出生日期、时辰、性别 | 沈孝瞻（格局派）、余春台（调候派）、任铁樵（扶抑派） |
| **起名** | 姓氏与偏好 | 五行、诗文出处、音义 |

每次解读都包含四部分：

- **确定性的盘面。** 卦象、纳甲、八字四柱、大运、黄历、奇门盘都由代码计算，不让大模型编造。
- **三家独立断语。** 每家各自单独调用一次模型，按自家方法解读。
- **盘面核对。** 每家断语都要和计算出的盘面逐条核对，盘面不支持的说法会在展示前删去或重写。
- **白话总述。** 用现代汉语说明三家的共同结论，并给出可执行的建议。

界面支持中英文切换。英文解读由通过核对的中文结果翻译而来。

## 三易如何使用 Arc

Arc 是三易的收费通道；问事起卦时，Arc 区块还是随机数的来源。

1. **在 Arc 主网用 USDC 付款**（链 ID `5042`）。用户钱包通过 USDC 的 ERC-20 接口 `0x3600000000000000000000000000000000000000`，向三易收款地址转 0.05 USDC。Arc 的 gas 也用 USDC 支付。
2. **服务端只读核验，不持有私钥。** 后端从 Arc 读取交易回执，核对 `Transfer` 事件里的付款人、收款地址和金额。同一笔付款只能开启一次解读。服务端不保存任何私钥，也从不发送交易。
3. **用 Arc 区块起卦。** 付款后，六掷依次取付款之后的六个新区块：
   ```
   keccak256("sanyi-throw-v1", 付款交易哈希, 区块哈希, 问题, 掷序) → 三枚铜钱
   ```
   拿到付款哈希和区块哈希的人都能复算出同一卦。区块号与区块哈希随解读一起存档，并显示在解读页上。

## 架构

```
浏览器（React · wagmi · RainbowKit）
  │  在 Arc 上付 0.05 USDC ─────────────► Arc 主网
  │  POST /api/readings {交易哈希}
  ▼
Vercel 函数（Node 22，单个打包入口）
  ├─ 核验 USDC 转账回执      ◄── Arc RPC
  ├─ 取六个新区块起卦        ◄── Arc RPC
  ├─ 计算盘面（确定性）
  ├─ 三家断语与白话总述      ──► DeepSeek V4 Flash
  └─ 存档                    ──► Upstash Redis
```

- **前端：** React 18、wagmi、RainbowKit，用 esbuild 打包。
- **后端：** TypeScript，运行在 Node 22 上，通过 Build Output API 部署到 Vercel（`scripts/build-vercel.ts`）。起卦和落笔这类响应返回后还要继续执行的工作交给 `waitUntil`，最长 300 秒。
- **存储：** 生产环境用 Upstash Redis，本地开发用 JSON 文件。并发更新用比较后写入，付款认领用 `SET NX`。
- **模型：** DeepSeek `deepseek-v4-flash`，用 JSON Schema 约束输出结构。

## 本地运行

需要 Node.js 22 或更高版本。

```bash
npm ci
cp .env.example .env   # 填入 DEEPSEEK_API_KEY 与 WALLETCONNECT_PROJECT_ID
npm run frontend:dev   # http://127.0.0.1:4173
```

本地默认使用 Arc 测试网（`ARC_CHAIN_ID=5042002`），存档写在 `data/` 目录。

```bash
npm run typecheck
npm test
```

## 部署到 Vercel

1. 在 Vercel 导入本仓库。`vercel.json` 已配置好构建命令。
2. 在 **Storage** 里添加 **Upstash Redis**，它会自动注入 `KV_REST_API_URL` 和 `KV_REST_API_TOKEN`。
3. 设置以下环境变量后重新部署：

| 变量 | 值 |
|---|---|
| `ARC_CHAIN_ID` | `5042`（Arc 主网） |
| `SANYI_FEE_RECIPIENT` | 接收卦金的地址 |
| `DEEPSEEK_API_KEY` | DeepSeek 的 API key |
| `WALLETCONNECT_PROJECT_ID` | Reown 的公开项目 ID，RainbowKit 要求必填 |

在主网上，如果没有显式配置收款地址，或者 RPC、浏览器地址指向测试网，服务会拒绝启动。

## 目录结构

```
web/                 React 前端
src/sanyi/           解读服务、三家、盘面核对、存储与收费
src/calendar/        黄历、八字、奇门与历法计算
src/oracle/          卦象与纳甲排盘
src/vercel/api.ts    Vercel 函数入口
scripts/             构建与维护脚本
openspec/            规范与变更记录
```

`contracts/`、`reports/`、`docs/legacy/` 来自早期的测试网原型（[说明](docs/legacy/arc-testnet-feasibility.md)），线上应用不使用这些内容。
