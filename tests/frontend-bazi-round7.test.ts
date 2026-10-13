// tests/frontend-bazi-round7.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { sampleBazi } from './helpers/sample-bazi.js';
import { analyzeBazi } from '../src/calendar/bazi-relations.js';
import { BaziRelations } from '../web/components/BaziRelations.js';
import { BaziLuck } from '../web/components/BaziLuck.js';
import { LABEL_BAND, labelLayout, yunLabel, consensusText } from '../web/lib/liunian-chart.js';
const chart = sampleBazi().chart;
test('关系弧无徽章、同组唯一、640尺度与节点间距', () => {
    const analysis = analyzeBazi(chart);
    const markup = renderToStaticMarkup(createElement(BaziRelations, { analysis: { ...analysis, relations: [...analysis.relations, ...analysis.relations] } }));
    assert.match(markup, /viewBox="0 0 640 /);
    assert.match(markup, />午未合</);
    assert.match(markup, />巳申合·刑·破</);
    assert.doesNotMatch(markup, /未午午未|辰申申辰/);
    const paths = [...markup.matchAll(/<path[^>]+>/g)].map(match => match[0]);
    assert.ok(paths.length > 0);
    for (const path of paths) { assert.match(path, /class="rel-arc /); assert.doesNotMatch(path, /\btag\b/); }
    assert.equal(new Set(paths.map(path => path.match(/d="([^"]+)"/)![1])).size, paths.length);
    for (const x of [60, 160, 260, 360, 480, 580]) assert.match(markup, new RegExp(`class="rel-node" x="${x}"`));
    const partial = { ...analysis, nodes: analysis.nodes.filter(node => node.scope === 'natal') };
    const reduced = renderToStaticMarkup(createElement(BaziRelations, { analysis: partial }));
    const positions = [...reduced.matchAll(/class="rel-node" x="(\d+)"/g)].map(match => Number(match[1]));
    assert.ok(positions.every((x, i) => i === 0 || x - positions[i - 1]! <= 100));
});
test('关系CSS强制空心且徽章fill不会作用于path', async () => {
    const css = await readFile(new URL('../web/styles/bazi.css', import.meta.url), 'utf8');
    assert.match(css, /\.rel-svg \.rel-arc\s*\{[^}]*fill:\s*none/);
    for (const rule of css.matchAll(/([^{}]+)\{([^{}]+)\}/g)) {
        if (/\.(clash|join|group|relation-clash|relation-join|relation-group)\b/.test(rule[1]!) && /\bfill\s*:/.test(rule[2]!))
            assert.match(rule[1]!, /text|\.rel-arc-label/);
    }
    assert.match(css, /\.rel-arc-label\s*\{font-size:13px/);
    assert.doesNotMatch(css, /\.ln-yun span\s*\{[^}]*white-space:normal/);
});
test('交运带与相邻年标注避让，优先今年且窄屏短文案', () => {
    const years = [2026, 2027].map((year, i) => ({ year, average: 5 + i, min: 4, max: 7, count: 3 }));
    const labels = labelLayout(years, 2026, 120);
    assert.ok(labels.every(label => label.top >= LABEL_BAND));
    assert.equal(labels[0]?.index, 0);
    assert.ok(Math.abs(labels[0]!.x - labels[1]!.x) < 72);
    assert.ok(Math.abs(labels[0]!.top - labels[1]!.top) >= 24);
    assert.equal(yunLabel('乙酉', '2027-08-04', true), '乙酉运');
    assert.equal(yunLabel('乙酉', '2027-08-04', false), '乙酉运 · 2027-08-04 交运');
    assert.equal(yunLabel('甲申', null, false), '甲申运');
});
test('合议统一一位小数，所有消费位置使用格式函数', async () => {
    assert.deepEqual([4, 5.3, 6].map((value) => consensusText(value)), ['4.0成', '5.3成', '6.0成']);
    const panel = await readFile(new URL('../web/components/LiuNianPanel.tsx', import.meta.url), 'utf8');
    assert.ok((panel.match(/consensusText\(/g) ?? []).length >= 4);
    assert.doesNotMatch(panel, /\$\{[^}]*\.average\}成/);
    const schools = await readFile(new URL('../web/components/BaziSchools.tsx', import.meta.url), 'utf8');
    assert.match(schools, /consensusTenths\.toFixed\(1\)/);
});
test('今年大运不重复所问年，异年仅对应格显示一次', () => {
    const markup = (anchorYear: number) => renderToStaticMarkup(createElement(BaziLuck, { chart: { ...chart, liunian: { ...chart.liunian, anchorYear } }, currentYear: 2026, currentDate: '2026-10-06' }));
    assert.match(markup(2026), /今年 丙午 · 本运末年/);
    assert.doesNotMatch(markup(2026), /所问之年/);
    assert.equal(markup(2027).match(/所问之年 2027/g)?.length, 1);
});
