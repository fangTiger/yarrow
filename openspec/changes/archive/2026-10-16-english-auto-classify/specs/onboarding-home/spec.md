## MODIFIED Requirements

### Requirement: 类型卡与示例问题

四个类型 MUST 各有一句说明与 2–3 个可点选填入的示例问题。英文模式 MUST 与中文一致：按关键词自动识别类型与细项，用户手点的类型优先；识别不到事项时默认 Peers 并提示可改选，付款按钮 MUST 不因事项未选而置灰。点问事的示例问题 MUST 同时选好对应事项（求职 → 工作，签合同 → 房产／文书）。类型卡 MUST 整卡可点；有指针的设备上悬停 MUST 有高亮反馈，且与选中态（金边与左侧金条）区分。

#### Scenario: 英文问事

- **WHEN** 英文模式下输入「Will I get this job?」
- **THEN** 自动切到 Ask，事项为 Career，提示「Auto-detected: Ask · Career」，可直接付款

#### Scenario: 英文识别不到事项

- **WHEN** 英文模式下选 Ask 并输入「Should I move to Berlin next spring?」
- **THEN** 事项默认 Peers or competition，提示没认出具体事项、可在上方改选，付款按钮可用

#### Scenario: 英文默认命理

- **WHEN** 英文模式下保持默认高亮的 Destiny，写了问题并填好生辰
- **THEN** 付款按钮可用，无需再点一次类型卡
