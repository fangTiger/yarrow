import { decodeAbiParameters, type Hex } from "viem";

const PANIC_REASONS: Record<string, string> = {
  "0x00": "编译器生成的通用 panic",
  "0x01": "assert 条件失败",
  "0x11": "算术溢出或下溢",
  "0x12": "除以零或模零",
  "0x21": "无效枚举转换",
  "0x22": "存储字节数组编码错误",
  "0x31": "对空数组执行 pop",
  "0x32": "数组越界",
  "0x41": "内存分配过大",
  "0x51": "调用未初始化的内部函数",
};

export function decodeRevertData(data: Hex | string): string {
  if (!data || data === "0x") return "无返回数据";

  try {
    if (data.startsWith("0x08c379a0")) {
      const payload = `0x${data.slice(10)}` as Hex;
      const [reason] = decodeAbiParameters([{ type: "string" }], payload);
      return `Error(${reason})`;
    }
    if (data.startsWith("0x4e487b71")) {
      const payload = `0x${data.slice(10)}` as Hex;
      const [code] = decodeAbiParameters([{ type: "uint256" }], payload);
      const codeHex = `0x${code.toString(16).padStart(2, "0")}`;
      return `Panic(${codeHex})：${PANIC_REASONS[codeHex] ?? "未知 panic"}`;
    }
  } catch {
    return `无法解码的回滚数据：${data}`;
  }

  return `自定义错误或未知返回数据：${data}`;
}

export function errorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const candidate = error as { shortMessage?: unknown; message?: unknown };
    if (typeof candidate.shortMessage === "string") return candidate.shortMessage;
    if (typeof candidate.message === "string") return candidate.message;
  }
  return String(error);
}

