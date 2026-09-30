# Arc Testnet Agent 层审计加固补充报告

- 原始端到端报告：`reports/arc-agent-e2e-2026-09-04T19-46-06-440Z.md`
- 原始结果：mock 完整生命周期、三家同题、三哈希上链、无许可结算和未决之卦均 PASS。

## ERC-8004 身份关联

| 易者 | agentId | 关联交易 | 只读复核 |
| --- | ---: | --- | --- |
| 高島易断 | 891440 | `0xb36bdf2e62ee8cf88d3b191d5372d183438c3529bac1225594274faff9ffeb4d` | PASS |
| 五行易（断易） | 891441 | `0x31f7dfa8f7fb576454abccd74ac0d8045413d0f8134d131f3baa07ee1b83d6a0` | PASS |
| 梅花心易 | 891442 | `0xff8dc31b3ed030538ae2caab02e1791a88747922dc1d869291aaaa371df4f273` | PASS |

复核同时检查 `hasAgentId == true` 与 `agentIdOf` 等于部署清单记录。原始端到端的六次结算早于此关联，因此不会倒灌历史 ReputationRegistry 反馈；关联后的结算会按 `ScoreBook._publish` 路径写入。

## 审计闭锁

- 新增按 `chainId + PredictionBook + roundId` 键定的原子文件占用。
- 命题编译和三位易者的唯一输出均先 `fsync` 到 write-ahead 审计日志，然后紧接链上签名提交。
- 审计日志保留完整动态输入、完整结构化输出、`inputHash` 与 `outputHash`；链上 `promptHash` 保持为固定 system prompt 版本哈希。
- 如果进程崩溃，该轮会失败闭锁，而不是再次调用 provider。

## 预算

- 原始保守预算占用：2.023444 USDC
- 三笔身份关联的实际 gas：0.005113 USDC
- 更新后保守预算占用：2.028557 USDC（低于 3 USDC）

## 已知信任边界

持久日志可防止正常运行和进程崩溃后的重跑，但无法对抗拥有文件系统与签名密钥的恶意操作员主动删除审计记录。这与设计文档已公开声明的“推理中心化”边界一致；强对抗需要 TEE 或可验证推理，不在本轮范围内。
