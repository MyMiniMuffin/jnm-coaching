// iOS Safari / iPhone Duo hardening of the compact coach home (source-level checks).
// Duo CSS viewports are ASSUMED at 3x scale from Apple's published pixel sizes and are unverified
// on hardware: closed 466x678 (portrait) / 678x466 (landscape), open 626x890 / 890x626.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const header = read('src/components/Header.jsx');
const account = read('src/components/AccountMenu.jsx');
const mailbox = read('src/components/FormSubmissions.jsx');
const dashboard = read('src/views/CoachDashboard.jsx');
const ui = read('src/components/ui.jsx');
const css = read('src/index.css');
const app = read('src/App.jsx');
const vv = read('src/lib/visualViewport.js');

test('logout lives in the account menu, not as a header icon', () => {
    assert.doesNotMatch(header, /SignOut|aria-label="Logg ut"/);
    assert.match(account, /export default function AccountMenu\(\{ user, onLogout,/);
    assert.match(account, /\{user && onLogout && \(\s*<Button[^>]*aria-label="Logg ut"[^>]*onClick=\{\(\) => \{ setOpen\(false\); onLogout\(\); \}\}/);
    assert.match(account, /<SignOut size=\{18\} aria-hidden="true" \/> Logg ut/);
    // both the coach-home header and the viewing-client header pass it through
    assert.equal((header.match(/onLogout=\{isClientPreview \? undefined : onLogout\}/g) || []).length, 2);
});

test('header row never wraps: nowrap, truncating title, shrink-0 actions', () => {
    const coachRow = header.slice(header.indexOf('header-inner flex flex-nowrap items-center justify-between'));
    assert.match(coachRow, /^header-inner flex flex-nowrap/);
    assert.match(coachRow, /<p className="min-w-0 flex-1 truncate font-semibold text-ink">\{user\.name\}<\/p>/);
    assert.match(coachRow, /<div className="flex shrink-0 items-center gap-1">/);
    assert.match(header, /header-inner flex flex-nowrap items-center py-3 gap-1/);
    assert.doesNotMatch(header, /header-inner flex flex-wrap items-center py-3/);
});

test('sort overlay covers the whole 44px target, above the icon, 16px, opacity 0.01', () => {
    const sort = dashboard.slice(dashboard.indexOf('<select'), dashboard.indexOf('</select>'));
    for (const cls of ['absolute inset-0', 'z-10', 'min-h-11', 'min-w-11', 'h-full', 'w-full', 'text-base', 'opacity-\\[0\\.01\\]']) {
        assert.match(sort, new RegExp(cls), cls);
    }
    assert.doesNotMatch(sort, /opacity-0\b|text-sm|text-xs/);
    assert.match(sort, /aria-label="Sorter utøvere"/);
    assert.match(dashboard, /<ArrowsDownUp size=\{20\} aria-hidden="true" className="pointer-events-none"/);
    assert.match(css, /font-size: 16px !important;/);
});

test('search field clears the sticky header, scrolls into view and survives keyboard/resize', () => {
    assert.match(css, /\.coach-search-input \{[^}]*scroll-margin-top: calc\(env\(safe-area-inset-top, 0px\) \+ 5\.75rem\)/);
    assert.match(dashboard, /coach-search-input min-h-11/);
    assert.match(dashboard, /useKeepFieldVisible\(searchInputRef, searchOpen\)/);
    assert.match(vv, /export const useKeepFieldVisible/);
    assert.match(vv, /document\.activeElement === el/);
    assert.match(vv, /scrollIntoView\(\{ block: 'nearest'/);
    assert.match(vv, /window\.visualViewport/);
    const search = dashboard.slice(dashboard.indexOf('{searchOpen && ('), dashboard.indexOf('{/* Client List */}'));
    assert.doesNotMatch(search, /\bfixed\b|\bsticky\b/);
    assert.match(search, /text-base/);
});

test('fold/unfold cannot reset search, query or the new-athlete modal', () => {
    for (const [name, src] of [['Header', header], ['CoachDashboard', dashboard], ['FormSubmissions', mailbox]]) {
        assert.doesNotMatch(src, /key=\{[^}]*(shell|width|innerWidth|isRail|isNarrow|isDuo)/i, name);
        assert.doesNotMatch(src, /matchMedia|innerWidth|data-shell/, name);
    }
    assert.match(dashboard, /const \[searchOpen, setSearchOpen\] = useState\(false\)/);
    assert.match(dashboard, /const \[searchTerm, setSearchTerm\] = useState\(''\)/);
    assert.match(dashboard, /const \[showModal, setShowModal\] = useState\(false\)/);
    assert.doesNotMatch(app, /<CoachDashboard[^>]*\bkey=/);
    assert.doesNotMatch(app, /<Header[^>]*\bkey=/);
});

test('mailbox returns focus to its still-mounted trigger button when the panel closes', () => {
    assert.match(mailbox, /const triggerRef = useRef\(null\)/);
    assert.match(mailbox, /<IconButton\s+ref=\{triggerRef\}\s+data-testid="mailbox-trigger"/);
    assert.match(mailbox, /if \(wasPanelOpen\.current && !panelOpen\) triggerRef\.current\?\.focus\(\)/);
    // the trigger is rendered outside the portal, so it never unmounts with the panel
    assert.ok(mailbox.indexOf('ref={triggerRef}') < mailbox.indexOf('{panelOpen && createPortal('));
    assert.match(ui, /<button\s+ref=\{ref\}\s+type="button"/);
});

test('stacking and safe areas: toast > confirm > inbox; panels honor insets; zoom stays enabled', () => {
    assert.match(mailbox, /modal-backdrop fixed inset-0 z-50/);
    assert.match(account, /modal-backdrop fixed inset-0 z-\[150\]/);
    assert.match(account, /modal-scroll-panel/);
    assert.match(read('src/components/ConfirmDialog.jsx'), /z-\[200\]/);
    assert.match(read('src/components/Toast.jsx'), /z-\[300\]/);
    const backdrop = css.slice(css.indexOf('.modal-backdrop {'), css.indexOf('.modal-scroll-panel {'));
    for (const side of ['top', 'right', 'bottom', 'left']) {
        assert.match(backdrop, new RegExp(`env\\(safe-area-inset-${side}, 0px\\)`));
    }
    assert.match(css, /html\[data-shell="rail"\] \.app-frame:not\(\.app-frame-nav\) \.app-stage \{\s*padding-right: env\(safe-area-inset-right, 0px\);/);
    const html = read('index.html');
    // only the static meta tag: index.html also has an existing native-only zoom-lock script (see zoom-config tests)
    const meta = html.match(/<meta name="viewport"[^>]*>/)[0];
    assert.match(meta, /viewport-fit=cover/);
    assert.doesNotMatch(meta, /user-scalable|maximum-scale/);
});

test('hover is gated on coach-home controls, press feedback via :active', () => {
    const gate = /\[@media\(hover:hover\)_and_\(pointer:fine\)\]:hover:/g;
    for (const [name, src] of [['ui', ui], ['Header', header], ['AccountMenu', account], ['FormSubmissions', mailbox], ['CoachDashboard', dashboard]]) {
        const rest = src.replace(gate, '');
        assert.doesNotMatch(rest, /(^|[\s"'`])hover:/m, `${name} has ungated hover:`);
        assert.doesNotMatch(rest, /group-hover:/, name);
    }
    assert.match(ui.slice(ui.indexOf('export const IconButton')), /active:bg-surface-200/);
    assert.match(ui.slice(ui.indexOf('export const ToggleGroup')), /active:bg-white\/70/);
    assert.match(read('tailwind.config.mjs'), /hoverOnlyWhenSupported: true/);
    assert.match(css, /-webkit-tap-highlight-color: transparent/);
});

test('Duo uses the full physical display, not a centered 28rem phone band', () => {
    const start = css.indexOf('html[data-device="duo"] .app-shell');
    assert.ok(start >= 0, 'missing Duo frame unlock');
    const unlock = css.slice(start, start + 700);
    assert.match(unlock, /html\[data-device="duo"\] \.app-frame \{\s*max-width: none;/);
    assert.match(css, /html\[data-shell="rail"\] \.app-frame,\s*html\[data-shell="rail"\] \.app-shell \{\s*max-width: none !important;/);
});
