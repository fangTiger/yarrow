// web/components/TopbarBrand.tsx
import { useT } from "../lib/i18n.js";

/** 顶栏品牌：朱印「易」加品牌名。印只是装饰，读屏由旁边的品牌名读出。 */
export function TopbarBrand() {
  const t = useT();
  return <>
    <img alt="" className="brand-mark" height={44} src="/brand/yarrow-mark.svg" width={44} />
    <span className="brand">{t("brand.name")}</span>
  </>;
}
