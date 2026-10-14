import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

test("每个页面的顶栏都有中英文切换", async () => {
  const pages = (await readdir("web/pages")).filter((name) => name.endsWith(".tsx"));
  for (const name of pages) {
    const source = await readFile(`web/pages/${name}`, "utf8");
    if (source.includes('className="topbar"')) {
      assert.match(source, /<LangToggle \/>/u, `${name} 的顶栏缺少中英文切换`);
    }
  }
  const topbar = await readFile("web/components/ReadingTopbar.tsx", "utf8");
  assert.match(topbar, /<LangToggle \/>/u);
});

test("结果页的各类解读与加载、出错状态都使用带切换的顶栏", async () => {
  const reading = await readFile("web/pages/Reading.tsx", "utf8");
  assert.doesNotMatch(reading, /className="topbar"/u);
  // 问事、八字、起名三类结果，加上加载中与打开失败两种状态。
  assert.equal(reading.match(/<ReadingTopbar \/>/gu)?.length, 5);
});
