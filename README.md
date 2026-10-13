# Yarrow · 三易

**English** · [中文](README.zh-CN.md)

Yarrow is a Chinese classical divination app on **Arc mainnet**. Ask a question, read your birth chart, or look for a name. Three classical masters each give an independent reading, and a plain-language summary explains what they agree on. Each reading costs **0.05 USDC on Arc**.

🔗 **Live app:** https://yarrow-six.vercel.app

> For reference and self-reflection only. Not medical, legal, or investment advice.

## What it does

| Reading | Input | The three voices |
|---|---|---|
| **Ask** (I Ching hexagram) | A question | Cheng Yi 程颐 (meaning and principle), Jing Fang 京房 (Najia line method), Shao Yong 邵雍 (Plum Blossom numerology) |
| **Destiny** / **Fortune** (BaZi) | Birth date, hour, and sex | Shen Xiaozhan 沈孝瞻 (structure school), Yu Chuntai 余春台 (seasonal balance), Ren Tieqiao 任铁樵 (strength balance) |
| **Naming** | Surname and preferences | Five Elements, classical sources, sound and meaning |

Each reading has four parts:

- **A deterministic chart.** The hexagram, Najia lines, BaZi pillars, ten-year luck cycles, almanac, and Qimen board are computed in code. The language model doesn't produce any of them.
- **Three independent interpretations.** Each school is a separate model call with its own method.
- **A fact check.** Every interpretation is checked against the computed chart. Statements the chart doesn't support are removed or rewritten before you see them.
- **A plain-language summary** of where the three schools agree, plus practical guidance.

The interface is available in Chinese and English, and English readings are translated from the checked Chinese text.

## How Yarrow uses Arc

Arc is the payment rail, and for I Ching readings it is also the source of randomness.

1. **USDC payment on Arc mainnet** (chain ID `5042`). The user's wallet sends 0.05 USDC to the Yarrow address through the USDC ERC-20 interface at `0x3600000000000000000000000000000000000000`. On Arc, gas is also paid in USDC.
2. **Server-side verification, with no keys held.** The backend reads the transaction receipt from Arc and checks the `Transfer` event: the payer, the recipient, and the exact amount. Each payment can open only one reading. The server holds no private keys and never sends a transaction.
3. **Coins cast from Arc blocks.** After payment, the six coin throws come from the next six Arc blocks:
   ```
   keccak256("sanyi-throw-v1", paymentTxHash, blockHash, question, index) → 3 coins
   ```
   Anyone with the payment hash and the block hashes can recompute the hexagram. The block numbers and hashes are stored with each reading and shown on the reading page.

## Architecture

```
Browser (React · wagmi · RainbowKit)
  │  pay 0.05 USDC on Arc ──────────────► Arc mainnet
  │  POST /api/readings {txHash}
  ▼
Vercel Function (Node 22, one bundled handler)
  ├─ verify the USDC Transfer receipt ◄── Arc RPC
  ├─ cast six throws from new blocks  ◄── Arc RPC
  ├─ compute the chart (deterministic)
  ├─ three schools + summary          ──► DeepSeek V4 Flash
  └─ store the reading                ──► Upstash Redis
```

- **Frontend:** React 18, wagmi, and RainbowKit, bundled with esbuild.
- **Backend:** TypeScript on Node 22, deployed to Vercel through the Build Output API (`scripts/build-vercel.ts`). Work that continues after the response (casting and writing the readings) runs under `waitUntil`, for up to 300 s.
- **Storage:** Upstash Redis in production, local JSON files in development. Concurrent updates use compare-and-set, and a payment is claimed with `SET NX`.
- **Model:** DeepSeek `deepseek-v4-flash`, with JSON schema output.

## Run locally

Requires Node.js 22 or later.

```bash
npm ci
cp .env.example .env   # fill in DEEPSEEK_API_KEY and WALLETCONNECT_PROJECT_ID
npm run frontend:dev   # http://127.0.0.1:4173
```

Local development uses Arc Testnet by default (`ARC_CHAIN_ID=5042002`) and stores readings under `data/`.

```bash
npm run typecheck
npm test
```

## Deploy to Vercel

1. Import the repository into Vercel. `vercel.json` already sets the build command.
2. Under **Storage**, add **Upstash Redis**. It injects `KV_REST_API_URL` and `KV_REST_API_TOKEN`.
3. Set these environment variables, then redeploy:

| Variable | Value |
|---|---|
| `ARC_CHAIN_ID` | `5042` for Arc mainnet |
| `SANYI_FEE_RECIPIENT` | The address that receives reading fees |
| `DEEPSEEK_API_KEY` | DeepSeek API key |
| `WALLETCONNECT_PROJECT_ID` | Public Reown project ID, required by RainbowKit |

On mainnet, the service refuses to start without an explicit fee recipient, or if the RPC or explorer URL points to a testnet.

## Repository layout

```
web/                 React frontend
src/sanyi/           Reading services, schools, fact checks, storage, fees
src/calendar/        Almanac, BaZi, Qimen, and calendar calculations
src/oracle/          Hexagram and Najia chart
src/vercel/api.ts    Vercel function entry
scripts/             Build and maintenance scripts
openspec/            Specifications and change history
```

`contracts/`, `reports/`, and `docs/legacy/` come from an earlier testnet prototype ([notes, in Chinese](docs/legacy/arc-testnet-feasibility.md)). The live app doesn't use them.
