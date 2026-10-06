// tests/frontend-bazi-font.test.ts
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";
test("重建字体符合现场锁定摘要且没有新增缺字", async () => {
  const expected = (await readFile("web/fonts/mashanzheng-subset.sha256", "utf8")).trim();
  assert.match(expected, /^[a-f0-9]{64}$/);
  const bytes = await readFile("web/fonts/mashanzheng-subset.woff2");
  assert.equal(createHash("sha256").update(bytes).digest("hex"), expected);
  assert.ok(bytes.length < 100_000);
  const { stdout } = await promisify(execFile)(".venv-tools/bin/python", ["-c", [
    "import json",
    "from pathlib import Path",
    "from fontTools.ttLib import TTFont",
    "cmap = TTFont('web/fonts/mashanzheng-subset.woff2').getBestCmap() or {}",
    "chars = set(Path('web/fonts/mashanzheng-chars.txt').read_text().strip())",
    "missing = sorted(c for c in chars if ord(c) not in cmap and c not in {'夬', '姤', '螣'})",
    "print(json.dumps(missing))",
  ].join("\n")]);
  assert.deepEqual(JSON.parse(stdout), []);
});
