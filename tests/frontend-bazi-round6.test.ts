// tests/frontend-bazi-round6.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement, type FunctionComponent } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { sampleBazi } from './helpers/sample-bazi.js';
import { analyzeBazi } from '../src/calendar/bazi-relations.js';
import { BaziTable } from '../web/components/BaziTable.js';
import { BaziLuck } from '../web/components/BaziLuck.js';
import { BaziElements } from '../web/components/BaziElements.js';
import { BaziRelations } from '../web/components/BaziRelations.js';
import { directLabels } from '../web/lib/liunian-chart.js';
import { mockBaziSchoolOutput } from '../src/sanyi/mock-bazi-schools.js';
const input = sampleBazi();
const analysis = analyzeBazi(input.chart);
const html = <P extends object>(component: FunctionComponent<P>, props: P) => renderToStaticMarkup(createElement(component, props));
test('四柱沿用样稿七行、日主整列、神煞按柱去重且保留依据', () => {
    const duplicate = { ...analysis, shensha: [...analysis.shensha, ...analysis.shensha] };
    const markup = html(BaziTable, { chart: input.chart, analysis: duplicate });
    assert.match(markup, /class="pillars"/);
    assert.equal(markup.split('<tbody>')[1]?.split('</tbody>')[0]?.match(/<tr>/g)?.length, 7);
    assert.match(markup, /日柱 · 日主/);
    assert.match(markup, /class="gz day"/);
    assert.equal(markup.match(/>天乙贵人</g)?.length, 1);
    assert.match(markup, /title="[^"]+"/);
});
test('大运八步与五行四段，关系图只画地支并按范围三行', () => {
    const luck = html(BaziLuck, { chart: input.chart, currentYear: 2026, currentDate: '2026-10-06' });
    assert.match(luck, /class="luck"/);
    assert.equal(luck.match(/data-cycle=/g)?.length, 8);
    const elements = html(BaziElements, { elements: analysis.elements });
    assert.equal(elements.match(/class="el-bar"/g)?.length, 5);
    assert.equal(elements.match(/data-qi=/g)?.length, 20);
    const relations = html(BaziRelations, { analysis });
    assert.match(relations, /class="rel-svg"/);
    assert.equal(relations.match(/data-node=/g)?.length, 6);
    assert.doesNotMatch(relations, /data-node="[^"]*stem/);
    assert.equal(relations.match(/data-scope=/g)?.length, 3);
});
test('等值并列取最早一年，最低与最顺同年不重复标注', () => {
    const years = [2023, 2024, 2025].map(year => ({ year, average: 5, min: 5, max: 5, count: 3 }));
    assert.deepEqual(directLabels(years, 2024, false), [['十年最顺'], ['今年'], []]);
});
test('mock 三家总断与逐年有差异，锚年与总断一致且短评不超过16字', () => {
    const outputs = ['shenxiaozhan', 'yuchuntai', 'rentieqiao'].map(key => mockBaziSchoolOutput(key as 'shenxiaozhan', input.facts, 'fortune'));
    assert.equal(new Set(outputs.map(o => o.confidenceTenths)).size, 3);
    assert.ok(outputs[0]!.years.some((y, i) => new Set(outputs.map(o => o.years[i]!.confidenceTenths)).size > 1));
    for (const output of outputs) {
        const anchor = output.years.find(y => y.year === 2026)!;
        assert.equal(anchor.confidenceTenths, output.confidenceTenths);
        assert.equal(anchor.verdict, output.verdict);
        for (const year of output.years) {
            assert.ok(year.confidenceTenths >= 3 && year.confidenceTenths <= 7);
            assert.equal(year.verdict, year.confidenceTenths >= 6 ? '吉' : year.confidenceTenths <= 4 ? '凶' : '平');
            assert.ok([...year.note].length <= 16);
        }
    }
});
test('流年2023列只放year关系并按标签去重，表头分组与HTML图层', async () => {
    const { baziFixture, birth, proof } = await import('./helpers/bazi-service.js');
    const { publicBaziReading } = await import('../src/sanyi/bazi-public.js');
    const { LiuNianPanel } = await import('../web/components/LiuNianPanel.js');
    const f = await baziFixture();
    try {
        const value = await f.bazi.create({ kind: 'fortune', question: '今年运势如何', birth, sect: 1, horizon: 'year', feeProof: proof() });
        await f.bazi.whenSettled(value.id);
        const reading = publicBaziReading(await f.bazi.getReading(value.id));
        if (reading.kind !== 'fortune')
            throw new Error('类型错误');
        const markup = html(LiuNianPanel, { reading, currentYear: 2026 });
        const row = markup.split('<th scope="row">合冲刑害</th>')[1]!.split('</tr>')[0]!;
        const first = row.split('</td>')[0]!;
        assert.deepEqual([...first.matchAll(/<span[^>]*>([^<]+)<\/span>/g)].map(m => m[1]).sort(), ['午卯破', '卯辰害', '卯未半合木'].sort());
        assert.match(markup, /class="ln-span"/);
        assert.match(markup, /回看 · 可对照亲历/);
        assert.match(markup, /preserveAspectRatio="none"/);
        assert.match(markup, /vector-effect="non-scaling-stroke"/);
        assert.doesNotMatch(markup, /<text|<circle|class="ln-hit"[^>]*><button/);
        assert.match(markup, /class="ln-detail-rows"/);
    }
    finally {
        await f.close();
    }
});
test('样稿CSS隔离在八字页，大运窄屏四列且文本不随SVG缩放', async () => {
    const { readFile } = await import('node:fs/promises');
    const css = await readFile(new URL('../web/styles/bazi.css', import.meta.url), 'utf8');
    assert.match(css, /\.bazi \.luck\s*\{[^}]*repeat\(8,/);
    assert.match(css, /@media \(max-width: 760px\)[\s\S]*repeat\(4,/);
    assert.match(css, /\.bazi \.ln-lab\s*\{[^}]*font-size: 12px/);
    assert.match(css, /\.bazi \.pillars td.gz\s*\{[^}]*font-size: 34px/);
    assert.match(css, /\.bazi \.ln-table td.v.ji\s*\{[^}]*box-shadow: inset 3px/);
});
