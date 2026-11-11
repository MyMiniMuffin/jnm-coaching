// Weekly report hierarchy: ratings lead, session counts are quiet facts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const metrics = read('src/components/ReportMetrics.jsx');
const checkin = read('src/views/CheckInView.jsx');

test('ratings and sessions render as separate groups', () => {
    assert.match(metrics, /data-testid="report-ratings"/);
    assert.match(metrics, /data-testid="report-sessions"/);
    assert.match(metrics, /report-ratings"[^>]*grid-cols-3/);
    assert.doesNotMatch(metrics, /grid-cols-5/);
});

test('metric labels are never truncated and stay at least text-sm', () => {
    assert.doesNotMatch(metrics, /truncate/);
    assert.match(metrics, /text-sm text-ink-muted">\{rating\.label\}/);
});

test('report tone colors are not applied to session counts', () => {
    assert.doesNotMatch(metrics, /report-training/);
    const sessionBlock = metrics.slice(metrics.indexOf('report-sessions'), metrics.indexOf('statusClass(report.stepsReached)'));
    assert.ok(sessionBlock.length > 0);
    assert.doesNotMatch(sessionBlock, /text-report-|bg-report-|style\.text|style\.bar/);
});

test('rating tone keeps an accessible meaning', () => {
    assert.match(metrics, /label: 'Bra'/);
    assert.match(metrics, /label: 'Medium'/);
    assert.match(metrics, /label: 'Dårlig'/);
    assert.match(metrics, /sr-only/);
    assert.match(metrics, /title=/);
});

test('steps and supplements status stay visible', () => {
    assert.match(metrics, /Skrittmål nådd/);
    assert.match(metrics, /Under skrittmål/);
    assert.match(metrics, /Tilskudd/);
    assert.match(metrics, /Footprints/);
});

test('featured card leads with weight as a primary value', () => {
    assert.match(checkin, /text-2xl font-semibold[^"]*">\s*\{formatWeight\(featuredReport\.weight\)\}/);
    assert.doesNotMatch(checkin, /<Badge/);
    assert.match(checkin, /aria-label="Rediger rapport"/);
    assert.match(checkin, /aria-label="Slett rapport"/);
});

test('collapsed history row shows date and weight only; expanded row keeps the full body', () => {
    const start = checkin.indexOf('data-testid="checkin-history-row"');
    const end = checkin.indexOf('{isExpanded && (', start);
    const collapsed = checkin.slice(start, end);
    assert.ok(start > 0 && end > start);
    assert.doesNotMatch(collapsed, /energi|søvn/i);
    assert.match(collapsed, /aria-expanded=\{isExpanded\}/);
    assert.match(collapsed, /CaretDown/);
    assert.match(collapsed, /WeightDelta/);
    assert.match(checkin.slice(end), /renderReportBody\(entry\)/);
});
