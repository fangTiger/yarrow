# 发布文案草稿（面向外国用户）

> 状态：草稿，发布前由用户确认。所有说法须与线上功能一致，不承诺准确率，保留「仅供自我反思」的声明。
> 站点：https://yarrow-six.vercel.app · 仓库：https://github.com/fangTiger/yarrow

## X 长帖（6 条）

**1/**
I built Yarrow: an I Ching and BaZi reader where three classical Chinese masters read your chart independently, and the casting can be checked on-chain.

0.05 USDC per reading on @arc mainnet.
yarrow-six.vercel.app

**2/**
Enter your birth date and you get:
- your eight ten-year luck cycles, each scored by three BaZi schools
- a character portrait
- a plain-language summary and practical advice

The decades you've already lived are marked "look back". Do they match your life? Tap Accurate or Not quite.

**3/**
Ask a question instead, and the I Ching hexagram is cast from Arc block hashes produced after your payment.

Press "Verify on Arc" and your browser re-reads the chain and recomputes all six throws. Yarrow's server isn't involved.

**4/**
The charts are computed in code, not by a language model: Four Pillars, luck cycles, the hexagram and its lines, the almanac.

Each master's interpretation is checked against the chart. Claims the chart doesn't support are removed before you see them.

**5/**
Agents can buy readings too. POST without payment → HTTP 402 with the price and recipient. Pay 0.05 USDC on Arc, claim the reading with your tx hash.

Guide: yarrow-six.vercel.app/llms.txt
No server keys. Arc's USDC gas makes this simple.

**6/**
Free samples, no wallet needed: yarrow-six.vercel.app (see "Sample readings").

Code: github.com/fangTiger/yarrow
For reflection only: not medical, legal or financial advice.

## Reddit（r/iching 或 r/Bazi 等；发帖前先读各版版规，不少版禁止自我推广）

**标题：** I built a BaZi/I Ching reader where three classical schools read your chart independently, and you can check whether past decades match your life

**正文：**

I've been working on Yarrow, a reader for Chinese metaphysics where the chart is computed deterministically and three classical schools interpret it independently:

- **BaZi:** Shen Xiaozhan (structure), Yu Chuntai (seasonal balance, *Qiongtong Baojian*) and Ren Tieqiao (strength balance). Each school picks its own useful element and scores all eight luck cycles. You see where they agree and where they differ.
- **I Ching:** Cheng Yi (meaning and principle), Jing Fang (Najia six-line method) and Shao Yong (Plum Blossom).

What I'd love feedback on: the luck-cycle chart marks the decades you've already lived, and you can mark each one "accurate" or "not quite". I'm curious whether the three schools' scoring matches people's experience.

There are free sample readings on the home page, no wallet needed. A full reading costs 0.05 USDC. Payments are on the Arc blockchain, and for I Ching the coin throws come from block hashes you can verify yourself.

Every interpretation is checked against the computed chart, and unsupported claims are removed. It's for reflection, not advice.

Link: https://yarrow-six.vercel.app
Code: https://github.com/fangTiger/yarrow

## 中文短帖（即刻 / 小红书 / X 中文圈）

做了个小东西「三易」：输入生辰，看你一生八步大运的起伏与性格画像。沈孝瞻、余春台、任铁樵三家各自打分、各自下断，过去的运可以对照自己的经历，点「准 / 不太准」。

问事用的是 Arc 区块哈希起卦，点「在 Arc 上验证」，浏览器直接读链复算六掷，不经过服务器。

首页有免费示例，不连钱包也能看。完整一卦 0.05 USDC。仅供自我反思，不构成任何建议。
https://yarrow-six.vercel.app
