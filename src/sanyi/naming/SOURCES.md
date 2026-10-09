# 起名数据来源

## 字库

- **Unihan Database**：Unicode 18.0.0，原始文件头日期为 2026-07-31。使用
  `kTGH`、`kMandarin`、`kTraditionalVariant`、`kRSUnicode` 与 `kTotalStrokes`。
  数据遵循 [Unicode License v3](https://www.unicode.org/license.txt)。
- **新华字典数据**：`pwxcoo/chinese-xinhua` 的 `data/word.json`，用于简短释义，遵循 MIT
  许可证。

字的五行按固定规则生成：先按繁体字的康熙部首判定；未命中木、火、土、金、水指定部首时，
再按普通话声母的五音判定。此规则用于提供一致、可核验的结果，不代表各家字义五行的唯一说法。

## 诗文语料

- **chinese-poetry**：`chinese-poetry/chinese-poetry`，取《诗经》《楚辞》《论语》、唐诗三百首、
  宋词三百首，遵循 MIT 许可证。唐诗原文在构建时由 OpenCC 转为简体。
- **《周易》与《大象传》**：复用项目已有、已记录来源的
  `src/agent/zhouyi-corpus.json` 与 `src/agent/daxiang-corpus.json`。

原始下载文件仅用于离线构建，不随产物发布。

## 构建命令

```bash
.venv-tools/bin/python tools/naming/build_lexicon.py
.venv-tools/bin/python tools/naming/build_classics.py
```
