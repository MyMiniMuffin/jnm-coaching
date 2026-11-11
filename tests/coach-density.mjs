// Coach density: henvendelser live in a compact «Postkasse»; plan switching is chrome in the plan header.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const mailbox = read('src/components/FormSubmissions.jsx');
const dashboard = read('src/views/CoachDashboard.jsx');
const named = read('src/views/NamedPlansSection.jsx');
const plan = read('src/views/PlanSection.jsx');

const panelStart = mailbox.indexOf('{panelOpen && (');
const rowBlock = mailbox.slice(mailbox.indexOf('data-testid="mailbox-row"'), panelStart);
const panelBlock = mailbox.slice(panelStart);

test('mailbox is a compact row on the dashboard, without the full list', () => {
    assert.ok(panelStart > 0);
    assert.match(rowBlock, /aria-haspopup="dialog"/);
    assert.match(rowBlock, /min-h-11/);
    assert.match(rowBlock, /touch-manipulation/);
    assert.match(rowBlock, /Postkasse/);
    assert.doesNotMatch(rowBlock, /<SubmissionItem|visible\.map|<ul/);
    assert.doesNotMatch(rowBlock, /<Badge/);
    assert.doesNotMatch(mailbox, /aria-labelledby="form-submissions-title"/);
});

test('mailbox row is quiet with zero new and only accent when there are new', () => {
    assert.match(rowBlock, /open\.length > 0 \? 'font-medium text-accent' : 'text-ink-muted'/);
    assert.match(mailbox, /'Ingen nye'/);
});

test('mailbox renders nothing without submissions and without error', () => {
    assert.match(mailbox, /if \(!submissions\.length && !error\) return null;/);
});

test('mailbox hover is gated for touch', () => {
    assert.match(mailbox, /\[@media\(hover:hover\)_and_\(pointer:fine\)\]:hover:/);
    assert.doesNotMatch(rowBlock.replace(/\[@media\(hover:hover\)_and_\(pointer:fine\)\]:hover:/g, ''), /hover:/);
});

test('panel uses the existing modal pattern with title, close, escape and focus trap', () => {
    assert.match(panelBlock, /modal-backdrop/);
    assert.match(panelBlock, /modal-scroll-panel/);
    assert.match(panelBlock, /role="dialog"/);
    assert.match(panelBlock, /aria-modal="true"/);
    assert.match(panelBlock, /aria-labelledby="mailbox-title"/);
    assert.match(panelBlock, />Postkasse</);
    assert.match(panelBlock, /aria-label="Lukk"/);
    assert.match(mailbox, /useEscapeKey\(closePanel/);
    assert.match(mailbox, /useFocusTrap\(panelOpen\)/);
});

test('modal scroll panel is bounded to the visible area with contained overscroll and safe areas', () => {
    const css = read('src/index.css');
    const panel = css.slice(css.indexOf('.modal-scroll-panel'));
    assert.match(panel, /100dvh/);
    assert.match(panel, /overscroll-behavior: contain/);
    assert.match(css.slice(css.indexOf('.modal-backdrop'), css.indexOf('.modal-scroll-panel')), /env\(safe-area-inset-bottom/);
});

test('panel holds the list and all actions', () => {
    assert.match(panelBlock, /<SubmissionItem/);
    assert.match(panelBlock, /Behandlet \(/);
    assert.match(panelBlock, /Vis nye/);
    assert.match(mailbox, /Marker som behandlet/);
    assert.match(mailbox, /Flytt til nye/);
    assert.match(mailbox, /handled && \(\s*<Button variant="danger"[^>]*onClick=\{\(\) => onDelete/);
    assert.match(mailbox, /title: 'Slett henvendelse\?'/);
    assert.match(mailbox, /setInterval\(load, 60000\)/);
    assert.match(mailbox, /mailto:/);
    assert.match(mailbox, /api\.setFormSubmissionHandled/);
    assert.match(mailbox, /api\.deleteFormSubmission/);
});

test('dashboard keeps one mailbox entry and still renders deletion requests unchanged', () => {
    assert.match(dashboard, /<FormSubmissions \/>/);
    assert.match(dashboard, /<DeletionRequests allUsers=\{allUsers\} onSelectClient=\{onSelectClient\} \/>/);
    assert.doesNotMatch(dashboard, /Behandlede henvendelser|SubmissionItem/);
});

test('collection card is gone', () => {
    assert.doesNotMatch(named, /Velg \$\{isDiet|Velg dietten|du vil se/);
    assert.doesNotMatch(named, /aria-current/);
    assert.doesNotMatch(named, /overflow-x-auto/);
    assert.doesNotMatch(named, /collectionTitle|<Card/);
});

test('new, rename and delete live in a menu in the plan header', () => {
    assert.match(named, /role="menu"/);
    assert.match(named, /aria-haspopup="menu"/);
    assert.match(named, /Gi nytt navn/);
    assert.match(named, /Ny diett/);
    assert.match(named, /Ny plan/);
    assert.match(named, /headerActions=\{planMenu\}/);
    assert.match(plan, /\{headerActions\}/);
    assert.match(named, /key === 'Escape'/);
    assert.match(named, /pointerdown/);
});

test('menu keeps last-plan protection and disabled states', () => {
    assert.match(named, /canDelete=\{plans\.length > 1\}/);
    assert.match(named, /disabled=\{isEditingPlan \|\| isSaving\}/);
    assert.match(named, /Dette navnet er allerede i bruk/);
    assert.match(named, /setSaveError\(/);
});

test('plan selector only when there is more than one plan, as a compact select', () => {
    assert.match(named, /const showPlanPicker = plans\.length > 1;/);
    assert.match(named, /const planSelector = showPlanPicker \? \(/);
    assert.match(named, /<select/);
    assert.match(named, /titleControl=\{planSelector\}/);
    assert.doesNotMatch(named, /titleAccessory/);
});

test('selector replaces the title only when plans.length > 1; h2 stays for screen readers', () => {
    assert.match(named, /const planSelector = showPlanPicker \? \(/);
    assert.match(named, /\) : null;\s*\n\s*const planMenu/);
    assert.match(named, /aria-label=\{isDiet \? 'Velg diett' : 'Velg treningsplan'\}/);
    assert.match(plan, /titleControl = null/);
    assert.match(plan, /<h2 className=\{titleControl \? 'sr-only' : '[^']*font-semibold'\}>\{title\}<\/h2>/);
    assert.match(plan, /\{titleControl\}/);
    const select = named.slice(named.indexOf('<select'), named.indexOf('</select>'));
    assert.match(select, /min-h-11/);
    assert.match(select, /text-\[1\.05rem\] font-semibold/);
    assert.doesNotMatch(select, /bg-surface-50/);
});

test('name input only appears in new or rename mode, at 16px', () => {
    assert.match(named, /!isReadOnly && \(nameMode \|\| saveError\)/);
    assert.match(named, /\{nameMode && \(\s*<form onSubmit=\{handleNameSubmit\}/);
    const input = named.slice(named.indexOf('<input'), named.indexOf('/>', named.indexOf('<input')));
    assert.match(input, /text-base/);
    assert.doesNotMatch(input, /text-sm/);
    assert.match(named, /<select[\s\S]*?text-\[1\.05rem\]/);
});

test('read-only athlete view has no change menu', () => {
    assert.match(named, /const planMenu = !isReadOnly \? \(/);
    assert.match(named, /const nameForm = !isReadOnly &&/);
});

test('archived warning stays and PlanSection works with a single plan and no new props', () => {
    assert.match(named, /Utøveren er arkivert/);
    assert.match(plan, /titleControl = null, headerActions = null, headerExtra = null/);
});

test('plan edit, import and export are kept', () => {
    assert.match(plan, /Eksporter/);
    assert.match(plan, /Importer tekst/);
    assert.match(plan, /handleStartEditing/);
    assert.match(plan, /Bruk forslag/);
});
