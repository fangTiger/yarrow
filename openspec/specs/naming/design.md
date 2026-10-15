# naming 技术设计

## 概览

起名是独立的付费 reading 类型，覆盖人名和商号。服务端先用确定性字库、诗文语料、八字五行或行业映射准备约束，再由五行补益、诗文出处、音形字义三家各给候选，最后生成三家合参。

## 模块与文件

- `src/sanyi/naming/service.ts`：`NamingReadingService` 负责输入、付款、命盘基础、候选、三家、合参、重试和存档。
- `src/sanyi/naming/schema.ts`：三家输出、合参输出和起名上下文的 JSON 结构。
- `src/sanyi/naming/families.ts`：`NAMING_FAMILIES` 及三家提示词构建。
- `src/sanyi/naming/runner.ts`：`runNamingFamily`、`runNamingSummary` 及其外层失败重试。
- `src/sanyi/naming/audit.ts`：字表、喜用、出处、音调、禁用词、推荐集合和对象边界核对。
- `src/sanyi/naming/lexicon.ts`、`lexicon.json`：`charInfo`、`isNameChar`、`isSurname` 与逐字资料。
- `src/sanyi/naming/classics.ts`、`classics.json`：`pickCandidates`、`lineById` 与入库诗文候选。
- `src/sanyi/naming/favorable.ts`：`eightCharCounts`、`supplementElements`、`industryElement`。
- `src/sanyi/naming/card.ts`：`nameScores`、`nameSupplements`、`charAnalysis`、`echoLines`。
- `src/sanyi/naming/public.ts`：`publicNamingReading` 清理内部候选编号并补全公开名字卡。
- `web/pages/NamingReading.tsx`、`web/components/NamingFields.tsx`、`NameCard.tsx`、`WuxingPanel.tsx`：输入与结果展示。

## 数据流

1. 首页按人名或商号校验姓氏、字数、生辰、行业与期望，API 在付款前重复校验。
2. 付款通过后，人名或带店主生辰的商号调用八字排盘，只保存四柱、五行与调候派生结果。
3. `supplementElements` 先看天干和地支本气所缺，再用调候喜用补位；无生辰商号尝试行业关键词映射。
4. `pickCandidates` 以 reading id 为种子，从入库诗文中确定性选择候选句编号。
5. 三家并行生成各三个名字；`runNamingFamily` 最多三次核对重写，仍不合格则删去坏名字。
6. 程序按字库回填拼音、五行依据、康熙笔画和释义，诗文出处按候选编号回填。
7. 已完成家进入合参；合参只能推荐已通过核对的名字，并优先无音律提示候选。
8. `publicNamingReading` 增加参考评分、补益标记、用字分析和诗文回响，前端显示五行分析与名字卡。

## 关键决策

- 模型负责组合与文案，字是否可用、五行、读音、笔画、出处和评分由程序决定。
- 人名生辰使用独立表单状态，不覆盖用户自己的本机生辰档案。
- 诗文家只引用服务端提供的候选编号，公开出处由程序回填，阻止编造书名原句。
- 不使用五格、三才、生肖或星座评分；综合分是四个公开项目的程序结果。
- 存档不含原始出生日期和时间，只保留四柱、喜用与生成上下文。

## 约束与已知限制

- 人名姓氏限一至两个字表内汉字；名字限一或二字，商号限二至四字。
- 未出生人名按预产期排三柱；性别“不限”在排盘基础中映射为男，但结果保留不限语义。
- 行业无法映射且无生辰时，五行家可自选元素并必须说明。
- 每家和合参的手动免费重试各最多两次；零家成功时不能生成合参。

## 测试

- `tests/naming-service.test.ts`、`tests/naming-api.test.ts`：端到端状态、付款、隐私和公开视图。
- `tests/naming-runner.test.ts`、`tests/naming-audit.test.ts`：三家、合参、重写和修补。
- `tests/naming-lexicon.test.ts`、`tests/naming-classics.test.ts`、`tests/naming-favorable.test.ts`：字库、语料和补益规则。
- `tests/naming-card.test.ts`：评分、逐字分析与诗文回响。
- `tests/frontend-naming-entry.test.ts`、`tests/frontend-naming-reading.test.ts`：表单、五行面板和结果页。
