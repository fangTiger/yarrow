# day-master-tool Specification

## Purpose
规定首页免费「测测你的日主」：用与付费命理相同的排盘算出日主并给出中英短介绍与分享图，不调用模型、不存生辰。本能力是免费入口与可分享的身份标签，引导到八字知识页和付费命理。
## Requirements
### Requirement: 免费日主查询

首页 MUST 提供「测测你的日主 / Find your Day Master」，免费，不需要钱包，不调用模型。用户输入生辰后：
- 系统 MUST 用与付费命理相同的排盘逻辑算出日主；
- MUST 显示日主（天干、五行、阴阳，中文如「癸水」，英文如「Gui Water (Yin)」）和一段简短性格介绍；
- 英文界面 MUST 链到对应的日主知识页；
- MUST 提供一键带入付费命理的入口。

查询接口 MUST NOT 存储生辰，响应 MUST NOT 回显生辰。

#### Scenario: 与付费命理一致

- **WHEN** 同一生辰分别查日主和下付费命理
- **THEN** 两处的日主相同

#### Scenario: 零成本

- **WHEN** 访客查询日主
- **THEN** 服务端不调用任何模型，不写入生辰

### Requirement: 日主分享图

日主结果 MUST 能生成分享图，按当前界面语言显示日主与性格要点。分享图 MUST NOT 包含生日、出生时间或出生地；英文图除品牌印外 MUST NOT 出现汉字。

#### Scenario: 英文分享图

- **WHEN** 英文界面生成日主分享图
- **THEN** 图上写「Gui Water Day Master」等英文与网址，不含生日

