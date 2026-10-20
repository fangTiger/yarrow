"""压缩页面专属预览图：转为 128 色调色板并抖动，渐变不起色带，体积约降到三分之一。

由 npm run og:render 在渲染完成后调用；也可单独运行：python3 scripts/compress-og-images.py
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent / "web" / "brand" / "og"


def main() -> None:
    before = after = 0
    files = sorted(ROOT.rglob("*.png"))
    for path in files:
        before += path.stat().st_size
        image = Image.open(path)
        if image.mode == "P":
            after += path.stat().st_size
            continue  # 已压缩过，跳过
        quantized = image.convert("RGB").quantize(
            colors=128, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG)
        quantized.save(path, optimize=True)
        after += path.stat().st_size
    print(f"已压缩 {len(files)} 张预览图：{before // 1024} KB → {after // 1024} KB")


if __name__ == "__main__":
    main()
