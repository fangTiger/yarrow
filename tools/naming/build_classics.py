#!/usr/bin/env python3
"""由 chinese-poetry 原始数据构建起名诗文语料。"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Callable

from opencc import OpenCC


ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = ROOT / "tools" / "naming" / "raw"
OUTPUT = ROOT / "src" / "sanyi" / "naming" / "classics.json"
T2S = OpenCC("t2s")
QUOTES = str.maketrans("", "", "“”‘’「」『』")


def split_lines(paragraphs: list[str]) -> list[str]:
    """拼接段落并按句末标点切句，保留句中的逗号。"""
    text = "".join(paragraphs)
    text = re.sub(r"（[^）]*）|\([^)]*\)", "", text)
    text = text.translate(QUOTES)
    text = re.sub(r"\s+", "", text)
    return [part.strip("，、：:,.。！？!?；;") for part in re.split(r"[。！？!?；;]+", text)
            if part.strip("，、：:,.。！？!?；;")]


def normalize_cultural_text(value: str) -> str:
    """把来源中的日文中点统一为中文间隔号。"""
    return value.replace("・", "·").replace("･", "·")


def read_json(name: str) -> list[dict[str, Any]]:
    """读取一个数组形式的 chinese-poetry 文件。"""
    value = json.loads((RAW_DIR / name).read_text(encoding="utf-8"))
    if not isinstance(value, list):
        raise ValueError(f"{name} 顶层必须是数组")
    return value


def add_book(
    output: list[dict[str, Any]],
    book: str,
    filename: str,
    paragraphs_key: str,
    title: Callable[[dict[str, Any]], str],
    convert: bool = False,
) -> None:
    """按源文件顺序加入一部书。"""
    for row in read_json(filename):
        paragraphs = row.get(paragraphs_key, [])
        if not isinstance(paragraphs, list) or not all(isinstance(item, str) for item in paragraphs):
            raise ValueError(f"{filename} 的段落格式不正确")
        item_title = title(row)
        if convert:
            item_title = T2S.convert(item_title)
            paragraphs = [T2S.convert(item) for item in paragraphs]
        item_title = normalize_cultural_text(item_title)
        paragraphs = [normalize_cultural_text(item) for item in paragraphs]
        lines = split_lines(paragraphs)
        if lines:
            output.append({"book": book, "title": item_title, "lines": lines})


def build() -> list[dict[str, Any]]:
    """构建五部经典的篇章数组。"""
    output: list[dict[str, Any]] = []
    add_book(output, "诗经", "shijing.json", "content",
             lambda row: f"{row['section']}·{row['title']}")
    add_book(output, "楚辞", "chuci.json", "content", lambda row: str(row["title"]))
    add_book(output, "论语", "lunyu.json", "paragraphs", lambda row: str(row["chapter"]))
    add_book(output, "唐诗三百首", "唐诗三百首.json", "paragraphs",
             lambda row: f"{row['author']}《{row['title']}》", convert=True)
    add_book(output, "宋词三百首", "宋词三百首.json", "paragraphs",
             lambda row: f"{row.get('author', '')}《{row['rhythmic']}》")
    return output


def main() -> None:
    """写出可重复构建的紧凑 JSON。"""
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    output = build()
    serialized = json.dumps(output, ensure_ascii=False, separators=(",", ":")) + "\n"
    OUTPUT.write_text(serialized, encoding="utf-8")
    print(f"已写入 {OUTPUT.relative_to(ROOT)}：{len(output)} 篇")


if __name__ == "__main__":
    main()
