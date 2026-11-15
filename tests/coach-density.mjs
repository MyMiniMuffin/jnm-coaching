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
    assert.match(mailbox, /if \(isEmpty\) return null;/);
});

test('mailbox closes its panel when the last submission is gone', () => {
    assert.match(mailbox, /const isEmpty = !submissions\.length && !error;/);
    const effect = mailbox.slice(mailbox.indexOf('useEffect(() => {\n        if (!isEmpty)'));
    const body = effect.slice(0, effect.indexOf('[isEmpty]'));
    assert.match(body, /setPanelOpen\(false\)/);
    assert.match(body, /setOpenId\(null\)/);
    assert.match(body, /setShowHandled\(false\)/);
    assert.match(mailbox, /finally \{\s*setIsConfirming\(false\);/);
});

test('plan menu returns focus to its trigger before running an action', () => {
    const run = named.slice(named.indexOf('const run = '), named.indexOf('return (', named.indexOf('const run = ')));
    assert.ok(run.indexOf('.focus()') > -1 && run.indexOf('.focus()') < run.indexOf('action()'));
    assert.match(run, /aria-haspopup="menu"/);
});

test('plan card does not clip the absolute menu and the header shrinks on narrow screens', () => {
    const cardLine = plan.slice(plan.indexOf('<Card'), plan.indexOf('>', plan.indexOf('<Card')));
    assert.doesNotMatch(cardLine, /overflow-hidden/);
    const header = plan.slice(plan.indexOf('<Card>'), plan.indexOf('{headerActions}'));
    assert.match(header, /rounded-t-xl/);
    assert.match(header, /min-w-0 flex-1/);
    assert.match(plan, /<h2 className="truncate text-\[1\.05rem\] font-semibold"/);
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

const css = read('src/index.css');
const tabsBlock = named.slice(named.indexOf('const planTabs'), named.indexOf('const planMenu'));

test('plans are tabs only when there is more than one plan', () => {
    assert.match(named, /const showPlanPicker = plans\.length > 1;/);
    assert.match(named, /const planTabs = showPlanPicker \? \(/);
    assert.match(tabsBlock, /\) : null;\s*$/);
    assert.match(tabsBlock, /role="tablist"/);
    assert.match(tabsBlock, /aria-label=\{isDiet \? 'Dietter' : 'Treningsplaner'\}/);
    assert.match(tabsBlock, /<button/);
    assert.match(tabsBlock, /type="button"/);
    assert.match(tabsBlock, /role="tab"/);
    assert.match(tabsBlock, /aria-selected=\{selected\}/);
    assert.match(named, /role: 'tabpanel', tabIndex: 0, 'aria-labelledby': tabId\(selectedPlan\.id\)/);
    assert.match(named, /panelProps=\{showPlanPicker \?/);
    assert.doesNotMatch(named, /aria-controls/);
});

test('no select or caret is used to switch plans', () => {
    assert.doesNotMatch(named, /<select|<option|CaretDown/);
    assert.doesNotMatch(plan, /<select|CaretDown|titleControl/);
});

test('single plan shows a visible title, multiple plans keep the section title visible', () => {
    assert.match(named, /heading=\{showPlanPicker \? \(isDiet \? 'Matplan' : 'Treningsplan'\) : null\}/);
    assert.match(plan, /heading = null, panelProps = null/);
    assert.doesNotMatch(plan, /sr-only' : 'truncate/);
    const h2 = plan.match(/<h2[\s\S]*?<\/h2>/)[0];
    assert.doesNotMatch(h2, /sr-only/);
    assert.match(h2, /\{heading \|\| title\}/);
});

test('tabs use roving tabindex and arrow, Home and End keys with selection following focus', () => {
    assert.match(tabsBlock, /tabIndex=\{selected \? 0 : -1\}/);
    const keys = named.slice(named.indexOf('const handleTabKeyDown'), named.indexOf('const planTabs'));
    assert.match(keys, /ArrowRight/);
    assert.match(keys, /ArrowLeft/);
    assert.match(keys, /'Home'/);
    assert.match(keys, /'End'/);
    assert.match(keys, /selectPlan\(plans\[nextIndex\]\.id\)/);
    assert.match(keys, /\.focus\(\{ preventScroll: true \}\)/);
    assert.doesNotMatch(named, /focusgroup/);
});

test('tabs are 44px touch targets, scroll horizontally and style selection from aria-selected', () => {
    assert.match(tabsBlock, /className="plan-tab min-h-11 touch-manipulation select-none/);
    assert.match(css, /\.plan-tabs \{[^}]*overflow-x: auto/);
    assert.match(css, /\.plan-tabs \{[^}]*overscroll-behavior-x: contain/);
    assert.match(css, /\.plan-tabs \{[^}]*scrollbar-width: none/);
    assert.match(css, /scroll-snap-type: inline proximity/);
    assert.doesNotMatch(css, /scroll-snap-type: inline mandatory/);
    assert.match(css, /@property --plan-tabs-fade-start/);
    assert.match(css, /@property --plan-tabs-fade-end/);
    assert.match(css, /\.plan-tab \{[^}]*flex: none/);
    assert.match(css, /\.plan-tab \{[^}]*white-space: nowrap/);
    assert.match(css, /\.plan-tab\[aria-selected="true"\]::after \{\s*border-block-end-color/);
    assert.match(css, /\.plan-tab::after \{[^}]*border-block-end: 2px solid/);
    assert.match(css, /\.plan-tab:active:not\(:disabled\) \{/);
    assert.match(css, /@media \(hover: hover\) and \(pointer: fine\) \{\s*\.plan-tab\[aria-selected="false"\]:not\(:disabled\):hover/);
    assert.doesNotMatch(named, /scrollIntoView/);
    assert.match(named, /list\.scrollTo\(\{ left/);
    assert.match(named, /tab\.offsetLeft/);
    assert.match(named, /focus\(\{ preventScroll: true \}\)/);
    assert.match(named, /prevSelectedIdRef/);
    assert.doesNotMatch(named, /didMountRef/);
    assert.match(named, /tabsLocked = isEditingPlan \|\| isSaving \|\| Boolean\(nameMode\)/);
    assert.match(named, /const selectPlan = \(id\) => \{\s*if \(tabsLocked\) return;/);
    assert.match(named, /title=\{plan\.name\}/);
    assert.match(named, /tabIndex: 0, 'aria-labelledby'/);
    assert.match(css, /\.plan-tabs \{\s*position: relative/);
    assert.doesNotMatch(css.slice(css.indexOf('.plan-tab {')), /font-weight: 600|touch-action: none/);
});

test('plan header stays on one row on a folded cover without mid-word breaks', () => {
    const h2Match = plan.match(/<h2[\s\S]*?<\/h2>/);
    assert.ok(h2Match, 'plan h2 not found');
    const h2 = h2Match[0];
    assert.doesNotMatch(h2, /break-words/);
    assert.match(h2, /className="truncate text-\[1\.05rem\] font-semibold"/);
    assert.match(h2, /title=\{heading \|\| title\}/);
    assert.match(plan, /aria-label="Rediger" title="Rediger"/);
    assert.match(plan, /<span className="hidden sm:inline">Rediger<\/span>/);
    assert.match(plan, /className="hidden sm:flex w-10 h-10 shrink-0/);
});

test('export still uses the selected plan', () => {
    assert.match(named, /key=\{selectedPlan\.id\}/);
    assert.match(named, /planTitle=\{selectedPlan\.name\}/);
    assert.match(named, /content=\{selectedPlan\.content\}/);
    assert.match(plan, /const title = planTitle \|\|/);
    assert.match(plan, /serializePlanAsPlainText\(isEditing \? draft : parsedPlan\)/);
    assert.match(plan, /Eksporter \$\{title\.toLowerCase\(\)\} som tekstfil/);
});

test('name input only appears in new or rename mode, at 16px', () => {
    assert.match(named, /!isReadOnly && \(nameMode \|\| saveError\)/);
    assert.match(named, /\{nameMode && \(\s*<form onSubmit=\{handleNameSubmit\}/);
    const input = named.slice(named.indexOf('<input'), named.indexOf('/>', named.indexOf('<input')));
    assert.match(input, /text-base/);
    assert.doesNotMatch(input, /text-sm/);
});

test('read-only athlete view has no change menu', () => {
    assert.match(named, /const planMenu = !isReadOnly \? \(/);
    assert.match(named, /const nameForm = !isReadOnly &&/);
});

test('archived warning stays and PlanSection works with a single plan and no new props', () => {
    assert.match(named, /Utøveren er arkivert/);
    assert.match(plan, /heading = null, panelProps = null, headerActions = null, headerExtra = null/);
});

test('plan edit, import and export are kept', () => {
    assert.match(plan, /Eksporter/);
    assert.match(plan, /Importer tekst/);
    assert.match(plan, /handleStartEditing/);
    assert.match(plan, /Bruk forslag/);
});
