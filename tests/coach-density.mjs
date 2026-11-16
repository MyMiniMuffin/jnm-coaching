// Coach density: «Postkasse» is a header icon; the dashboard is slim (summary line, one-row toolbar, compact cards).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const mailbox = read('src/components/FormSubmissions.jsx');
const dashboard = read('src/views/CoachDashboard.jsx');
const header = read('src/components/Header.jsx');
const account = read('src/components/AccountMenu.jsx');
const app = read('src/App.jsx');
const named = read('src/views/NamedPlansSection.jsx');
const plan = read('src/views/PlanSection.jsx');

const panelStart = mailbox.indexOf('{panelOpen && createPortal(');
const rowBlock = mailbox.slice(mailbox.indexOf('data-testid="mailbox-trigger"'), panelStart);
const panelBlock = mailbox.slice(panelStart);

test('mailbox is a header icon button with a badge only when something is open', () => {
    assert.ok(panelStart > 0);
    assert.match(rowBlock, /aria-haspopup="dialog"/);
    assert.match(rowBlock, /aria-expanded=\{panelOpen\}/);
    assert.match(rowBlock, /<Tray size=\{20\} aria-hidden="true"/);
    assert.match(rowBlock, /touch-manipulation/);
    assert.match(rowBlock, /\{hasOpen && \(/);
    assert.match(rowBlock, /tabular-nums/);
    assert.match(rowBlock, /aria-hidden="true"\s+className="absolute/);
    assert.doesNotMatch(rowBlock, /<SubmissionItem|visible\.map|<ul|<Badge/);
    assert.doesNotMatch(mailbox, /data-testid="mailbox-row"|aria-labelledby="form-submissions-title"/);
});

test('mailbox accessible name carries the unread count, plain «Postkasse» when none', () => {
    assert.match(mailbox, /'Postkasse, kunne ikke hente'/);
    assert.match(mailbox, /`Postkasse, \$\{open\.length\} \$\{open\.length === 1 \? 'ny' : 'nye'\}`/);
    assert.match(mailbox, /: 'Postkasse'/);
    assert.match(rowBlock, /aria-label=\{label\}/);
    assert.match(rowBlock, /fetchFailed \? ' text-error' : ''/);
});

test('mailbox icon renders even when the inbox is empty', () => {
    assert.doesNotMatch(mailbox, /return null/);
    assert.doesNotMatch(mailbox, /if \(isEmpty\)/);
});

test('inbox lives in the header on coach home only and the dashboard no longer has a row', () => {
    assert.match(header, /import FormSubmissions from '\.\/FormSubmissions'/);
    assert.match(header, /\{coachHome && !isClientPreview && \(/);
    // viewingClient branch ends before the coach-home branch; no inbox there
    const viewingBranch = header.slice(header.indexOf('{viewingClient ? ('), header.indexOf(') : (', header.indexOf('{viewingClient ? (')));
    assert.doesNotMatch(viewingBranch, /FormSubmissions/);
    assert.match(app, /<Header\s+user=\{displayUser\}[^>]*?\bcoachHome\b/s);
    assert.equal((app.match(/\bcoachHome\b/g) || []).length, 1);
    assert.doesNotMatch(dashboard, /FormSubmissions|Postkasse/);
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

test('mailbox trigger adds no ungated hover styles of its own', () => {
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

test('dashboard still renders deletion requests unchanged and never the mailbox list', () => {
    assert.match(dashboard, /<DeletionRequests allUsers=\{allUsers\} onSelectClient=\{onSelectClient\} \/>/);
    assert.doesNotMatch(dashboard, /Behandlede henvendelser|SubmissionItem/);
});

test('hero card is a slim one-line summary, unread highlighted only when > 0', () => {
    assert.doesNotMatch(dashboard, /hero-tint|Oversikt|font-display leading-tight|grid-cols-3/);
    assert.match(dashboard, /data-testid="coach-summary"/);
    assert.match(dashboard, /'aktiv' : 'aktive'/);
    assert.match(dashboard, /'ulest' : 'uleste'/);
    assert.match(dashboard, /totalUnreadCheckins > 0 \? 'font-medium text-accent' : undefined/);
    assert.match(dashboard, /tabular-nums/);
    assert.match(dashboard, /\{' · '\}/);
});

test('push status moved out of the dashboard into the coach-only account menu', () => {
    assert.doesNotMatch(dashboard, /Pushvarsler aktivert|Varsler blokkert|Slå på|BellRinging|onEnableNotifications|notificationPermission/);
    assert.match(account, /notificationPermission = 'unsupported', onEnableNotifications/);
    assert.match(account, /user\?\.role === 'coach' && <section/);
    for (const text of ['Pushvarsler aktivert', 'Varsler blokkert', 'Varsler ikke støttet', 'Varsler ikke aktivert', 'Slå på']) {
        assert.ok(account.includes(text), text);
    }
    assert.match(account, /onClick=\{onEnableNotifications\}/);
    assert.match(account, /<BellRinging size=\{16\}[^>]*aria-hidden="true"/);
    assert.match(header, /<AccountMenu user=\{isClientPreview \? null : user\} notificationPermission=\{notificationPermission\} onEnableNotifications=\{onEnableNotifications\}/);
    assert.match(app, /onEnableNotifications=\{requestCoachPushNotifications\}/);
    assert.match(app, /Systemvarsler er blokkert i nettleseren/);
});

test('archived count lives on the segment label', () => {
    assert.match(dashboard, /label: archivedClients\.length > 0 \? <>Arkivert <span className="tabular-nums">\{archivedClients\.length\}<\/span><\/> : 'Arkivert'/);
});

test('segments, search and sort share one row', () => {
    const toolbar = dashboard.slice(dashboard.indexOf('{/* One-row toolbar'), dashboard.indexOf('{searchOpen && ('));
    assert.match(toolbar, /<ToggleGroup/);
    assert.match(toolbar, /aria-label="Søk etter utøver"/);
    assert.match(toolbar, /aria-label="Sorter utøvere"/);
    assert.doesNotMatch(toolbar, /<TextField|<SelectField|<Button/);
    assert.doesNotMatch(dashboard, /SelectField/);
    assert.match(toolbar, /className="flex items-center gap-1"/);
});

test('search is a disclosure: aria state, autofocus, Escape and focus return, 16px input', () => {
    assert.match(dashboard, /aria-expanded=\{searchOpen\}/);
    assert.match(dashboard, /aria-controls="coach-search"/);
    assert.match(dashboard, /if \(searchOpen\) searchInputRef\.current\?\.focus\(\);/);
    const close = dashboard.slice(dashboard.indexOf('const closeSearch'), dashboard.indexOf('const toggleSearch'));
    assert.match(close, /setSearchTerm\(''\)/);
    assert.match(close, /setSearchOpen\(false\)/);
    assert.match(close, /searchButtonRef\.current\?\.focus\(\)/);
    assert.match(dashboard, /e\.key === 'Escape'/);
    // a live query keeps the field open instead of hiding the filter
    assert.match(dashboard, /else if \(searchTerm\.trim\(\)\) searchInputRef\.current\?\.focus\(\);/);
    const input = dashboard.slice(dashboard.indexOf('<input\n'), dashboard.indexOf('/>', dashboard.indexOf('<input\n')));
    assert.match(input, /text-base/);
    assert.doesNotMatch(input, /text-sm|text-xs/);
    assert.match(input, /placeholder="Søk etter utøver"/);
    assert.match(dashboard, /aria-label="Lukk søk"/);
    assert.match(dashboard, /<IconButton\s+ref=\{searchButtonRef\}/);
});

test('sort is a labelled native select overlay with the same options and logic', () => {
    const sort = dashboard.slice(dashboard.indexOf('<select'), dashboard.indexOf('</select>'));
    assert.match(sort, /aria-label="Sorter utøvere"/);
    assert.match(sort, /value=\{sortBy\}/);
    assert.match(sort, /text-base/);
    assert.match(sort, /<option value="unread">Uleste først<\/option>/);
    assert.match(sort, /<option value="lastCheckin">Siste ukesrapport<\/option>/);
    assert.match(sort, /<option value="name">Navn<\/option>/);
    assert.match(dashboard, /sortBy === 'lastCheckin'/);
    assert.match(dashboard, /sortBy === 'name'/);
    assert.match(dashboard, /focus-within:ring-2 focus-within:ring-accent/);
    assert.match(dashboard, /\[@media\(hover:hover\)_and_\(pointer:fine\)\]:hover:bg-surface-100/);
});

test('«Ny utøver» is a round plus icon button in the header, wired to the dashboard modal', () => {
    assert.match(header, /aria-label="Ny utøver"\s+onClick=\{onNewAthlete\}/);
    assert.match(header, /rounded-full bg-ink text-white/);
    assert.match(header, /min-h-11 min-w-11/);
    assert.match(header, /touch-manipulation/);
    assert.match(header, /<Plus size=\{20\} weight="bold" aria-hidden="true"/);
    assert.match(header, /\[@media\(hover:hover\)_and_\(pointer:fine\)\]:hover:bg-ink\/90/);
    assert.match(app, /onNewAthlete=\{requestNewAthlete\}/);
    assert.match(app, /newAthleteRequest=\{newAthleteRequest\}/);
    assert.match(dashboard, /seenNewAthleteRequest = useRef\(newAthleteRequest\)/);
    assert.match(dashboard, /if \(newAthleteRequest === seenNewAthleteRequest\.current\) return;/);
    assert.match(dashboard, /setShowModal\(true\)/);
    assert.doesNotMatch(dashboard, /if \(newAthleteRequest > 0\) setShowModal\(true\)/);
    assert.doesNotMatch(dashboard, /<Plus|>\s*Ny\s*<|«Ny»/);
    assert.match(dashboard, /Trykk på \+ øverst for å legge til en utøver\./);
    assert.match(dashboard, /id="new-athlete-title"[^>]*>Ny utøver</);
});

test('athlete cards are compact but keep 44px targets and existing styling', () => {
    const card = dashboard.slice(dashboard.indexOf('<Card\n                            key={client.id}'), dashboard.indexOf('<ClientActionsMenu\n                                    client'));
    assert.match(card, /px-3 py-1\.5 sm:px-4 sm:py-2/);
    assert.doesNotMatch(card, /\bp-3\b|sm:p-4/);
    assert.match(card, /min-h-11 min-w-11 flex-1/);
    assert.match(card, /w-10 h-10 shrink-0 rounded-xl/);
    assert.match(card, /text-base font-semibold/);
    assert.match(card, /<RecentActivityDot/);
    assert.match(card, /border-accent\/30 bg-accent\/5/);
    assert.match(card, /opacity-60/);
    assert.match(card, /<CaretRight/);
    assert.match(card, /block text-sm/);
    assert.match(dashboard, /<IconButton\s+type="button"\s+aria-label=\{`Flere handlinger for/);
    assert.match(dashboard, /duo:grid-cols-2/);
});

test('loading skeleton matches the compact card', () => {
    const skeleton = dashboard.slice(dashboard.indexOf('aria-label="Laster utøvere"'), dashboard.indexOf('Ingen treff'));
    assert.match(skeleton, /px-3 py-1\.5 sm:px-4 sm:py-2/);
    assert.match(skeleton, /w-10 h-10 bg-surface-200 rounded-xl/);
    assert.doesNotMatch(skeleton, /w-12 h-12|\bp-4\b/);
});

test('IconButton forwards refs for focus management', () => {
    assert.match(read('src/components/ui.jsx'), /export const IconButton = React\.memo\(React\.forwardRef\(/);
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
    assert.match(css, /\.plan-tab \{[^}]*border-radius: 9999px/);
    assert.match(css, /\.plan-tab \{[^}]*background: theme\('colors\.surface\.100'\)/);
    assert.match(css, /\.plan-tab\[aria-selected="true"\] \{[^}]*color: #fff;[^}]*background: theme\('colors\.ink\.DEFAULT'\)/);
    assert.match(css, /\.plan-tabs \{[^}]*gap: 0\.375rem/);
    assert.match(css, /background: Highlight/);
    assert.doesNotMatch(css.slice(css.indexOf('.plan-tabs {')), /::after|border-block-end/);
    assert.match(tabsBlock, /focus-visible:ring-offset-2/);
    assert.doesNotMatch(tabsBlock, /ring-inset/);
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
