# Change: Yarrow 面向海外——出生时区、中英一键切换、八卦首页与上手引导、英文解读

## Why

首批客户是外国人。现在的产品存在四个问题：
- 只有中文；
- 新用户第一次打开看不懂；
- 钱包与测试币门槛高；
- 生辰按北京时间计算，海外出生者的八字会悄悄算错。

## What Changes

- 生辰增加出生地时区：海外时区按「年月看节气的绝对时刻，日时看当地标准时」排盘；中国时区沿用现有逻辑与夏令时表。
- 英文问题的语言守卫：断语仍用中文生成并核对，检查汉字占比。
- 中英一键切换：首次访问按浏览器语言；界面文案改为中英两套字典；RainbowKit 语言、网页元信息、服务端报错 code 随语言切换。
- 首页改版：
  - 后天八卦环（复用 Luopan）；
  - 一句话说明与三步流程；
  - 类型卡与示例问题，英文模式下类型与事项手选；
  - 示例结果（只读）；
  - 随钱包状态变化的测试币引导与手机深链；
  - 姓氏选择器；
  - 免责声明。
- 英文解读：中文结果按单元翻译为英文（总述与各家分开），附确定性的译文核对器、旁路存储、免费幂等接口与防滥用；古文（卦辞、爻辞、大象传）用离线译表；确定性内容走术语表。
- 品牌：英文名 Yarrow，中文名三易。

## Impact

- Affected specs：新增 `birth-timezone`、`language-switch`、`onboarding-home`、`reading-translation`。
- Affected code：
  - `src/calendar/solar-time.ts`、`src/calendar/bazi.ts`、`src/sanyi/birth-profile.ts`；
  - 提示词与核对；
  - `src/sanyi/api.ts`、`src/frontend/server.ts`；
  - 新增 `src/sanyi/translation/`、`src/sanyi/i18n/glossary.ts`、`src/agent/zhouyi-en.json`；
  - `web/` 全部页面与组件、新增 `web/i18n/`、`web/samples/`；
  - `scripts/font-charset.ts`。
- 依赖：不新增运行时依赖。时区换算用 Node 与浏览器自带的 Intl。
- 设计文档：`docs/plans/2026-10-13-yarrow-global-design.md`
