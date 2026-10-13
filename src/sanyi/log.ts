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
      await mkdir(root, { recursive: true });
      const line = JSON.stringify({ time: now.toISOString(), message, ...safeFields(fields) });
      await appendFile(join(root, `sanyi_${date}.log`), `${line}\n`, "utf8");
    },
  };
}

/** 不写入生辰与密钥类字段。 */
function safeFields(fields: Readonly<Record<string, string | number | boolean>>) {
  return Object.fromEntries(
    Object.entries(fields).filter(([key]) => {
      return !/^birth/i.test(key) && !/secret|mnemonic|private/i.test(key);
    }),
  );
}

/** 输出到标准输出，供 Vercel 等只读文件系统的部署在面板里查看。 */
export function createConsoleLogger(clock: () => Date = () => new Date()): SanyiLogger {
  return {
    async write(message, fields = {}) {
      console.log(JSON.stringify({ time: clock().toISOString(), message, ...safeFields(fields) }));
    },
  };
}
