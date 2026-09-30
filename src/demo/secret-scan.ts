export interface FrontendSource {
  path: string;
  text: string;
}

export interface SecretCandidate {
  label: string;
  value: string;
}

export interface FrontendLeak {
  path: string;
  reasons: string[];
}

const FORBIDDEN_BROWSER_PATTERNS = [
  // React 生态依赖会用 NODE_ENV 选择生产分支；它不是秘密。其余浏览器环境变量入口继续 fail-closed。
  { reason: "服务端环境变量入口", pattern: /process\.env\.(?!NODE_ENV\b)|process\.env\s*\[/ },
  { reason: "私钥入口", pattern: /PRIVATE_KEY|privateKey/ },
  { reason: "助记词入口", pattern: /mnemonic/i },
  { reason: "浏览器账户派生入口", pattern: /viem\/accounts|privateKeyToAccount|mnemonicToAccount/ },
] as const;

/** 返回类别而非命中内容，确保扫描器自身也不会把秘密写入日志。 */
export function scanFrontendSources(
  sources: readonly FrontendSource[],
  secrets: readonly SecretCandidate[],
): FrontendLeak[] {
  const usableSecrets = secrets.filter((secret) => secret.value.length >= 8);
  const leaks: FrontendLeak[] = [];
  for (const source of sources) {
    const reasons: string[] = [];
    for (const secret of usableSecrets) {
      if (source.text.includes(secret.value)) reasons.push(secret.label);
    }
    for (const forbidden of FORBIDDEN_BROWSER_PATTERNS) {
      if (forbidden.pattern.test(source.text)) reasons.push(forbidden.reason);
    }
    if (reasons.length > 0) leaks.push({ path: source.path, reasons: [...new Set(reasons)] });
  }
  return leaks;
}
