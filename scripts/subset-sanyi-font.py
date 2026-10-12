# scripts/subset-sanyi-font.py
from hashlib import sha256
from pathlib import Path
from subprocess import run
from urllib.request import urlopen

from fontTools.ttLib import TTFont

FONT_URL = (
    "https://raw.githubusercontent.com/google/fonts/main/ofl/mashanzheng/"
    "MaShanZheng-Regular.ttf"
)
LICENSE_URL = "https://raw.githubusercontent.com/google/fonts/main/ofl/mashanzheng/OFL.txt"
EXPECTED_SHA256 = "6d2546bb189c732a8ca29af9e22457b152387d158aa459e4ac2ce1e51788b7fb"
EXPECTED_SIZE = 5_857_936
# 「·」「→」是界面标点，毛笔字体不含，浏览器回落到后续字体即可。
KNOWN_MISSING = {"夬", "姤", "螣", "·", "→"}
ROOT = Path(__file__).resolve().parents[1]
FONT_DIR = ROOT / "web" / "fonts"


def download(url: str) -> bytes:
    with urlopen(url, timeout=30) as response:
        return response.read()


def main() -> None:
    FONT_DIR.mkdir(parents=True, exist_ok=True)
    source = download(FONT_URL)
    if len(source) != EXPECTED_SIZE:
        raise RuntimeError(f"字体大小不匹配：{len(source)}")
    digest = sha256(source).hexdigest()
    if digest != EXPECTED_SHA256:
        raise RuntimeError(f"字体摘要不匹配：{digest}")
    source_path = FONT_DIR / "MaShanZheng-Regular.ttf"
    source_path.write_bytes(source)
    charset = set((FONT_DIR / "mashanzheng-chars.txt").read_text(encoding="utf-8").strip())
    cmap = TTFont(source_path).getBestCmap() or {}
    missing = {character for character in charset if ord(character) not in cmap}
    print("字体缺字：" + ("、".join(sorted(missing)) if missing else "无"))
    unexpected = missing - KNOWN_MISSING
    if unexpected:
        raise RuntimeError("字体存在未登记缺字：" + "、".join(sorted(unexpected)))
    (FONT_DIR / "OFL.txt").write_bytes(download(LICENSE_URL))
    run([
        str(ROOT / ".venv-tools" / "bin" / "pyftsubset"),
        str(source_path),
        f"--text-file={FONT_DIR / 'mashanzheng-chars.txt'}",
        "--flavor=woff2",
        f"--output-file={FONT_DIR / 'mashanzheng-subset.woff2'}",
        "--layout-features=*",
    ], check=True)
    source_path.unlink()
    if (FONT_DIR / "mashanzheng-subset.woff2").stat().st_size >= 100_000:
        raise RuntimeError("字体子集必须小于 100 KB")


if __name__ == "__main__":
    main()
