// Kildekontrakter for bølgeovergangen (Distortion Waves) ved innsending.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const reveal = read('src/components/WaveReveal.jsx');
const wave = read('src/lib/wave.js');
const checkin = read('src/views/CheckInView.jsx');
const onboarding = read('src/onboarding/OnboardingPage.jsx');
const tailwind = read('tailwind.config.mjs');
const indexCss = read('src/index.css');
const pkg = read('package.json');

test('kontrolleren lastes dynamisk og aldri statisk', () => {
    assert.match(wave, /import\(\s*'\.\.\/vendor\/distortion-waves\/controller'\s*\)/);
    for (const [name, source] of Object.entries({ reveal, wave, checkin, onboarding })) {
        assert.doesNotMatch(source, /^import[^;]*vendor\/distortion-waves/m, `${name} importerer biblioteket statisk`);
    }
    assert.match(wave, /requestIdleCallback/);
    assert.match(wave, /setTimeout/);
});

test('WaveReveal følger Reduser bevegelse og tar bilde først ved innsending', () => {
    assert.match(reveal, /reducedMotion: 'system'/);
    assert.match(reveal, /prewarm: false/);
    assert.match(reveal, /if \(!armed\) return/);
    assert.match(reveal, /SAFETY_MS/);
    assert.match(reveal, /data-dw-layer="revealed"/);
    assert.doesNotMatch(reveal, /DistortionWave\b/);
});

test('paletten bruker bare tokenfarger', () => {
    const tokens = new Set(
        [...(tailwind + indexCss).matchAll(/#[0-9a-fA-F]{6}\b/g)].map((m) => m[0].toLowerCase())
    );
    const used = [...wave.matchAll(/#[0-9a-fA-F]{6}\b/g)].map((m) => m[0].toLowerCase());
    assert.ok(used.length >= 6);
    for (const hex of used) assert.ok(tokens.has(hex), `${hex} er ikke et token`);
    assert.match(wave, /export const JNM_WAVE_PALETTE/);
});

test('ukesrapporten avslører bare etter vellykket innsending', () => {
    assert.match(checkin, /revealed=\{phase === 'revealing'\}/);
    assert.match(checkin, /setPhase\('revealing'\)/);
    assert.equal(checkin.match(/setPhase\('revealing'\)/g).length, 1);
    assert.match(checkin, /saved === null/);
    assert.match(checkin, /catch \(error\)[\s\S]*setPhase\('idle'\)/);
    const app = read('src/App.jsx');
    assert.match(app, /setShowReauthPrompt\(true\);\s*return null;/);
    assert.match(app, /return savedCheckin;/);
});

test('onboarding avslører bare etter vellykket POST', () => {
    assert.match(onboarding, /revealed=\{status === 'revealing'\}/);
    assert.equal(onboarding.match(/setStatus\('revealing'\)/g).length, 1);
    const revealAt = onboarding.indexOf("setStatus('revealing')");
    const okAt = onboarding.indexOf("if (!response.ok) throw");
    assert.ok(okAt > 0 && okAt < revealAt);
    assert.doesNotMatch(onboarding, /scrollTo\(\{ top: 0, behavior: 'smooth' \}\);\s*\}\s*catch/);
});

test('anchorTop er lat, kvitteringen klemmes ikke og holdet slippes', () => {
    assert.match(reveal, /getAnchorTop/);
    assert.doesNotMatch(reveal, /anchorTop = 0/);
    assert.doesNotMatch(reveal, /Math\.min\(wanted, room\)/);
    assert.match(checkin, /getAnchorTop=\{\(\) => stickyHeaderBottom\(/);
    assert.match(onboarding, /getAnchorTop=\{\(\) => stickyHeaderBottom\(/);
    assert.doesNotMatch(checkin + onboarding, /\banchorTop=\{/);
    assert.match(wave, /addEventListener\('scroll'/);
    assert.match(wave, /removeEventListener\('scroll'/);
});

test('kvitteringen annonseres via vedvarende live-region og får fokus', () => {
    assert.match(checkin, /className="sr-only" role="status" aria-live="polite"/);
    assert.match(onboarding, /className="sr-only" role="status" aria-live="polite"/);
    assert.doesNotMatch(checkin, /<div ref=\{ref\} role="status"/);
    assert.doesNotMatch(onboarding, /onboarding-success" role="status"/);
    assert.match(checkin, /noteRef\.current\?\.focus\(\{ preventScroll: true \}\)/);
    assert.match(onboarding, /headingRef\.current\?\.focus\(\{ preventScroll: true \}\)/);
});

test('utkastet slettes med en gang serveren har lagret, ikke først etter bølgen', () => {
    const submit = checkin.slice(checkin.indexOf('const handleSubmit'));
    const objectBranch = submit.slice(submit.indexOf("typeof saved === 'object'"), submit.indexOf("setPhase('revealing')"));
    assert.match(objectBranch, /clearDraft\(\)/);
    assert.match(checkin, /const clearDraft = useCallback\(\(\) => \{\s*try \{ localStorage\.removeItem\(storageKey\)[\s\S]*?setRestoredDraft\(false\)/);
    const finish = checkin.slice(checkin.indexOf('const finishSubmit'), checkin.indexOf('const handleWaveFinish'));
    assert.match(finish, /setComposing\(false\)/);
    assert.match(finish, /setFormData\(INITIAL_FORM_DATA\)/);
    assert.match(checkin, /!showForm \|\| phaseBusy\) return;/);
});

test('innsending avvises mens fasen er sending eller revealing', () => {
    assert.match(checkin, /phaseRef\.current = phase/);
    assert.match(checkin, /phaseRef\.current === 'sending' \|\| phaseRef\.current === 'revealing'/);
    assert.match(onboarding, /statusRef\.current = status/);
    assert.match(onboarding, /statusRef\.current === 'submitting' \|\| statusRef\.current === 'revealing'/);
});

test('rail-tilbake er av under innsending og bølge', () => {
    assert.match(checkin, /useRegisterRailBack\('checkin-compose', Boolean\(composing && thisWeekReport && !hideForm && !phaseBusy\)/);
});

test('live-regionen står sist i containeren og teksten har mellomrom', () => {
    assert.match(checkin, /(?:<\/div>|\)\})\s*<p className="sr-only" role="status"[^\n]*\n\s*<\/div>\s*\);\s*\}\);/);
    assert.match(checkin, />Denne sendes i tillegg til ukesrapporten du allerede har sendt\.</);
});

test('testene er med i test:unit', () => {
    assert.match(pkg, /"test:unit": "[^"]*tests\/wave-reveal\.mjs/);
});
