#!/usr/bin/env python3
"""由 Unihan 与新华字典原始数据构建起名字库。"""

from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = ROOT / "tools" / "naming" / "raw"
OUTPUT = ROOT / "src" / "sanyi" / "naming" / "lexicon.json"
BLOCKED_PATH = ROOT / "tools" / "naming" / "blocked.txt"

FIELDS = [
    "pinyin", "tone", "initial", "final", "trad", "kangxi", "strokes",
    "level", "wuxing", "wuxingBasis", "meaning", "blocked", "readings", "polyphonic",
]
INITIALS = ("zh", "ch", "sh", "b", "p", "m", "f", "d", "t", "n", "l",
            "g", "k", "h", "j", "q", "x", "r", "z", "c", "s", "y", "w")
TONE_MARKS = {
    **{char: ("a", tone) for tone, char in enumerate("āáǎà", 1)},
    **{char: ("e", tone) for tone, char in enumerate("ēéěè", 1)},
    **{char: ("i", tone) for tone, char in enumerate("īíǐì", 1)},
    **{char: ("o", tone) for tone, char in enumerate("ōóǒò", 1)},
    **{char: ("u", tone) for tone, char in enumerate("ūúǔù", 1)},
    **{char: ("ü", tone) for tone, char in enumerate("ǖǘǚǜ", 1)},
    "ń": ("n", 2), "ň": ("n", 3), "ǹ": ("n", 4), "ḿ": ("m", 2),
}
RADICAL_ELEMENTS = {
    75: "木", 140: "木", 118: "木", 115: "木",
    86: "火", 72: "火",
    32: "土", 46: "土", 112: "土", 102: "土",
    167: "金", 96: "金",
    85: "水", 15: "水", 173: "水",
}
INITIAL_ELEMENTS = {
    "b": ("水", "唇音"), "p": ("水", "唇音"), "m": ("水", "唇音"),
    "f": ("水", "唇音"),
    "d": ("火", "舌音"), "t": ("火", "舌音"), "n": ("火", "舌音"),
    "l": ("火", "舌音"),
    "z": ("金", "齿音"), "c": ("金", "齿音"), "s": ("金", "齿音"),
    "zh": ("金", "齿音"), "ch": ("金", "齿音"), "sh": ("金", "齿音"),
    "r": ("金", "齿音"),
    "j": ("木", "牙音"), "q": ("木", "牙音"), "x": ("木", "牙音"),
}


def read_unihan_field(filename: str, field: str) -> dict[str, str]:
    """读取一个 Unihan 字段，以字符为键。"""
    values: dict[str, str] = {}
    with (RAW_DIR / filename).open(encoding="utf-8") as source:
        for raw_line in source:
            if raw_line.startswith("#"):
                continue
            parts = raw_line.rstrip("\n").split("\t")
            if len(parts) == 3 and parts[1] == field:
                values[chr(int(parts[0][2:], 16))] = parts[2]
    return values


def first_variant(value: str) -> str:
    """取变体字段中的第一个 Unicode 码位。"""
    match = re.match(r"U\+([0-9A-F]+)", value)
    if not match:
        raise ValueError(f"无法解析繁体变体：{value}")
    return chr(int(match.group(1), 16))


def parse_pinyin(pinyin: str) -> tuple[int, str, str]:
    """从带调拼音中拆出声调、声母和韵母。"""
    first = pinyin.split()[0].lower()
    tone = 5
    plain_chars: list[str] = []
    for char in first:
        marked = TONE_MARKS.get(char)
        if marked:
            base, tone = marked
            plain_chars.append(base)
        else:
            plain_chars.append(char)
    plain = "".join(plain_chars)
    initial = next((item for item in INITIALS if plain.startswith(item)), "")
    return tone, initial, plain[len(initial):]


def untoned_pinyin(value: str) -> str:
    """移除拼音声调并规范字典数据中的拉丁字母 g。"""
    return "".join(TONE_MARKS.get(char, (char, 5))[0] for char in value.lower()).replace("ɡ", "g")


def unique_readings(values: list[str]) -> list[str]:
    """过滤拼音，按去调音节去重并保留首个带调形式。"""
    output: list[str] = []
    seen: set[str] = set()
    for value in values:
        reading = value.strip().lower().replace("ɡ", "g")
        syllable = untoned_pinyin(reading)
        if re.fullmatch(r"[a-zü]+", syllable) and syllable not in seen:
            seen.add(syllable)
            output.append(reading)
    return output


def parse_unihan_readings(value: str) -> list[str]:
    """按字段顺序读取 kTGHZ2013、kXHC1983 或 kMandarin 拼音。"""
    readings: list[str] = []
    for group in re.findall(r":([^\s]+)", value):
        readings.extend(group.split(","))
    if not readings:
        readings.extend(re.split(r"[\s,]+", value))
    return unique_readings(readings)


def parse_rs(value: str) -> tuple[int, int]:
    """解析 kRSUnicode 的第一组部首号与余画。"""
    match = re.match(r"(\d+)'?\.(-?\d+)", value.split()[0])
    if not match:
        raise ValueError(f"无法解析 kRSUnicode：{value}")
    return int(match.group(1)), int(match.group(2))


def radical_chars() -> dict[int, str]:
    """用康熙部首兼容字符的 Unicode 分解取得 214 个部首本字。"""
    return {
        number: unicodedata.normalize("NFKC", chr(0x2EFF + number))
        for number in range(1, 215)
    }


# 释义不取负面、刑罚与情色义项；名字卡以模型逐字字义为主，字典释义仅兜底。
NEGATIVE_MEANING_CHARS = set("悲哀愁死病丧凶恶忧怨恨苦痛灾祸欲刑淫奸罪杀")
BOPOMOFO_RE = re.compile(r"[\u3105-\u3129]")
PINYIN_LINE_RE = re.compile(r"[A-Za-z\u00c0-\u024f\u1e00-\u1eff－]")
HAN_LINE_RE = re.compile(r"[\u3400-\u9fff]{2,}")
SENSE_RE = re.compile(r"^\((\d+)\)\s*(.*)$")


def normalize_meaning(value: str) -> str:
    """统一释义的空白与中英文标点。"""
    return (
        re.sub(r"\s+", "", value)
        .replace(";", "；")
        .replace(",", "，")
        .strip("，；、。 ")
    )


def fit_meaning(value: str) -> str:
    """把单个义项收敛到 24 字；无安全断点时放弃。"""
    value = normalize_meaning(value)
    if len(value) <= 24:
        return value
    prefix = value[:24]
    cut = prefix.rfind("，")
    return prefix[:cut].rstrip("，；、") if cut > 0 else ""


def join_meanings(values: list[str]) -> str:
    """连接前两个义项，整体超长时只在标点处截断。"""
    value = "；".join(values[:2])
    if len(value) <= 24:
        return value
    prefix = value[:24]
    cut = max(prefix.rfind(mark) for mark in "；，")
    if cut > 0:
        return prefix[:cut].rstrip("，；、")
    # 第一义本身合规时，只舍弃放不下的第二义，不截断第一义。
    return values[0] if values and len(values[0]) <= 24 else ""


def closing_parenthesis(value: str) -> int | None:
    """返回开头半角括号的配对位置，允许字源说明内嵌括号。"""
    if not value.startswith("("):
        return None
    depth = 0
    for index, char in enumerate(value):
        if char == "(":
            depth += 1
        elif char == ")":
            depth -= 1
            if depth == 0:
                return index
    return None


def primary_more_section(char: str, lines: list[str]) -> list[str]:
    """截取本字义项区，在复合词词条或注音符号行前停止。"""
    for index, line in enumerate(lines):
        if BOPOMOFO_RE.search(line):
            return lines[:index]
        if (
            line.startswith(char)
            and HAN_LINE_RE.fullmatch(line)
            and index + 1 < len(lines)
            and PINYIN_LINE_RE.search(lines[index + 1])
        ):
            return lines[:index]
    return lines


def usable_meaning(char: str, value: str) -> str:
    """清理并校验一个本字义项。"""
    value = fit_meaning(value)
    if (
        not value
        or value in {"姓", "[名]∶姓"}
        or value.startswith(("又如", "如"))
        or "--" in value
        or "《" in value
        or any(marker in value for marker in NEGATIVE_MEANING_CHARS)
        or not re.search(r"[\u3400-\u9fff]", value)
    ):
        return ""
    return value


def parse_sense_line(char: str, raw: str) -> list[str]:
    """解析一个编号义项的首行，字源本义与正文最多各贡献一项。"""
    if "--" in raw or "《" in raw or raw.startswith(("又如", "如")):
        return []

    origin = ""
    rest = raw
    close = closing_parenthesis(raw)
    if close is not None:
        parenthetical = raw[1:close]
        if any(marker in parenthetical for marker in ("形声", "会意", "象形", "指事")):
            match = re.search(r"本义\s*[:：]?\s*([^。]+)", parenthetical)
            if match:
                origin = usable_meaning(char, match.group(1))
                if origin.endswith(char):
                    origin = ""
            rest = raw[close + 1:].strip()

    values: list[str] = []
    if rest.startswith("同本义"):
        if origin:
            values.append(origin)
    elif " [" in rest:
        candidate = usable_meaning(char, rest.split(" [", 1)[0])
        if candidate:
            values.append(candidate)

    # 同一行有正文时，正文比字源说明更适合作为简短现代释义。
    if origin and origin not in values:
        values.append(origin)
    return values


def extract_fallback_meaning(char: str, lines: list[str]) -> str:
    """从注音符号行后的现代释义取首条回退释义。"""
    start = next((i + 1 for i, line in enumerate(lines) if BOPOMOFO_RE.search(line)), None)
    if start is None:
        return ""
    for raw in lines[start:]:
        marker = SENSE_RE.match(raw)
        value = marker.group(2) if marker else raw
        if not value or (marker and not value) or value.startswith(("郑码", "笔画数")):
            continue
        if not re.search(r"[\u3400-\u9fff]", value):
            continue
        boundary = re.search(r"[～。]", value)
        if boundary:
            has_placeholder = boundary.group(0) == "～"
            value = value[:boundary.start()]
            if has_placeholder:
                # 占位符通常与前一字组成词；无法判断时按组成词处理。
                value = re.sub(r"[\u3400-\u9fff](?=[^\u3400-\u9fff]*$)", "", value)
        value = usable_meaning(char, value)
        if len(value) >= 2:
            return value
    return ""


def extract_more_meaning(char: str, more: str) -> str:
    """只从本字义项区提取前两个合格义项。"""
    lines = [line.strip() for line in more.splitlines() if line.strip()]
    section = primary_more_section(char, lines)
    meanings: list[str] = []
    for index, line in enumerate(section):
        marker = SENSE_RE.match(line)
        if not marker:
            continue
        raw = marker.group(2).strip()
        if not raw and index + 1 < len(section):
            raw = section[index + 1]
        for candidate in parse_sense_line(char, raw):
            if candidate not in meanings:
                meanings.append(candidate)
            if len(meanings) == 2 or "；" in candidate:
                return join_meanings(meanings)
    # 少数单义条目没有编号；仍只读取其首个带英文注释的释义行。
    if not meanings and not any(SENSE_RE.match(line) for line in section):
        for line in section:
            meanings.extend(parse_sense_line(char, line))
            if meanings:
                break
    return join_meanings(meanings) or extract_fallback_meaning(char, lines)


def extract_meaning(char: str, explanation: str, more: str) -> str:
    """提取现代短义；more 缺失有效区块时兼容编号短义。"""
    from_more = extract_more_meaning(char, more)
    if from_more:
        return from_more
    # 原始数据有一批 more 仅含“搜索成语”占位页，只能从短义字段补齐。
    numbered = re.search(r"(?:⒈|(?:^|\s)1[.．])\s*([^。\n]+)", explanation)
    if not numbered or "～" in numbered.group(1):
        return ""
    return usable_meaning(char, numbered.group(1))


def read_meanings() -> dict[str, str]:
    """按字索引新华字典释义；重复条目保留第一个可用释义。"""
    rows = json.loads((RAW_DIR / "xinhua-word.json").read_text(encoding="utf-8"))
    meanings: dict[str, str] = {}
    for row in rows:
        char = row.get("word")
        if not isinstance(char, str) or len(char) != 1 or char in meanings:
            continue
        explanation = row.get("explanation", "")
        more = row.get("more", "")
        if isinstance(explanation, str) and isinstance(more, str):
            meaning = extract_meaning(char, explanation, more)
            if meaning:
                meanings[char] = meaning
    return meanings


def read_blocked() -> set[str]:
    """读取每行一字的不宜入名字表。"""
    blocked: set[str] = set()
    for raw_line in BLOCKED_PATH.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if len(line) != 1:
            raise ValueError(f"不宜入名字表必须每行一字：{line}")
        blocked.add(line)
    return blocked


def wuxing(radical: int, initial: str, radicals: dict[int, str]) -> tuple[str, str]:
    """按部首优先、读音其次判定五行。"""
    element = RADICAL_ELEMENTS.get(radical)
    if element:
        return element, f"部首·{radicals[radical]}"
    fallback = INITIAL_ELEMENTS.get(initial, ("土", "喉音"))
    return fallback[0], f"读音·{fallback[1]}"


def build() -> dict[str, list[object] | list[str]]:
    """构建并校验完整字库。"""
    tgh = read_unihan_field("Unihan_OtherMappings.txt", "kTGH")
    readings = read_unihan_field("Unihan_Readings.txt", "kMandarin")
    tghz_readings = read_unihan_field("Unihan_Readings.txt", "kTGHZ2013")
    xhc_readings = read_unihan_field("Unihan_Readings.txt", "kXHC1983")
    variants = read_unihan_field("Unihan_Variants.txt", "kTraditionalVariant")
    rs_values = read_unihan_field("Unihan_IRGSources.txt", "kRSUnicode")
    stroke_values = read_unihan_field("Unihan_IRGSources.txt", "kTotalStrokes")
    meanings = read_meanings()
    blocked = read_blocked()
    radicals = radical_chars()
    radical_strokes = {
        number: int(stroke_values[char].split()[0]) for number, char in radicals.items()
    }

    numbered = sorted(
        ((int(value.split(":", 1)[1]), char) for char, value in tgh.items()
         if value.startswith("2013:")),
    )
    if len(numbered) != 8105 or [number for number, _ in numbered] != list(range(1, 8106)):
        raise ValueError("Unihan kTGH 未完整覆盖 2013 年通用规范汉字表 1–8105")

    output: dict[str, list[object] | list[str]] = {"_fields": FIELDS}
    for number, char in numbered:
        pinyin = readings[char].split()[0]
        tone, initial, final = parse_pinyin(pinyin)
        trad = first_variant(variants[char]) if char in variants else char
        radical, residual = parse_rs(rs_values[trad])
        kangxi = radical_strokes[radical] + residual
        simple_strokes = int(stroke_values[char].split()[0])
        level = 1 if number <= 3500 else 2 if number <= 6500 else 3
        element, basis = wuxing(radical, initial, radicals)
        all_readings = parse_unihan_readings(
            tghz_readings.get(char, xhc_readings.get(char, readings[char]))
        )
        output[char] = [
            pinyin, tone, initial, final, trad, kangxi, simple_strokes, level,
            element, basis, meanings.get(char, ""), int(char in blocked),
            all_readings, len(all_readings) > 1,
        ]
    return output


def main() -> None:
    """写出可重复构建的紧凑 JSON。"""
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    output = build()
    serialized = json.dumps(output, ensure_ascii=False, separators=(",", ":")) + "\n"
    OUTPUT.write_text(serialized, encoding="utf-8")
    print(f"已写入 {OUTPUT.relative_to(ROOT)}：{len(output) - 1} 字")


if __name__ == "__main__":
    main()
