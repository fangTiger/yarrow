// web/components/BaziRelations.tsx
import type { BaziAnalysis } from "../../src/calendar/bazi-relations.js";
export function BaziRelations({ analysis }: { analysis: BaziAnalysis }) {
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
        const label = [...new Set(items.map(value => value.label.slice(value.nodeIds.length)))].sort((a, b) => (order.indexOf(a) < 0 ? 99 : order.indexOf(a)) - (order.indexOf(b) < 0 ? 99 : order.indexOf(b))).join('·');
        return { key: [...item.nodeIds].sort().join('|'), left, right, center, side, tone, label: prefix + label, height: Math.min(70, 28 + level * 14), labelHeight: Math.min(70, 28 + level * 14) + 8 + Math.max(0, level - 3) * 14 };
    });
    function span(ids: readonly string[]) { return Math.max(...ids.map(x)) - Math.min(...ids.map(x)); }
    const upper = Math.max(95, ...arcs.filter(arc => arc.side < 0).map(arc => arc.labelHeight + 20));
    const base = upper, height = base + Math.max(105, ...arcs.filter(arc => arc.side > 0).map(arc => arc.labelHeight + 25));
    return <section className="panel"><header className="panel-head"><h2>合冲刑害</h2><p>原局四支与当前大运、流年之间的关系。</p></header><svg className="rel-svg" viewBox={`0 0 640 ${height}`} role="img" aria-label="地支关系图，完整关系见下方三行文字">
 {nodes.filter(node => node.scope !== 'natal').map(node => <line className="rel-divider" x1={full ? node.scope === 'luck' ? 420 : 530 : x(node.id) - 50} x2={full ? node.scope === 'luck' ? 420 : 530 : x(node.id) - 50} y1="8" y2={height - 8} key={node.id}/>)}
 {arcs.map(arc => <g key={arc.key}><path className={`rel-arc rel-arc--${arc.tone}`} d={`M${arc.left},${base} Q${arc.center},${base + arc.side * arc.height * 2} ${arc.right},${base}`}/><text className={`rel-arc-label rel-arc-label--${arc.tone}`} x={arc.center} y={base + arc.side * arc.labelHeight} textAnchor="middle">{arc.label}</text></g>)}
 {nodes.map(node => <g data-node={node.id} key={node.id}><text className="rel-node" x={x(node.id)} y={base + 12} textAnchor="middle">{node.value}</text><text className="rel-caption" x={x(node.id)} y={base + 34} textAnchor="middle">{node.scope === 'natal' ? node.label.replace('柱', '') : node.label.replace('支', '')}</text></g>)}
 </svg><ul className="rel-list">{(["natal", "luck", "year"] as const).map(scope => <li data-scope={scope} key={scope}><b>{scope === "natal" ? "原局" : `${scope === "luck" ? "大运" : "流年"}${analysis.nodes.filter(node => node.scope === scope).map(node => node.value).join("")}`}</b>{[...new Set(analysis.relations.filter(item => item.scope === scope).map(item => item.label))].join("、") || "无"}</li>)}</ul></section>;
}
