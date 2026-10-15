// src/sanyi/storage.ts
import { randomBytes } from "node:crypto";
import { mkdir, open, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

/**
 * 存档的底层键值存储。键形如 `readings/<id>`，值为 JSON 文本。
 * 本地用文件，Vercel 等无状态部署用 Upstash Redis，使不同实例看到同一份存档。
 */
export interface DocumentBackend {
  /** 读取；不存在时抛出 code 为 ENOENT 的错误，与文件存储一致。 */
  get(key: string): Promise<string>;
  set(key: string, value: string): Promise<void>;
  /** 仅当当前值仍等于 expected 时写入，返回是否写入。 */
  compareAndSet(key: string, expected: string, value: string): Promise<boolean>;
  /** 仅当键不存在时写入，返回是否写入。 */
  setIfAbsent(key: string, value: string): Promise<boolean>;
  /** 原子累加 `{ counts: Record<string, number> }` 文档中的一个计数。 */
  incrementCounter(key: string, field: string): Promise<void>;
  /** 列出某一目录下的键名（不含目录前缀）。 */
  list(prefix: string): Promise<string[]>;
}

const FILE_COUNTER_QUEUES = new Map<string, Promise<void>>();

export function missingDocument(key: string): NodeJS.ErrnoException {
  const error: NodeJS.ErrnoException = new Error(`存档不存在：${key}`);
  error.code = "ENOENT";
  return error;
}

export class FileBackend implements DocumentBackend {
  constructor(private readonly root = "data") {}

  private path(key: string): string {
    return join(this.root, `${key}.json`);
  }

  async get(key: string): Promise<string> {
    return readFile(this.path(key), "utf8");
  }

  async set(key: string, value: string): Promise<void> {
    const target = this.path(key);
    await mkdir(dirname(target), { recursive: true });
    const temporary = `${target}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
    await writeFile(temporary, value, "utf8");
    await rename(temporary, target);
  }

  /** 单进程内由调用方的队列串行化，文件存储不做跨进程比较。 */
  async compareAndSet(key: string, expected: string, value: string): Promise<boolean> {
    let current: string;
    try {
      current = await this.get(key);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      return false;
    }
    if (current !== expected) return false;
    await this.set(key, value);
    return true;
  }

  async setIfAbsent(key: string, value: string): Promise<boolean> {
    const target = this.path(key);
    await mkdir(dirname(target), { recursive: true });
    try {
      const handle = await open(target, "wx");
      try {
        await handle.writeFile(value, "utf8");
      } finally {
        await handle.close();
      }
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") return false;
      throw error;
    }
  }

  async incrementCounter(key: string, field: string): Promise<void> {
    const target = this.path(key);
    const previous = FILE_COUNTER_QUEUES.get(target) ?? Promise.resolve();
    const current = previous.catch(() => {}).then(async () => {
      let counts: Record<string, number> = {};
      try {
        const parsed = JSON.parse(await this.get(key)) as { counts?: unknown };
        if (parsed.counts && typeof parsed.counts === "object" && !Array.isArray(parsed.counts)) {
          counts = parsed.counts as Record<string, number>;
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      const value = counts[field];
      await this.set(key, JSON.stringify({
        counts: { ...counts, [field]: (typeof value === "number" ? value : 0) + 1 },
      }));
    });
    FILE_COUNTER_QUEUES.set(target, current);
    try {
      await current;
    } finally {
      if (FILE_COUNTER_QUEUES.get(target) === current) FILE_COUNTER_QUEUES.delete(target);
    }
  }

  async list(prefix: string): Promise<string[]> {
    try {
      const names = await readdir(join(this.root, prefix));
      return names.filter((name) => name.endsWith(".json")).map((name) => name.slice(0, -5));
    } catch {
      return [];
    }
  }
}

/** 比较后写入：Redis 端原子执行，避免两个实例同时改同一卦时互相覆盖。 */
const COMPARE_AND_SET = `if redis.call("GET", KEYS[1]) == ARGV[1] then
  redis.call("SET", KEYS[1], ARGV[2])
  return 1
end
return 0`;

/** Redis 内一次完成 JSON 计数读取、递增和写回，实例数量不会制造 CAS 丢写。 */
const INCREMENT_COUNTER = `local raw = redis.call("GET", KEYS[1])
local doc = raw and cjson.decode(raw) or {counts = {}}
if type(doc.counts) ~= "table" then doc.counts = {} end
local current = tonumber(doc.counts[ARGV[1]]) or 0
doc.counts[ARGV[1]] = current + 1
redis.call("SET", KEYS[1], cjson.encode(doc))
return current + 1`;

export interface RedisBackendOptions {
  url: string;
  token: string;
  /** 键名前缀，便于同一个库里区分环境。 */
  namespace?: string;
  fetch?: typeof fetch;
}

/** Upstash Redis REST 接口；不引入 SDK，直接发命令数组。 */
export class RedisBackend implements DocumentBackend {
  private readonly url: string;
  private readonly namespace: string;
  private readonly fetchImplementation: typeof fetch;

  constructor(private readonly options: RedisBackendOptions) {
    this.url = options.url.replace(/\/$/u, "");
    this.namespace = options.namespace ?? "sanyi";
    this.fetchImplementation = options.fetch ?? fetch;
  }

  private key(key: string): string {
    return `${this.namespace}:${key}`;
  }

  private async command(args: readonly string[]): Promise<unknown> {
    const response = await this.fetchImplementation(this.url, {
      method: "POST",
      headers: { authorization: `Bearer ${this.options.token}`, "content-type": "application/json" },
      body: JSON.stringify(args),
    });
    const payload = await response.json().catch(() => ({})) as { result?: unknown; error?: string };
    if (!response.ok || payload.error) {
      throw new Error(`Redis 命令失败：${args[0]} ${payload.error ?? response.status}`);
    }
    return payload.result ?? null;
  }

  async get(key: string): Promise<string> {
    const result = await this.command(["GET", this.key(key)]);
    if (typeof result !== "string") throw missingDocument(key);
    return result;
  }

  async set(key: string, value: string): Promise<void> {
    await this.command(["SET", this.key(key), value]);
  }

  async compareAndSet(key: string, expected: string, value: string): Promise<boolean> {
    const result = await this.command(["EVAL", COMPARE_AND_SET, "1", this.key(key), expected, value]);
    return result === 1;
  }

  async setIfAbsent(key: string, value: string): Promise<boolean> {
    const result = await this.command(["SET", this.key(key), value, "NX"]);
    return result === "OK";
  }

  async incrementCounter(key: string, field: string): Promise<void> {
    await this.command(["EVAL", INCREMENT_COUNTER, "1", this.key(key), field]);
  }

  async list(prefix: string): Promise<string[]> {
    const start = `${this.key(prefix)}/`;
    const names: string[] = [];
    let cursor = "0";
    do {
      const result = await this.command(["SCAN", cursor, "MATCH", `${start}*`, "COUNT", "500"]);
      const [next, keys] = result as [string, string[]];
      cursor = next;
      names.push(...keys.map((key) => key.slice(start.length)));
    } while (cursor !== "0");
    return names;
  }
}

/** 按环境变量选择存储：配置了 Upstash（含 Vercel 市场注入的 KV_* 名称）就用 Redis，否则用本地文件。 */
export function backendFromEnv(env: Record<string, string | undefined> = process.env): DocumentBackend {
  const url = env.UPSTASH_REDIS_REST_URL ?? env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN ?? env.KV_REST_API_TOKEN;
  if (url && token) {
    return new RedisBackend({ url, token, ...(env.SANYI_STORE_NAMESPACE ? { namespace: env.SANYI_STORE_NAMESPACE } : {}) });
  }
  return new FileBackend(env.SANYI_DATA_DIR ?? "data");
}

/**
 * 读出、修改、比较后写回；被其他实例抢先写入时重读重试。
 * change 必须是纯函数，重试时可能被调用多次。
 */
export async function updateDocument<T>(
  backend: DocumentBackend,
  key: string,
  read: () => Promise<{ raw: string; value: T } | undefined>,
  change: (value: T | undefined) => T,
  serialize: (value: T) => string,
): Promise<T> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const current = await read();
    const next = change(current?.value);
    const text = serialize(next);
    if (!current) {
      if (await backend.setIfAbsent(key, text)) return next;
      continue;
    }
    if (await backend.compareAndSet(key, current.raw, text)) return next;
  }
  throw new Error(`存档写入冲突过多：${key}`);
}
