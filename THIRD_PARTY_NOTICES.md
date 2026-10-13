# 第三方资料说明

## 《周易》卦辞与爻辞语料

- 数据整理来源：[`Johnson-Jia/liuyao-divination`](https://github.com/Johnson-Jia/liuyao-divination/blob/main/data/zhouyi.json)。上游将 64 卦辞与 385 条爻辞标为公共领域原文，仓库代码采用 MIT 许可证。
- 版本参照：[维基文库《周易》](https://zh.wikisource.org/zh/周易)，页面将古籍原文标为公共领域。
- 本项目只使用卦名、卦辞、爻辞与其结构化编排，不引入上游断卦结论。
- 古籍存在异体字、断句、通假与版本差异；上游来源不构成权威校勘证明。发布前逐条复核以及最终准确性责任由本项目维护者承担。
- 本次导入发现上游 `地水师` 缺少六四；本项目依公共领域通行本补为“师左次，无咎。”。这只修复结构性缺项，不代表其余文本已完成权威校勘。

## 京房纳甲、八宫世应与飞伏规则

- 纳甲与六亲的古籍依据：[`《周易集解纂疏·诸家说易凡例》“纳十二支”“六亲”`](https://ancient-china-books.github.io/zhouyijijiezhuanshu/OEBPS/Text/4157.html)。本项目据其“乾内甲子、外壬午”等八经卦纳支与“从世卦五行论生克、命六亲”规则自行编码，未复制第三方程序代码。
- 八宫、世应、六神、旬空与伏神依据：野鹤老人《增删卜易》的八宫章、六神章、旬空章及飞伏神章；机器校读使用[公共领域古籍整理 PDF](https://data.guoxueruanjian.com/books/%E5%A2%9E%E5%88%A0%E5%8D%9C%E6%98%93%EF%BC%88%E6%A0%A1%E5%AF%B9%EF%BC%9A%E4%B8%AD%E5%9B%BD%E7%94%B7%E5%84%BF%EF%BC%89.pdf)。伏神采用“本卦六亲不现，回本宫首卦同爻位寻之”，不实现飞伏吉凶断语。
- 便于逐项复核的现代对照：周易文库[`《京房纳甲全文研读》八宫纳甲全表`](https://fatetree.cn/yijing-jingfang-najia.html)。本项目以乾为天、坤为地、水雷屯、火天大有等已知卦例做自动测试，不把该网页的解释性断语引入产品。
- 日干支算法依据：Y. T. Liu [`Sexagenary Cycle (六十干支)`](https://ytliu0.github.io/ChineseCalendar/sexagenary.html) 的儒略日模运算公式，并以 2000-01-07 甲子日交叉校验。产品选择 UTC+8 民用日期、00:00 换日；未采用子初换日，属于显式产品口径而非唯一传统口径。
- 用神、原神、忌神、仇神、月破、日破、暗动、进退神、回头生克与六冲六合的规则依据同一[《增删卜易》公共领域整理本](https://data.guoxueruanjian.com/books/%E5%A2%9E%E5%88%A0%E5%8D%9C%E6%98%93%EF%BC%88%E6%A0%A1%E5%AF%B9%EF%BC%9A%E4%B8%AD%E5%9B%BD%E7%94%B7%E5%84%BF%EF%BC%89.pdf)的用神、元神忌神衰旺、月破、日辰、暗动、进神退神与六冲六合诸章。事项分类器只给出可改选建议，服务端按用户最终确认的白名单事项取用神，不从卦象或身份推测。
- 月建采用 Y. T. Liu [`Sexagenary Cycle` 的 System 2 节气月边界](https://ytliu0.github.io/ChineseCalendar/sexagenary.html#jian)，以 [NOAA Solar Calculator](https://gml.noaa.gov/grad/solcalc/calcdetails.html) 所述、基于 Jean Meeus 的太阳视黄经近似式划分；实现限于 1901—2099 年，并在距离交界黄经 0.02° 内标记“不确定”，不伪装成精密天文历。
- 五级“旺相休囚死”明确采用[《三命通会·卷二》“论五行旺相休囚死”](https://zh.wikisource.org/wiki/%E4%B8%89%E5%91%BD%E9%80%9A%E6%9C%83/%E5%8D%B7%E4%BA%8C)的逐季表：春木旺火相水休金囚土死；夏火旺土相木休水囚金死；季夏土旺金相火休木囚水死；秋金旺水相土休火囚木死；冬水旺木相金休土囚火死。《增删卜易》“四时旺相章”只明列旺、相、余气并将其余合称休囚，本项目不会把《三命通会》的五级表误称为《增删卜易》原表。
- 爻位“初＝足／基层、二＝腹／家宅、三＝股／门户、四＝胸／门外、五＝君位、上＝首／宗庙”按本轮产品需求作为辅助象征展示，不标称为《增删卜易》的确定规则，也不据此自动输出吉凶。
- 项目现有《周易》语料含卦辞与爻辞，因此五卦均展示卦辞；不含彖辞和大象辞，本轮宁缺毋滥，未从未经校验的新语料拼接。应期、日月合、十二长生与完整吉凶综合也未实现，避免未选择流派时混写。

## 马善政毛笔楷书字体（Ma Shan Zheng）与品牌印

- 品牌名、印章与标题所用毛笔字为 [Ma Shan Zheng Regular](https://github.com/google/fonts/tree/main/ofl/mashanzheng)，采用 SIL Open Font License 1.1，许可证全文见 `web/fonts/OFL.txt`；网页只发布按用字裁剪的子集 `web/fonts/mashanzheng-subset.woff2`（由 `scripts/subset-sanyi-font.py` 生成）。
- 品牌印（`web/brand/yarrow-mark.svg`、`web/favicon.svg`、`web/favicon.ico`、`web/apple-touch-icon.png`）中的「易」取自该字体的字形轮廓（`scripts/brand-glyph-yi.json`），作为图形使用，不随图标分发字体文件；图标由 `npm run brand:icons` 重新生成。
