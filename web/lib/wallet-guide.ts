/** MetaMask 手机深链只保留 host、路径和查询串。 */
export function metaMaskDeepLink(pageUrl: string): string {
  const url = new URL(pageUrl);
  return `https://metamask.app.link/dapp/${url.host}${url.pathname}${url.search}`;
}

export function isMobileBrowser(userAgent: string): boolean {
  return /Android|iPhone|iPad|iPod/iu.test(userAgent);
}
