// src/sanyi/log.ts
import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

export interface SanyiLogger {
  write(
    message: string,
    fields?: Readonly<Record<string, string | number | boolean>>,
  ): Promise<void>;
}

export function createSanyiLogger(
  root = "log",
  clock: () => Date = () => new Date(),
): SanyiLogger {
  return {
    async write(message, fields = {}) {
      const now = clock();
      const local = new Date(now.getTime() + 8 * 3_600_000);
      const date = local.toISOString().slice(0, 10);
      const safe = Object.fromEntries(
        Object.entries(fields).filter(([key]) => {
          return !/^birth/i.test(key) && !/secret|mnemonic|private/i.test(key);
        }),
      );
      await mkdir(root, { recursive: true });
      const line = JSON.stringify({ time: now.toISOString(), message, ...safe });
      await appendFile(join(root, `sanyi_${date}.log`), `${line}\n`, "utf8");
    },
  };
}
