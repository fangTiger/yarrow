## ADDED Requirements

### Requirement: 中英一键切换

网站 MUST 提供「中 / EN」一键切换整站语言，同一时间只显示一种语言。首次访问 MUST 按浏览器语言选择（zh 开头为中文，其余为英文）；用户的选择 MUST 记住；`<html lang>` MUST 随之改变。界面文案 MUST 来自中英两套字典，两套键 MUST 一致，占位符 MUST 一致。英文模式下界面 MUST 不出现汉字（卦名括注等白名单除外）。

#### Scenario: 外国用户首次访问

- **WHEN** 浏览器语言为 en-US 的用户首次打开首页
- **THEN** 首页以英文显示，右上角可一键切换到中文

### Requirement: 周边组件随语言切换

钱包弹窗（RainbowKit）、网页标题与描述、付款与输入校验类报错 MUST 随语言切换。服务端这类报错 MUST 带错误码，前端按错误码显示对应语言。

#### Scenario: 英文模式下付款失败

- **WHEN** 英文模式下付款凭证已被使用
- **THEN** 页面以英文显示对应错误
