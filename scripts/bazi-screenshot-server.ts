// scripts/bazi-screenshot-server.ts
import { writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import type { StructuredOutputRequest } from "../src/agent/provider.js";
import { MockSchoolsProvider } from "../src/sanyi/mock-provider.js";
import { createFrontendServer } from "../src/frontend/server.js";
import { baziFixture, birth, proof } from "../tests/helpers/bazi-service.js";
// helper 构造 BaziReadingService + ReadingStore + mock 付款，固定北京时间 2026-10-06 21:00。
class ScreenshotProvider extends MockSchoolsProvider {
    failYu = false;
    override async generateStructured<T>(request: StructuredOutputRequest): Promise<T> {
        if (this.failYu && request.taskId === "sanyi/fortune/yuchuntai")
            throw new Error("截图排练：余春台失败");
        return super.generateStructured<T>(request);
    }
}
const provider = new ScreenshotProvider();
const f = await baziFixture(provider);
const entries: {
    name: string;
    id: string;
}[] = [];
for (const [index, name] of ["fortune", "destiny", "missing-time", "failed-yu"].entries()) {
    provider.failYu = name === "failed-yu";
    const value = await f.bazi.create({ kind: name === "destiny" ? "destiny" : "fortune", question: name === "destiny" ? "我适合做什么" : "我今年运势如何", birth: { ...birth, time: name === "missing-time" ? null : birth.time }, sect: 1, horizon: "year", feeProof: proof(index + 1) });
    await f.bazi.whenSettled(value.id);
    const stored = await f.bazi.getReading(value.id);
    if (name === "failed-yu" ? stored.schools.yuchuntai.status !== "failed" : Object.values(stored.schools).some(state => state.status !== "done"))
        throw new Error("截图存档状态不符合预期");
    entries.push({ name, id: value.id });
}
provider.failYu = false;
await mkdir("output/playwright", { recursive: true });
await writeFile("output/playwright/bazi-cases.json", JSON.stringify(entries, null, 2));
await writeFile("web/bazi-cases.json", JSON.stringify(entries, null, 2));
// iframe 隔离真实 390px 布局，避免 Chrome 窗口宽度下限；与父页同源，便于测量。
await writeFile("web/bazi-capture.html", `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#0f1110}iframe{display:block;width:390px;height:2400px;border:0}</style><iframe title="390px 八字页"></iframe><script>document.querySelector('iframe').src='/#/r/'+new URLSearchParams(location.search).get('id');</script>`);
const server = createFrontendServer({ api: f.api, publicDir: resolve("web") });
server.listen(4178, "127.0.0.1", () => console.log("截图服务已启动：http://127.0.0.1:4178；存档清单 output/playwright/bazi-cases.json"));
const close = () => { server.close(() => { void f.close().then(() => process.exit(0)); }); };
process.on("SIGINT", close);
process.on("SIGTERM", close);
