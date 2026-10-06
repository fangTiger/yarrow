"""以 sxtwl 独立生成可复算的八字四柱标准答案。"""
import argparse
import importlib.metadata
import json
from datetime import datetime, timedelta
from pathlib import Path

import sxtwl

STEMS = "甲乙丙丁戊己庚辛壬癸"
BRANCHES = "子丑寅卯辰巳午未申酉戌亥"
DST = [
    (1986, 5, 4, 9, 14), (1987, 4, 12, 9, 13), (1988, 4, 17, 9, 11),
    (1989, 4, 16, 9, 17), (1990, 4, 15, 9, 16), (1991, 4, 14, 9, 15),
]


def day_at(value):
    return sxtwl.fromSolar(value.year, value.month, value.day)


def gan_zhi(value):
    return STEMS[value.tg] + BRANCHES[value.dz]


def civil(value):
    return dict(year=value.year, month=value.month, day=value.day,
                hour=value.hour, minute=value.minute, second=value.second)


def term_at(day):
    value = sxtwl.JD2DD(day.getJieQiJD())
    # 保留秒精度，前后各一小时的采样不受舍入秒影响。
    midnight = datetime(int(value.Y), int(value.M), int(value.D))
    return midnight + timedelta(hours=value.h, minutes=value.m, seconds=value.s)


def corrected_clock(clock):
    for year, sm, sd, em, ed in DST:
        if clock.year == year:
            start = datetime(year, sm, sd, 2)
            end = datetime(year, em, ed, 2)
            if start <= clock < end:
                return clock - timedelta(hours=1), -60
    return clock, 0


def probe_rules():
    """用库现场结果证明零点日界、晚子时参数和日期型交节。"""
    base = datetime(1990, 5, 15)
    day = day_at(base)
    following = day_at(base + timedelta(days=1))
    assert gan_zhi(day.getDayGZ()) != gan_zhi(following.getDayGZ())
    assert gan_zhi(day.getHourGZ(23, True)) == gan_zhi(following.getHourGZ(0, True))
    assert gan_zhi(day.getHourGZ(23, False)) == gan_zhi(day.getHourGZ(0, False))
    count = 0
    cursor = datetime(2026, 1, 1)
    while cursor.year == 2026:
        current = day_at(cursor)
        if current.hasJieQi() and current.getJieQi() % 2 == 1:
            previous = day_at(cursor - timedelta(days=1))
            assert gan_zhi(current.getMonthGZ()) != gan_zhi(previous.getMonthGZ())
            if current.getJieQi() == 3:
                assert gan_zhi(current.getYearGZ()) != gan_zhi(previous.getYearGZ())
            count += 1
        cursor += timedelta(days=1)
    assert count == 12
    return {
        "package": "sxtwl==2.0.6",
        "yearMonthRule": "原生按交节日切换；依 sxtwl 交节时刻在交节前取前一日年/月柱",
        "dayRule": "getDayGZ 按零点；sect 1 的 23 点取下一日，sect 2 取当日",
        "timeRule": "getHourGZ(hour, True) 按晚子时次日干起时；lunar 两种 sect 时柱同此口径",
    }


def expected_at(value, sect):
    day = day_at(value)
    month_day = day
    if day.hasJieQi() and day.getJieQi() % 2 == 1 and value < term_at(day):
        month_day = day_at(value - timedelta(days=1))
    civil_day = day_at(value + timedelta(days=1)) if sect == 1 and value.hour == 23 else day
    return {
        "year": gan_zhi(month_day.getYearGZ()),
        "month": gan_zhi(month_day.getMonthGZ()),
        "day": gan_zhi(civil_day.getDayGZ()),
        "time": gan_zhi(day.getHourGZ(value.hour, True)),
    }


def cases():
    result = []
    cursor = datetime(2026, 1, 1)
    while cursor.year == 2026:
        day = day_at(cursor)
        if day.hasJieQi() and day.getJieQi() % 2 == 1:
            term = term_at(day).replace(microsecond=0)
            for suffix, offset in [("before", -1), ("after", 1)]:
                result.append((f"term:{day.getJieQi()}:{suffix}", term + timedelta(hours=offset)))
        cursor += timedelta(days=1)
    for year, sm, sd, em, ed in DST:
        start = datetime(year, sm, sd, 2)
        end = datetime(year, em, ed, 2)
        for suffix, clock in [
            ("before", start - timedelta(minutes=1)), ("start", start),
            ("repeat", end - timedelta(minutes=30)), ("after", end),
        ]:
            result.append((f"dst:{year}:{suffix}", clock))
    for hour, minute in [(23, 0), (23, 30), (0, 0), (0, 30)]:
        result.append((f"child:{hour:02d}:{minute:02d}", datetime(2000, 11, 3, hour, minute)))
    cursor = datetime(2023, 1, 1)
    while cursor.year == 2023 and not day_at(cursor).isLunarLeap():
        cursor += timedelta(days=1)
    assert cursor.year == 2023
    result.append(("leap", cursor.replace(hour=12)))
    result.append(("edge:1900", datetime(1900, 1, 1, 0, 30)))
    result.append(("edge:2099", datetime(2099, 12, 31, 23, 30)))
    return result


def main():
    parser = argparse.ArgumentParser(description="生成 sxtwl 双源八字基准")
    parser.add_argument("--output", type=Path, default=Path("tests/fixtures/bazi"))
    args = parser.parse_args()
    assert importlib.metadata.version("sxtwl") == "2.0.6", "必须使用已核验版本"
    source = probe_rules()
    samples = cases()
    assert len(samples) >= 40
    args.output.mkdir(parents=True, exist_ok=True)
    for tag, clock in samples:
        effective, dst_minutes = corrected_clock(clock)
        day = day_at(effective)
        identity = tag.replace(":", "-")
        leap_day = day_at(clock)
        lunar = None
        if tag == "leap":
            lunar = dict(year=leap_day.getLunarYear(), month=leap_day.getLunarMonth(),
                         day=leap_day.getLunarDay(), leap=leap_day.isLunarLeap())
        fixture = {
            "id": identity, "tag": tag, "clock": civil(clock), "effective": civil(effective),
            "dstMinutes": dst_minutes, "lunar": lunar, "source": source,
            "native": {
                "year": gan_zhi(day.getYearGZ()), "month": gan_zhi(day.getMonthGZ()),
                "day": gan_zhi(day.getDayGZ()), "time": gan_zhi(day.getHourGZ(effective.hour, True)),
            },
            "compareFields": ["year", "month", "day", "time"],
            "expected": {"1": expected_at(effective, 1), "2": expected_at(effective, 2)},
        }
        path = args.output / f"{identity}.json"
        path.write_text(json.dumps(fixture, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"已生成 {len(samples)} 个时刻，每个含两种换日口径和四柱标准答案")


if __name__ == "__main__":
    main()
