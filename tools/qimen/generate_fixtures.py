# tools/qimen/generate_fixtures.py
import json
import re
import site
import sys
from datetime import datetime
from pathlib import Path

package_dir = Path(site.getsitepackages()[0]) / "kinqimen"
sys.path.insert(0, str(package_dir))
from kinqimen import Qimen  # type: ignore[import-not-found]  # 工具依赖不进入 TS 运行时

TIMES = [
    "2026-01-05T15:52", "2026-01-05T16:52", "2026-01-20T03:00", "2026-02-04T03:01",
    "2026-02-04T04:31", "2026-02-18T05:00", "2026-03-05T20:00", "2026-03-20T07:00",
    "2026-04-05T09:00", "2026-04-20T11:00", "2026-05-05T13:00", "2026-05-21T15:00",
    "2026-06-05T17:00", "2026-06-21T15:54", "2026-06-21T16:54", "2026-07-07T21:00",
    "2026-07-23T23:00", "2026-08-07T01:00", "2026-08-23T03:00", "2026-09-07T05:00",
    "2026-09-23T07:30", "2026-09-23T08:30", "2026-09-30T20:15", "2026-10-08T13:45",
    "2026-10-08T15:15", "2026-10-23T09:00", "2026-11-07T11:00", "2026-11-22T13:00",
    "2026-12-07T15:00", "2026-12-22T17:00", "2027-01-05T19:00", "2027-01-20T21:00",
    "2027-02-04T23:00", "2027-03-06T00:30", "2027-04-05T02:30", "2027-05-06T04:30",
    "2027-06-06T06:30", "2027-07-07T08:30", "2027-08-08T10:30", "2027-09-08T12:30",
    "2027-10-08T14:30", "2027-11-07T16:30", "2027-12-07T18:30", "2028-01-06T20:30",
    "2028-02-04T22:30", "2028-03-05T01:30", "2028-06-21T12:00", "2028-12-21T12:00",
]

PALACE = {
    "坎": "坎一", "坤": "坤二", "震": "震三",
    "巽": "巽四", "中": "中五", "乾": "乾六",
    "兌": "兑七", "艮": "艮八", "離": "离九",
}
DOOR = {
    "休": "休门", "生": "生门", "傷": "伤门", "杜": "杜门",
    "景": "景门", "死": "死门", "驚": "惊门", "開": "开门",
}
STAR = {
    "蓬": "天蓬", "任": "天任", "沖": "天冲",
    "輔": "天辅", "英": "天英", "芮": "天芮",
    "柱": "天柱", "心": "天心", "禽": "天芮",
}
GOD = {
    "符": "值符", "蛇": "腾蛇", "陰": "太阴", "合": "六合",
    "勾": "勾陈", "雀": "朱雀", "虎": "白虎", "玄": "玄武", "地": "九地", "天": "九天",
}
SOLAR_TERM = {
    "冬至": "冬至", "小寒": "小寒", "大寒": "大寒",
    "立春": "立春", "雨水": "雨水", "驚蟄": "惊蛰",
    "春分": "春分", "清明": "清明", "穀雨": "谷雨",
    "立夏": "立夏", "小滿": "小满", "芒種": "芒种",
    "夏至": "夏至", "小暑": "小暑", "大暑": "大暑",
    "立秋": "立秋", "處暑": "处暑", "白露": "白露",
    "秋分": "秋分", "寒露": "寒露", "霜降": "霜降",
    "立冬": "立冬", "小雪": "小雪", "大雪": "大雪",
}
REQUIRED_KEYS = {
    "干支", "旬空", "排局", "節氣", "值符值使", "天盤",
    "地盤", "門", "星", "神", "馬星",
}
EXPECTED_KEYS = REQUIRED_KEYS | {"排盤方式", "旬首", "局日", "天乙", "長生運"}

def checked(mapping, key, kind):
    if key not in mapping:
        raise ValueError(f"未知{kind}：{key}")
    return mapping[key]

def parse_pillars(text):
    match = re.fullmatch(r"(.{2})年(.{2})月(.{2})日(.{2})時", text)
    if not match:
        raise ValueError(f"无法解析干支：{text}")
    return list(match.groups())

def normalize_board(raw):
    board = {}
    for source_key, target_key, values in (
        ("天盤", "heavenStem", raw["天盤"]),
        ("地盤", "earthStem", raw["地盤"]),
        ("門", "door", raw["門"]),
        ("星", "star", raw["星"]),
        ("神", "god", raw["神"]),
    ):
        for palace, value in values.items():
            target_palace = checked(PALACE, palace, "宫名")
            cell = board.setdefault(target_palace, {})
            table = {"門": DOOR, "星": STAR, "神": GOD}.get(source_key)
            cell[target_key] = checked(table, value, source_key) if table else value
    return board

def normalize(moment, raw):
    missing = REQUIRED_KEYS - raw.keys()
    if missing:
        raise ValueError(f"kinqimen 输出缺少键：{sorted(missing)}")
    unknown = raw.keys() - EXPECTED_KEYS
    if unknown:
        raise ValueError(f"kinqimen 输出出现未知键：{sorted(unknown)}")
    duty = raw["值符值使"]
    void = raw["旬空"]
    horse = raw["馬星"]
    xun_head, chief_stem = duty["值符天干"]
    chief_star, chief_star_palace = duty["值符星宮"]
    chief_door, chief_door_palace = duty["值使門宮"]
    pillars = parse_pillars(raw["干支"])
    normalized_chief_star = (
        "天禽"
        if chief_star == "禽" and raw["地盤"].get("中") == chief_stem
        else checked(STAR, chief_star, "九星简称")
    )
    return {
        "localTime": moment.strftime("%Y-%m-%d %H:%M:00"),
        "method": "时家转盘拆补法",
        "dayPillar": pillars[2],
        "hourPillar": pillars[3],
        "solarTerm": checked(SOLAR_TERM, raw["節氣"], "节气"),
        "layout": raw["排局"].replace("陰", "阴").replace("陽", "阳"),
        "xunHead": xun_head,
        "chiefStem": chief_stem,
        "chiefStar": normalized_chief_star,
        "chiefStarPalace": checked(PALACE, chief_star_palace, "宫名"),
        "chiefDoor": checked(DOOR, chief_door, "八门简称"),
        "chiefDoorPalace": checked(PALACE, chief_door_palace, "宫名"),
        "dayVoid": void["日空"],
        "hourVoid": void["時空"],
        "horse": horse["驛馬"],
        "palaces": normalize_board(raw),
    }

out = Path("tests/fixtures/qimen")
out.mkdir(parents=True, exist_ok=True)
for text in TIMES:
    moment = datetime.fromisoformat(text)
    raw = Qimen(moment.year, moment.month, moment.day, moment.hour, moment.minute).pan(1)
    target = out / f"{moment.strftime('%Y%m%d-%H%M')}.json"
    target.write_text(
        json.dumps(normalize(moment, raw), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
print(f"已生成 {len(TIMES)} 个奇门标准答案")
