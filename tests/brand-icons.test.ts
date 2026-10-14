// tests/brand-icons.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { brandSvg, encodeIco } from "../scripts/build-brand-icons.js";
import { TopbarBrand } from "../web/components/TopbarBrand.js";
import { renderIn } from "./helpers/render-in.js";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url));

/** 读 PNG 的 IHDR 宽高；顺带校验文件签名。 */
function pngSize(png: Buffer): { width: number; height: number } {
  assert.deepEqual(png.subarray(0, 8), PNG_SIGNATURE);
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

/** 一个只有签名与 IHDR 的最小 PNG 头，够 ICO 目录测试用。 */
function fakePng(size: number): Buffer {
  const header = Buffer.alloc(24);
  PNG_SIGNATURE.copy(header, 0);
  header.writeUInt32BE(size, 16);
  header.writeUInt32BE(size, 20);
  return header;
}

test("品牌印与 favicon 的 SVG 与生成器逐字一致，且不含脚本或外链", () => {
  for (const [path, variant] of [
    ["web/brand/yarrow-mark.svg", "mark"],
    ["web/favicon.svg", "favicon"],
  ] as const) {
    const text = read(path).toString("utf8");
    assert.equal(text, brandSvg(variant), path);
    assert.match(text, /viewBox="0 0 64 64"/u);
    assert.match(text, /fill="#A63A2B"/u);
    assert.doesNotMatch(text, /<script|href=|\son\w+=/iu);
  }
});

test("小尺寸 favicon 的字形比页头品牌印更粗", () => {
  const strokeOf = (svg: string) => Number(svg.match(/stroke-width="([\d.]+)"/u)?.[1]);
  assert.ok(strokeOf(brandSvg("favicon")) > strokeOf(brandSvg("mark")));
});

test("favicon.ico 依次含 16、32、48 三档 PNG", () => {
  const ico = read("web/favicon.ico");
  assert.equal(ico.readUInt16LE(0), 0);
  assert.equal(ico.readUInt16LE(2), 1);
  assert.equal(ico.readUInt16LE(4), 3);
  const sizes: number[] = [];
  for (let index = 0; index < 3; index += 1) {
    const entry = 6 + index * 16;
    const width = ico.readUInt8(entry);
    assert.equal(ico.readUInt8(entry + 1), width);
    const length = ico.readUInt32LE(entry + 8);
    const offset = ico.readUInt32LE(entry + 12);
    assert.deepEqual(pngSize(ico.subarray(offset, offset + length)), { width, height: width });
    sizes.push(width);
  }
  assert.deepEqual(sizes, [16, 32, 48]);
});

test("encodeIco 写目录项并把各帧首尾相接排在目录之后", () => {
  const frames = [fakePng(16), fakePng(32)];
  const ico = encodeIco(frames);
  assert.equal(ico.length, 6 + 16 * 2 + frames[0]!.length + frames[1]!.length);
  assert.equal(ico.readUInt32LE(6 + 12), 6 + 16 * 2);
  assert.equal(ico.readUInt32LE(6 + 16 + 12), 6 + 16 * 2 + frames[0]!.length);
  assert.equal(ico.readUInt8(6 + 16), 32);
  assert.equal(ico.readUInt16LE(6 + 6), 32, "每像素 32 位");
  assert.throws(() => encodeIco([fakePng(300)]), /256/u);
});

test("apple-touch-icon 为 180×180 的 PNG", () => {
  assert.deepEqual(pngSize(read("web/apple-touch-icon.png")), { width: 180, height: 180 });
});

test("index.html 链接 SVG、ICO 与 iOS 图标，不再用空图标占位", () => {
  const html = read("web/index.html").toString("utf8");
  assert.match(html, /<link rel="icon" href="\/favicon\.ico" sizes="32x32" \/>/u);
  assert.match(html, /<link rel="icon" href="\/favicon\.svg" type="image\/svg\+xml" \/>/u);
  assert.match(html, /<link rel="apple-touch-icon" href="\/apple-touch-icon\.png" \/>/u);
  assert.doesNotMatch(html, /href="data:,"/u);
});

test("顶栏品牌：中英文都是同一枚朱印「易」加品牌名", () => {
  for (const [lang, name] of [["zh", "三易"], ["en", "Yarrow"]] as const) {
    const html = renderIn(lang, createElement(TopbarBrand));
    assert.match(html, /<img[^>]*class="brand-mark"[^>]*src="\/brand\/yarrow-mark\.svg"/u);
    assert.match(html, /<img[^>]*alt=""/u);
    assert.match(html, new RegExp(`<span class="brand">${name}</span>`, "u"));
    assert.doesNotMatch(html, /class="seal"/u);
  }
});

test("各页顶栏都用 TopbarBrand，不再放随页面变化的文字印", () => {
  // 结果页顶栏抽到 ReadingTopbar 组件。
  for (const path of ["web/pages/Home.tsx", "web/pages/SampleReading.tsx", "web/components/ReadingTopbar.tsx"]) {
    const source = read(path).toString("utf8");
    const headers = [...source.matchAll(/<header className="topbar">([\s\S]*?)<\/header>/gu)];
    assert.ok(headers.length > 0, path);
    for (const [, inner] of headers) {
      assert.match(inner!, /<TopbarBrand \/>/u, path);
      assert.doesNotMatch(inner!, /className="seal"|className="brand"/u, path);
    }
  }
});

test("分享预览：Open Graph 与 Twitter 大图卡片，预览图 1200×630", () => {
  const html = read("web/index.html").toString("utf8");
  for (const pattern of [
    /<meta property="og:title" content="[^"]+" \/>/u,
    /<meta property="og:image" content="https:\/\/[^"]+\/brand\/og\.png" \/>/u,
    /<meta property="og:url" content="https:\/\/[^"]+" \/>/u,
    /<meta name="twitter:card" content="summary_large_image" \/>/u,
    /<meta name="twitter:image" content="https:\/\/[^"]+\/brand\/og\.png" \/>/u,
  ]) {
    assert.match(html, pattern);
  }
  assert.deepEqual(pngSize(read("web/brand/og.png")), { width: 1200, height: 630 });
});
