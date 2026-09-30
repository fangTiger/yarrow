## ADDED Requirements

### Requirement: 验证门禁后的 LIVE 默认
系统 MUST 仅在一次完整真实端到端验证通过后，将省略模式的演示轮和浏览器默认切换为 LIVE；MOCK 必须继续作为显式可选项。

#### Scenario: 真实验证通过
- **WHEN** 命题编译、三家解卦、全部链上预测和结算均成功且费用未超限
- **THEN** 服务端省略模式时使用 LIVE，UI 默认显示 LIVE 并允许用户改选 MOCK

#### Scenario: 真实验证失败
- **WHEN** 任一步失败、缺少 reasoning 或费用超限
- **THEN** 系统保持 MOCK 默认并报告失败原因

### Requirement: 费用与秘密边界
系统 MUST 将本轮 DeepSeek 实际费用控制在 0.3 CNY 内、链上花费控制在 1.5 USDC 内，密钥只从服务端 `.env` 读取且绝不进入浏览器源码或日志。

#### Scenario: 显示模式
- **WHEN** 用户查看或切换演示模式
- **THEN** UI 清楚显示当前模式和每卦预计花费，MOCK 为 0 CNY，LIVE 约 0.005 CNY

#### Scenario: 运行安全扫描
- **WHEN** 构建后扫描浏览器资源
- **THEN** 扫描不得发现私钥、密钥值、钱包客户端或账户派生入口
