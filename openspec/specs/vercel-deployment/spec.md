# vercel-deployment Specification

## Purpose
规定三易部署到 Vercel 与 Arc 主网时的链配置、共享 Redis 存储、后台任务保活和 HTTPS 同源校验。本能力保证无状态函数实例之间能够安全延续付款认领、解读、翻译与轮询流程。
## Requirements
### Requirement: 主网链配置
系统 SHALL 从环境变量读取 Arc 链 ID、RPC 与浏览器地址；链 ID 为 5042 时视为主网。

#### Scenario: 主网收费
- **WHEN** 部署环境设置 `ARC_CHAIN_ID=5042`
- **THEN** 钱包连接、切网、付款与服务端核验均使用 Arc 主网
- **AND** 界面不出现「测试币」「不花真钱」等测试网文案，也不显示水龙头入口

### Requirement: 无状态部署的存储
系统 SHALL 在配置 Upstash Redis 时把解读、译文与付款凭证存入 Redis，使不同函数实例看到同一份存档。

#### Scenario: 跨实例轮询
- **WHEN** 付款创建解读的请求与之后的轮询落在不同函数实例
- **THEN** 轮询仍能读到该解读及其最新进度

#### Scenario: 同一笔付款不能重复使用
- **WHEN** 两个请求几乎同时用同一笔付款交易创建解读
- **THEN** 只有一个成功创建，另一个得到已有解读的 id

### Requirement: 后台任务保活
系统 SHALL 在 Vercel 上把起卦、落笔、总述与翻译等后台任务交给 `waitUntil`，使响应返回后任务继续执行。

#### Scenario: 付款后返回
- **WHEN** 创建解读的请求已返回
- **THEN** 起卦与三家落笔在同一函数实例中继续完成并写入存储

### Requirement: HTTPS 同源校验
系统 SHALL 在 HTTPS 反向代理后按转发协议核对 Origin。

#### Scenario: Vercel 上提交表单
- **WHEN** 浏览器从 `https://<域名>` 发出 POST
- **THEN** 同源校验通过

