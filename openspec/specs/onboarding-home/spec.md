# onboarding-home Specification

## Purpose
TBD - created by archiving change yarrow-global. Update Purpose after archive.
## Requirements
### Requirement: 八卦首页与一句话说明

首页 MUST 以后天八卦环为视觉中心，卦位固定（离上、坎下、震左、兑右），每卦标卦名与象征（中英随语言），只有外圈装饰环可以缓慢旋转，`prefers-reduced-motion` 时 MUST 静止。首页 MUST 有一句话说明与三步流程，并写明「Arc 测试网，不花真钱」。

#### Scenario: 看懂首页

- **WHEN** 英语用户打开首页
- **THEN** 看到八卦环、一句话说明「Ancient Chinese divination…」与三步流程

### Requirement: 类型卡与示例问题

四个类型 MUST 各有一句说明与 2–3 个可点选填入的示例问题。英文模式下类型与问事的事项 MUST 由用户手选，关键词只做预选；识别不到事项时 MUST 不默认任何事项。

#### Scenario: 英文问事

- **WHEN** 英文模式下输入「Will I get this job?」
- **THEN** 类型保持用户所选；事项预选 Career，用户可改，必须选定后才能付款

### Requirement: 示例结果

首页 MUST 在付款之前提供「示例结果」入口，依次为命理、问事、运势、起名四卦，打开即为完整结果页，只读，并有「示例」横幅。示例页 MUST 不读取访客本机生辰。

#### Scenario: 先看示例

- **WHEN** 用户点「See a sample reading」
- **THEN** 不连钱包即可看到一卦完整的英文结果页，没有可操作的重试或修改按钮
- **AND** 第一个示例是命理，含性格画像与一生运势

### Requirement: 钱包与测试币引导

付款区 MUST 随钱包状态给出引导：没有钱包时提示安装（手机给 MetaMask App 深链）；网络不对时提示一键切到 Arc 测试网；余额为 0 时给复制地址与 faucet.circle.com 链接。收款地址与 gas 估算 MUST 收入「付款详情」折叠。

#### Scenario: 没有测试币

- **WHEN** 已连接 Arc 测试网但 USDC 余额为 0
- **THEN** 付款区显示复制地址按钮与水龙头链接

### Requirement: 外国用户的姓氏选择与免责声明

人名起名 MUST 提供常见姓氏选择器（拼音、英文字义、按首字母筛选），也可直接输入汉字姓。页脚与付款区 MUST 写明仅供参考与自我反思，不构成医疗、法律或投资建议。

#### Scenario: 外国用户起人名

- **WHEN** 英文用户不会写汉字
- **THEN** 可从选择器中选「林 Lin · forest」作为姓

### Requirement: 品牌印与浏览器图标

各页顶栏 MUST 以同一枚品牌印（朱印「易」，字形取自 Ma Shan Zheng）作为标识，中英文一致，不再随页面或语言换字。浏览器 MUST 能取到站点图标：SVG 图标供现代浏览器、`favicon.ico`（16/32/48）供旧环境与默认请求、180×180 的 `apple-touch-icon.png` 供 iOS 主屏；小尺寸图标的字形 MUST 加粗，保证 16px 下仍可辨认。

#### Scenario: 打开首页

- **WHEN** 用户打开首页
- **THEN** 顶栏左侧是朱印「易」与品牌名（英文 Yarrow，中文 三易），浏览器标签页显示同一枚朱印

#### Scenario: 浏览器默认请求

- **WHEN** 浏览器或抓取器请求 `/favicon.ico`
- **THEN** 服务端以 `image/x-icon` 返回含 16、32、48 三档的图标

### Requirement: 命理优先的首页说明

首页一句话说明 MUST 突出一生运势与性格，并说明过去的运可对照亲历；三步说明的第一步 MUST 写明「填生辰（问题选填）」。命理的示例问题 MUST 为「我这辈子的运势走向如何？」「我的性格优势是什么？」及其英文。

#### Scenario: 首次打开

- **WHEN** 英语用户打开首页
- **THEN** 看到「Enter your birth date to see the ten-year luck cycles of your life…」，命理已默认选中

