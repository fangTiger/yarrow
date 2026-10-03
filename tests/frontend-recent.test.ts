// tests/frontend-recent.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { loadRecentReadings, saveRecentReading } from "../web/lib/recent-readings.js";
class MemoryStorage implements Storage {
  readonly data = new Map<string, string>();
  get length() { return this.data.size; }
  clear() { this.data.clear(); }
  getItem(key: string) { return this.data.get(key) ?? null; }
  key(index: number) { return [...this.data.keys()][index] ?? null; }
  removeItem(key: string) { this.data.delete(key); }
  setItem(key: string, value: string) { this.data.set(key, value); }
}
test("最近记录去重并只保留二十条", () => {
  const storage = new MemoryStorage();
  for (let index = 0; index < 22; index += 1) {
    saveRecentReading({
      id: `id-${index}`,
      kind: "question",
      question: `问题${index}`,
      createdAt: new Date(index * 1_000).toISOString(),
    }, storage);
  }
  saveRecentReading({ id: "id-21", kind: "question", question: "新问题", createdAt: "later" }, storage);
  const values = loadRecentReadings(storage);
  assert.equal(values.length, 20);
  assert.equal(values[0]?.question, "新问题");
  assert.equal(values.filter((item) => item.id === "id-21").length, 1);
});
test("存储读写抛错时返回空且不向外抛", () => {
  const broken = new Proxy({} as Storage, { get() { throw new Error("blocked"); } });
  assert.deepEqual(loadRecentReadings(broken), []);
  assert.doesNotThrow(() => saveRecentReading({
    id: "id", kind: "question", question: "问题", createdAt: "now",
  }, broken));
});
