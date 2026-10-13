import { FileBackend, updateDocument, type DocumentBackend } from "../storage.js";
import { isReadingId } from "../store.js";
import type { TranslationUnitKey } from "./units.js";

export type TranslationStatus = "pending" | "writing" | "done" | "failed";

export interface StoredTranslationUnit {
  status: TranslationStatus;
  sourceHash: string;
  texts?: string[];
  /** 软性核对问题（术语、古文、数字一致性），仅供监控，不影响展示。 */
  warnings?: string[];
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
  private readonly backend: DocumentBackend;

  /** 传目录则用本地文件存储；传后端则用该后端（如 Upstash Redis）。 */
  constructor(storage: string | DocumentBackend = "data") {
    this.backend = typeof storage === "string" ? new FileBackend(storage) : storage;
  }

  private key(id: string): string {
    if (!isReadingId(id)) throw new Error("reading id 无效");
    return `translations/${id}.en`;
  }

  private async readRaw(id: string): Promise<{ raw: string; value: StoredTranslation } | undefined> {
    try {
      const raw = await this.backend.get(this.key(id));
      return { raw, value: JSON.parse(raw) as StoredTranslation };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
  }

  async read(id: string): Promise<StoredTranslation | undefined> {
    return (await this.readRaw(id))?.value;
  }

  async write(id: string, value: StoredTranslation): Promise<void> {
    await this.backend.set(this.key(id), serializeTranslation(value));
  }

  async update(
    id: string,
    change: (value: StoredTranslation) => StoredTranslation,
  ): Promise<StoredTranslation> {
    let result: StoredTranslation | undefined;
    const previous = this.queues.get(id) ?? Promise.resolve();
    // 同一实例内排队；跨实例由比较后写入兜底，冲突时重读重试。
    const next = previous.catch(() => {}).then(async () => {
      result = await updateDocument(this.backend, this.key(id), () => this.readRaw(id),
        (current) => change(current ?? { lang: "en", units: {} }), serializeTranslation);
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

function serializeTranslation(value: StoredTranslation): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export type TranslationUnits = Partial<Record<TranslationUnitKey, StoredTranslationUnit>>;
