// web/components/BaziRelations.tsx
import type { BaziAnalysis, RelationNode } from "../../src/calendar/bazi-relations.js";
import { useLang, useT } from "../lib/i18n.js";
import { relationEn, relationKindEn, stemBranchEn } from "../lib/result-format.js";
/** 下方弧线的标签再下移一行，避开节点下的小字说明（年支、Month 等）。 */
const LOWER_LABEL_SHIFT = 14;
const CAPTION_KEYS = {
    "natal.year.branch": "chart.node.year", "natal.month.branch": "chart.node.month",
    "natal.day.branch": "chart.node.day", "natal.time.branch": "chart.node.time",
    "luck.branch": "chart.node.luck", "year.branch": "chart.node.annual",
} as const;
/** 合冲刑害关系图：中英共用；英文地支写拼音，关系名走英译。 */
export function BaziRelations({ analysis }: { analysis: BaziAnalysis }) {
    const { lang } = useLang();
    const t = useT();
    const en = lang === "en";
    const caption = (node: RelationNode) => en
        ? t(CAPTION_KEYS[node.id as keyof typeof CAPTION_KEYS] ?? "chart.node.annual")
        : node.scope === 'natal' ? node.label.replace('柱', '') : node.label.replace('支', '');
    const nodes = analysis.nodes.filter(node => node.type === "branch");
    const full = nodes.length === 6 && nodes.filter(node => node.scope === "natal").length === 4;
    const positions = full ? [60, 160, 260, 360, 480, 580] : nodes.map((_, i) => 320 + (i - (nodes.length - 1) / 2) * 100);
    const x = (id: string) => positions[nodes.findIndex(node => node.id === id)]!;
    const groups = new Map<string, typeof analysis.relations>();
    for (const item of analysis.relations.filter(item => item.nodeIds.every(id => nodes.some(node => node.id === id)))) {
        const key = [...item.nodeIds].sort().join('|');
        groups.set(key, [...(groups.get(key) ?? []), item]);
    }
    const lanes: { left: number; right: number; level: number; side: number; center: number }[] = [];
    const arcs = [...groups.values()].sort((a, b) => span(a[0]!.nodeIds) - span(b[0]!.nodeIds)).map(items => {
        const item = items[0]!;
        const left = Math.min(...item.nodeIds.map(x)), right = Math.max(...item.nodeIds.map(x));
        const center = (left + right) / 2;
        const side = item.nodeIds.some(id => nodes.find(node => node.id === id)?.scope === 'luck') ? 1 : -1;
        let level = 0;
        while (lanes.some(lane => lane.side === side && lane.level === level &&
            (left <= lane.right && right >= lane.left || Math.abs(center - lane.center) < 60))) level++;
        lanes.push({ left, right, level, side, center });
        const tone = items.some(value => !['合', '三合', '半合', '拱', '三会'].includes(value.kind)) ? 'clash' : items.some(value => value.kind !== '合') ? 'group' : 'join';
        const prefix = item.label.slice(0, item.nodeIds.length);
        const order = ['合', '刑', '破', '冲', '害'];
        // 同一组成员的多种关系并成一条弧：按「合刑破冲害」排序，中文接在成员后，英文逐个英译。
        const kinds = [...new Map(items.map(value => [value.label.slice(value.nodeIds.length), value] as const))].sort(([a], [b]) => (order.indexOf(a) < 0 ? 99 : order.indexOf(a)) - (order.indexOf(b) < 0 ? 99 : order.indexOf(b)));
        // 英文名长：弧上只写关系种类（成员已由弧两端的节点标明），完整名称见下方列表。
        const label = en
            ? kinds.map(([, value]) => relationKindEn(value)).join(' · ')
            : prefix + kinds.map(([rest]) => rest).join('·');
        return { key: [...item.nodeIds].sort().join('|'), left, right, center, side, tone, label, height: Math.min(70, 28 + level * 14), labelHeight: Math.min(70, 28 + level * 14) + 8 + Math.max(0, level - 3) * 14 };
    });
    function span(ids: readonly string[]) { return Math.max(...ids.map(x)) - Math.min(...ids.map(x)); }
    const upper = Math.max(95, ...arcs.filter(arc => arc.side < 0).map(arc => arc.labelHeight + 20));
    const base = upper, height = base + Math.max(105, ...arcs.filter(arc => arc.side > 0).map(arc => arc.labelHeight + LOWER_LABEL_SHIFT + 25));
    return <section className="panel"><header className="panel-head"><h2>{t("chart.relations.title")}</h2><p>{t("chart.relations.note")}</p></header><svg className="rel-svg" viewBox={`0 0 640 ${height}`} role="img" aria-label={t("chart.relations.aria")}>
 {nodes.filter(node => node.scope !== 'natal').map(node => <line className="rel-divider" x1={full ? node.scope === 'luck' ? 420 : 530 : x(node.id) - 50} x2={full ? node.scope === 'luck' ? 420 : 530 : x(node.id) - 50} y1="8" y2={height - 8} key={node.id}/>)}
 {arcs.map(arc => <g key={arc.key}><path className={`rel-arc rel-arc--${arc.tone}`} d={`M${arc.left},${base} Q${arc.center},${base + arc.side * arc.height * 2} ${arc.right},${base}`}/><text className={`rel-arc-label rel-arc-label--${arc.tone}`} x={arc.center} y={base + arc.side * arc.labelHeight + (arc.side > 0 ? LOWER_LABEL_SHIFT : 0)} textAnchor="middle">{arc.label}</text></g>)}
 {nodes.map(node => <g data-node={node.id} key={node.id}><text className="rel-node" x={x(node.id)} y={base + 12} textAnchor="middle">{en ? stemBranchEn(node.value) : node.value}</text><text className="rel-caption" x={x(node.id)} y={base + 34} textAnchor="middle">{caption(node)}</text></g>)}
 </svg><ul className="rel-list">{(["natal", "luck", "year"] as const).map(scope => <li data-scope={scope} key={scope}><b>{scope === "natal" ? t("chart.relations.natal") : t(scope === "luck" ? "chart.relations.luck" : "chart.relations.year", { value: (en ? stemBranchEn : (text: string) => text)(analysis.nodes.filter(node => node.scope === scope).map(node => node.value).join("")) })}</b>{[...new Map(analysis.relations.filter(item => item.scope === scope).map(item => [item.label, item] as const)).values()].map(item => en ? relationEn(item) : item.label).join(en ? ", " : "、") || t("chart.relations.none")}</li>)}</ul></section>;
}
