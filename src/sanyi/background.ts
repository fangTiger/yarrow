// src/sanyi/background.ts
/**
 * 后台任务保活挂钩。常驻进程无需处理；Vercel 等无状态部署在入口处设为 waitUntil，
 * 使响应返回后起卦、落笔、总述与翻译仍能在同一实例里跑完。
 */
type KeepAlive = (task: Promise<unknown>) => void;

let hook: KeepAlive = () => {};

export function setBackgroundKeepAlive(next: KeepAlive): void {
  hook = next;
}

export function keepAlive(task: Promise<unknown>): void {
  // 保活只关心何时结束，失败已由各服务自行落库。
  hook(task.catch(() => {}));
}
