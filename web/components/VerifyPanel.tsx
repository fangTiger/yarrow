// web/components/VerifyPanel.tsx
import type { PublicReading } from "../lib/api.js";
import { ArcVerify } from "./ArcVerify.js";
function explorer(path: string): string {
  const base = typeof __ARC_EXPLORER__ === "undefined"
    ? "https://testnet.arcscan.app" : __ARC_EXPLORER__;
  return `${base.replace(/\/$/u, "")}/${path}`;
}
export function VerifyPanel({ reading }: { reading: PublicReading }) {
  return (
    <section className="panel verify-panel">
      <header className="panel-head"><h2>在 Arc 上验证</h2></header>
      <ArcVerify paymentHash={reading.payment.firstHash} question={reading.question} throws={reading.throws} />
      <details className="arc-verify-raw">
      <summary>复算信息</summary>
      <dl>
        <div><dt>规范化问题</dt><dd>{reading.question}</dd></div>
        <div>
          <dt>付款首笔交易</dt>
          <dd>
            <a href={explorer(`tx/${reading.payment.firstHash}`)} rel="noreferrer" target="_blank">
              Arcscan 查看
            </a>
          </dd>
        </div>
        {reading.throws.map((item) => (
          <div key={item.index}>
            <dt>第 {item.index} 掷区块 #{item.blockNumber}</dt>
            <dd>
              <a href={explorer(`block/${item.blockNumber}`)} rel="noreferrer" target="_blank">
                Arcscan 查看
              </a>
            </dd>
          </div>
        ))}
      </dl>
      <p>
        复算公式：keccak256(encodePacked("sanyi-throw-v1", 付款首笔交易哈希，
        区块哈希，规范化问题，掷序))，取最低三位；1 为背、0 为字。
      </p>
      </details>
    </section>
  );
}
