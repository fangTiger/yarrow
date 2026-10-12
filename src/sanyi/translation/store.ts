import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { isReadingId } from "../store.js";
import type { TranslationUnitKey } from "./units.js";

export type TranslationStatus = "pending" | "writing" | "done" | "failed";

export interface StoredTranslationUnit {
  status: TranslationStatus;
  sourceHash: string;
  texts?: string[];
  /** provider 调用总次数，补译也计一次。 */
  attempts: number;
  /** 连续整单元失败次数；成功后清零。 */
  failures: number;
  cooldownUntil?: string;
  error?: string;
}

export interface StoredTranslation {
  lang: "en";
  units: Record<string, StoredTranslationUnit>;
}

export class TranslationStore {
  private readonly queues = new Map<string, Promise<void>>();

  constructor(private readonly root = "data") {}

  private path(id: string): string {
    if (!isReadingId(id)) throw new Error("reading id 无效");
    return join(this.root, "translations", `${id}.en.json`);
  }

  async read(id: string): Promise<StoredTranslation | undefined> {
    try {
      return JSON.parse(await readFile(this.path(id), "utf8")) as StoredTranslation;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
  }

  async write(id: string, value: StoredTranslation): Promise<void> {
    const directory = join(this.root, "translations");
    await mkdir(directory, { recursive: true });
    const target = this.path(id);
    const temporary = `${target}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await rename(temporary, target);
  }

  async update(
    id: string,
    change: (value: StoredTranslation) => StoredTranslation,
  ): Promise<StoredTranslation> {
    let result: StoredTranslation | undefined;
    const previous = this.queues.get(id) ?? Promise.resolve();
    const next = previous.catch(() => {}).then(async () => {
      result = change(await this.read(id) ?? { lang: "en", units: {} });
      await this.write(id, result);
    });
    this.queues.set(id, next);
    try {
      await next;
    } finally {
      if (this.queues.get(id) === next) this.queues.delete(id);
    }
    if (!result) throw new Error("译文存档更新未产生结果");
    return result;
  }
}

export type TranslationUnits = Partial<Record<TranslationUnitKey, StoredTranslationUnit>>;
