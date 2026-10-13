// scripts/build-brand-icons.ts
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import glyph from "./brand-glyph-yi.json" with { type: "json" };

/** 印底与字色，与 web/styles/tokens.css 的 --seal-bg、--seal-text 一致。 */
const SEAL = "#A63A2B";
const INK = "#F6EFE2";

export type BrandVariant = "mark" | "favicon" | "touch";

/**
 * 各用途的印面参数（64×64 画布，描边宽度按字体单位计）：
 * - mark：顶栏与大图，保留毛笔笔触；
 * - favicon：16/32 像素标签页，字形加大加粗，免得糊成一团；
 * - touch：iOS 主屏，满版直角，圆角由系统裁切，字形略收以留出安全边距。
 */
const VARIANTS: Readonly<Record<BrandVariant, { radius: number; glyphHeight: number; stroke: number }>> = {
  mark: { radius: 6, glyphHeight: 50, stroke: 22 },
  favicon: { radius: 5, glyphHeight: 52, stroke: 36 },
  touch: { radius: 0, glyphHeight: 44, stroke: 22 },
};

/** 生成品牌印 SVG：朱底方印，中间是 Ma Shan Zheng 的「易」。 */
export function brandSvg(variant: BrandVariant): string {
  const { radius, glyphHeight, stroke } = VARIANTS[variant];
  const [x0, y0, x1, y1] = glyph.bounds as [number, number, number, number];
  const scale = Math.round(glyphHeight / (y1 - y0) * 1e5) / 1e5;
  const corner = radius ? ` rx="${radius}"` : "";
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">`,
    "<!-- 三易 Yarrow 品牌印：朱印「易」，字形取自 Ma Shan Zheng（SIL OFL 1.1）；"
      + "由 scripts/build-brand-icons.ts 生成，勿手改 -->",
    `<rect width="64" height="64"${corner} fill="${SEAL}"/>`,
    `<path fill="${INK}" stroke="${INK}" stroke-width="${stroke}" stroke-linejoin="round"`
      + ` transform="translate(32 32) scale(${scale} ${-scale}) translate(${-(x0 + x1) / 2} ${-(y0 + y1) / 2})"`
      + ` d="${glyph.d}"/>`,
    "</svg>",
    "",
  ].join("\n");
}

/** 把 PNG 帧装进 ICO（Windows Vista 起支持 PNG 帧）；目录只能记到 256 像素。 */
export function encodeIco(frames: readonly Buffer[]): Buffer {
  const header = Buffer.alloc(6 + frames.length * 16);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(frames.length, 4);
  let offset = header.length;
  frames.forEach((png, index) => {
    const width = png.readUInt32BE(16);
    const height = png.readUInt32BE(20);
    if (width > 256 || height > 256) {
      throw new Error(`ICO 帧不能超过 256 像素：${width}×${height}`);
    }
    const entry = 6 + index * 16;
    // 256 在目录里记作 0；调色板数与保留字节保持 0。
    header.writeUInt8(width % 256, entry);
    header.writeUInt8(height % 256, entry + 1);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });
  return Buffer.concat([header, ...frames]);
}

const CHROME = process.env.CHROME_PATH
  ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

/** 在无头 Chrome 里把 SVG 画到画布再导出 PNG：栅格结果与浏览器显示一致。 */
async function rasterize(jobs: ReadonlyArray<{ svg: string; size: number }>): Promise<Buffer[]> {
  const port = 9400 + Math.floor(Math.random() * 400);
  const profile = await mkdtemp(join(tmpdir(), "brand-icons-"));
  const chrome = spawn(CHROME, [
    "--headless=new", "--disable-gpu", `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`, "about:blank",
  ], { stdio: "ignore" });
  try {
    let socketUrl: string | undefined;
    for (let attempt = 0; attempt < 50 && !socketUrl; attempt += 1) {
      try {
        const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json() as
          Array<{ type: string; webSocketDebuggerUrl: string }>;
        socketUrl = targets.find((target) => target.type === "page")?.webSocketDebuggerUrl;
      } catch {
        // Chrome 尚未就绪，稍候重试。
      }
      if (!socketUrl) await sleep(200);
    }
    if (!socketUrl) throw new Error(`无法连接 Chrome 调试端口；可用 CHROME_PATH 指定路径（当前 ${CHROME}）`);
    const socket = new WebSocket(socketUrl);
    await new Promise((done, fail) => {
      socket.addEventListener("open", done);
      socket.addEventListener("error", fail);
    });
    const sized = jobs.map(({ svg, size }) => ({
      size,
      // 写明宽高，免得无固有尺寸的 SVG 按默认 300×150 栅格后再缩放。
      svg: svg.replace("<svg ", `<svg width="${size}" height="${size}" `),
    }));
    const expression = `Promise.all(${JSON.stringify(sized)}.map(({ svg, size }) => new Promise((done, fail) => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        canvas.getContext("2d").drawImage(image, 0, 0, size, size);
        done(canvas.toDataURL("image/png").split(",")[1]);
      };
      image.onerror = () => fail(new Error("SVG 载入失败"));
      image.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    })))`;
    const reply = await new Promise<{ result?: { result?: { value?: string[] } }; error?: unknown }>(
      (done) => {
        socket.addEventListener("message", (event) => done(JSON.parse(String(event.data))));
        socket.send(JSON.stringify({
          id: 1, method: "Runtime.evaluate",
          params: { expression, awaitPromise: true, returnByValue: true },
        }));
      },
    );
    const values = reply.result?.result?.value;
    if (!values || values.length !== jobs.length) {
      throw new Error(`栅格化失败：${JSON.stringify(reply.error ?? reply.result)}`);
    }
    socket.close();
    return values.map((value) => Buffer.from(value, "base64"));
  } finally {
    // 等 Chrome 真正退出再删临时配置目录，否则它还在写文件，删除会报目录非空。
    const exited = chrome.exitCode !== null
      || new Promise((done) => chrome.once("exit", done));
    chrome.kill();
    await exited;
    await rm(profile, { recursive: true, force: true, maxRetries: 3 });
  }
}

/** 生成全部品牌图标：两份 SVG、三档 ICO 与 iOS 主屏图标。 */
export async function buildBrandIcons(
  webDir = resolve(dirname(fileURLToPath(import.meta.url)), "..", "web"),
): Promise<void> {
  await mkdir(resolve(webDir, "brand"), { recursive: true });
  await writeFile(resolve(webDir, "brand/yarrow-mark.svg"), brandSvg("mark"), "utf8");
  await writeFile(resolve(webDir, "favicon.svg"), brandSvg("favicon"), "utf8");
  const favicon = brandSvg("favicon");
  const [x16, x32, x48, touch] = await rasterize([
    { svg: favicon, size: 16 },
    { svg: favicon, size: 32 },
    { svg: favicon, size: 48 },
    { svg: brandSvg("touch"), size: 180 },
  ]);
  await writeFile(resolve(webDir, "favicon.ico"), encodeIco([x16!, x32!, x48!]));
  await writeFile(resolve(webDir, "apple-touch-icon.png"), touch!);
  console.log("已生成品牌图标：brand/yarrow-mark.svg、favicon.svg、favicon.ico、apple-touch-icon.png");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await buildBrandIcons();
}
