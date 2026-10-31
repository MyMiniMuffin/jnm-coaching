# iPhone Duo — plan (revidert etter plattform-review)

**Oppdatert:** 2026-10-30 (fase 2 / rail-nav + fiksrunde PR #13)  
**Utgangspunkt:** PR #10 / #11 + fase 1-audit.  
**Prinsipp:** Modeller domenet først · trekk fra før du legger til · gjenbruk eksisterende duo-infrastruktur.

---

## Plattform: WebKit / Viewport Segments

| API | Chrome/Edge | Safari / iOS / WKWebView |
|---|---|---|
| `@media (horizontal-viewport-segments)` | Støttet fra Chromium ~138 ([Can I use](https://caniuse.com/mdn-css_at-rules_media_horizontal-viewport-segments)) | **Ikke** i produksjon. Can I use: Safari / iOS Safari 27.x = ikke støttet. |
| `env(viewport-segment-*)` | Samme som over ([Viewport segments](https://caniuse.com/wf-viewport-segments)) | **Ikke** i produksjon. |
| `window.viewport.segments` | Støttet i Chromium | **Ikke** i produksjon. |

**WebKit-kilde:** [WebKit Features for Safari 27.1](https://webkit.org/blog/18486/webkit-features-for-safari-27-1/) (23. okt 2026) — Device Posture API og Viewport Segments API er *developer preview bak feature flags* (`Settings → Apps → Safari → Advanced → Feature Flags`). De er **ikke** på for vanlige brukere eller Capacitor/`WKWebView` uten eksplisitt flagg.

**Konsekvens for denne appen:** Segment-CSS som avhenger av `env(viewport-segment-*)` eller `horizontal-viewport-segments` er død kode på iOS. Hinge-bredden er ukjent i produksjon. Derfor:

- Ingen ny segment-geometri (`--fold-left`, segment-bredder, hinge-alignet shell) i denne PR-en.
- Fjernet den ubrukte `@media (horizontal-viewport-segments: 2)`-blokken som overskrev `--fold-gap`.
- Beholdt `--fold-gap: 1.25rem` som ren layout-fallback for `.duo-split-grid`.
- Fjernet `(horizontal-viewport-segments: 2)` fra `DESKTOP_QUERY`.

---

## Shell-modi (narrow / wide / rail)

Én tilstand eier alt: `src/lib/shellMode.js` (modul-singleton + `useSyncExternalStore`).

| Shell | Hvem | Navigasjon |
|---|---|---|
| `narrow` | Vanlige iPhoner / smal web | Bunnmeny |
| `wide` | iPad / desktop (≥1024 eller sticky media) | Venstre sidebar |
| `rail` | **Kun iPhone Duo** (lukket + utfoldet) | Flytende høyre-piller |

### Duo-deteksjon og `iPhone19,4`

Nativt i `DuoDevice.swift` via `utsname.machine`. Listen speiles i `src/lib/duoDeviceModels.js`.

**Deteksjon:** Fysisk Duo → `utsname.machine` (forventet `iPhone19,4`, [AppleDB](https://appledb.dev/device/identifier/iPhone19,4) / [IPSW.dev](https://ipsw.dev/iPhone19,4)). **iPhone Duo Simulator** → `uname` er host-arkitektur (`arm64`), så vi leser også `SIMULATOR_MODEL_IDENTIFIER` og `SIMULATOR_DEVICE_NAME` (navn som inneholder «Duo»). DEBUG logger `[DuoDevice] machine=… simName=…`. Ukjente fremtidige Duo-SKU-er må legges til i Swift + `duoDeviceModels.js`.

**Xcode Debug:** Tvinger Duo-rail som fallback. Opt-out: `-NoForceDuoDevice` / `JNM_FORCE_DUO=0`. Release/TestFlight tvinger aldri.

`DuoBridgeViewController` injiserer `html[data-device="duo"]` i `capacitorDidLoad()` på Capacitor sin **ekte** `userContentController` (før `loadWebView`). Scripts lagt kun i `webViewConfiguration(for:)` kastes — Capacitor bytter controller etterpå. Backup: `evaluateJavaScript` i `viewDidAppear`. `shellMode` observerer `data-device` med `MutationObserver`.

**Dev/test-override:** `?device=duo|phone` skriver til **sessionStorage** (aldri localStorage), så en delt lenke ikke låser vanlige brukere permanent. `syncDom` fjerner `data-device` ved `phone`-override.

- **Inn i wide (ikke-Duo):** `DUO_MEDIA_QUERY` matcher.
- **Ut av wide:** bredde &lt; 700, eller kald start uten media-match.
- **Sticky:** allerede wide + høyde krymper (tastatur) mens bredde ≥ 700 → forblir wide.
- **Rail:** overstyrer alltid når enheten er Duo (ingen venstre sidebar / bunnmeny), også ≥1024.

`duo:`-density: `wide` alltid; `rail` kun ved bredde ≥ 700 (lukket Duo 390 beholder telefon-tetthet). Swipe-tilbake beholdes på rail (rail er til høyre; `.app-rail-inner` stopper touch-propagering).

```text
DUO_MEDIA_QUERY =
  (min-width: 700px) and (min-height: 600px),
  (min-width: 1024px)
```

Ved modul-load (før første React-render) settes `html[data-shell]`. Samme attributt driver:

| Forbruker | Kilde |
|---|---|
| Shell-CSS | `html[data-shell="…"]` i `index.css` |
| Tailwind `duo:` | `wide` **eller** (`rail` + min-width 700) |
| `useDesktop` / `useShellWide` | kun `wide` (rail er ikke desktop) |

**Path-avhengighet (viktig):** sticky husker forrige wide-tilstand innen sesjonen, men kald start har ingen minne.

**Utfoldet layout:** Rail-shell fjerner telefon-`max-width` (28rem/48rem) og sentrert `header-inner`, så innholdet fyller hele Duo-vinduet minus rail. Tilbake-pillen får ekstra `--app-rail-status-clearance` under safe-area så den ikke overlapper Duo sin statusboble (wifi/tid) øverst til høyre.

| Viewport / path | Shell |
|---|---|
| 390×844 vanlig iPhone | Bottom nav (`narrow`) |
| 390×844 Duo (`?device=duo`) | Rail (telefon-tetthet) |
| 760×900 Duo | Rail + `duo:`-density + full bredde |
| 390×844 (lukket portrett, ikke Duo) | Bottom nav |
| 932×430 (lukket telefon landskap) | Bottom nav |
| 700×599 (kald start) | Bottom nav |
| 900×550 (kald start) | Bottom nav (media matcher ikke; ingen sticky) |
| 700×600 / iPad-portrett (ikke Duo) | Sidebar (`wide`) |
| 900×760 → 900×400 (tastatur) | Sidebar beholdes (sticky / `data-shell="wide"`) |
| 900×400 → 650×400 | Bottom nav (exit under 700) |
| 1280×550 (kort desktop) | Sidebar (`min-width: 1024px`) |
| ≥1024 med `?device=duo` | Rail (Duo vinner) |

`max-width` ved ≥1024 er **uendret** for ikke-Duo.

**Spesifisitet:** `duo:` er attributt-variant og slår `sm:` når begge matcher (f.eks. sticky 900×400 → rating forblir 2×5). Stablet `lg:duo:` får ikke lg-media med denne parent-varianten — bruk `duo-lg:` (wide/rail + ≥1024) der lg skal overstyre, f.eks. `duo:grid-cols-5 duo-lg:grid-cols-10`.

---

## Rail-design etter Apple HIG (2026-10-31)

Kilde: [Designing for iPhone Duo](https://developer.apple.com/design/human-interface-guidelines/designing-for-iphone-duo) (HIG, 9. sep 2026).

- **Side-kontroller:** ytterskjerm og innerskjerm i landskap har toolbar/tab bar langs siden. Øverst: Back/Close; nederst: faner. Kun symboler (tekstknapper hører hjemme i horisontale barer).
- **Innerskjerm i portrett:** HIG beholder vanlige horisontale barer. Rail blir en flytende bunnkapsel ved `(min-width: 700px) and (orientation: portrait)`; samme rekkefølge (tilbake først, så faner).
- **Kompakt:** kapsel 52px (44pt knapp + 4px), kant 6px, innholdsgap 8px → `--app-rail-reserve` ≈ 66px (før 76px).
- Ikke ennå: overflyt bottom-to-top når høyden ikke rekker (HIG `visibility priority`), jevnt antall kolonner rundt hengsel (`ReservedRegion` finnes bare nativt).

---

## Ekte Duo-simulator (Xcode 27.1, 2026-10-31)

- **Mål:** ytterskjerm 466×678, innerskjerm 951×669. Statuslinjen ligger i en høyre kolonne: `safe-area-inset-right` = 84pt, bunn 34pt.
- **Rail i statuskolonnen:** `--app-rail-col = max(safe-area-right, kapsel + 12px)`. Railen ligger *i* kolonnen under klokke/wifi (som Safari), og `.app-frame` dropper sin egen safe-area-padding (tidligere telt dobbelt → 228pt tapt bredde). Skjermer uten nav (coach-oversikt) reserverer bare statuskolonnen.
- **Frys ved folding (rotårsak):** `syncDom` i `shellMode.js` satte `data-device` på hver resize → egen `MutationObserver` → `recompute` → uendelig løkke. På Duo er hver fold en resize, så WKWebView frøs i gammel størrelse. Nå skrives attributter kun ved endring; regresjonstest i `iphone-duo-layout.mjs`.
- **Dobbelt vindu:** `SceneDelegate` lagde et eget `UIWindow` i tillegg til storyboardens → to Capacitor-bridger/WKWebViews. Nå eier `Main.storyboard` den ene.
- **Testtips:** fold med Device Hub (Closed/Open). `simctl io screenshot` viser innerskjermen etter fold — bruk Device Hub som fasit.

---

## Revidert P0 (implementert i fase 2)

1. Plattform-verifikasjon + fjern død segment-CSS; behold `--fold-gap`.
2. Duo-scope med min-høyde ~600px.
3. `PlanSection`: fjern `duo:grid-cols-2` (stable seksjoner); `min-w-0` + `break-normal` i sett/reps-tabell.
4. Tap targets under duo: sidebar `min-h-11`; historikk `duo:min-h-11`; rating 2×5 under duo (`duo:grid-cols-5`, `duo-lg:grid-cols-10`).
5. Padding: `duo:px-6` / `duo:py-*` der bare `lg:` fantes (arkiv-header, Dashboard/Coach hero); `duo-lg:` der ≥1024 skal vinne.
6. Login: ingen ny layout — `.login-card` forblir `max-w-sm` sentrert.

---

## P1 — oppfølging (utenfor denne PR-en)

- Hinge-alignet shell via **native-injisert** `html[data-duo]` / `--fold-left` fra native bridge (ikke WebKit segment-env).
- Master-detail-paneler, typografi-skalering, compare/galleri hinge-gutter.
- Marketing/onboarding fold-tilpasning.
- Bekreft `utsname.machine` på fysisk Duo og oppdater listen om nødvendig.

---

## Infrastruktur (én shell-tilstand)

| Del | Fil |
|---|---|
| Sticky store + `data-shell` | `src/lib/shellMode.js` |
| `DUO_MEDIA_QUERY` (entry) | `src/lib/duoBreakpoint.js` |
| `duo:` / `duo-lg:` attribute variants | `tailwind.config.mjs` (`addVariant`) |
| `useDesktop` → `useShellWide` (kun wide) | `src/hooks.jsx` |
| Wide shell CSS (én kopi) | `src/index.css` (`html[data-shell="wide"]`) |
| Rail CSS (Outlook-piller) | `src/index.css` (`html[data-shell="rail"]`) |
| `--fold-gap` + `.duo-split-grid` | `src/index.css` |
| Native Duo-deteksjon | `DuoDevice.swift`, `DuoBridgeViewController.swift` |
| Rail back-stack | `src/lib/railBack.jsx` |
| Nav/header | `Navigation.jsx`, `Header.jsx` |
| Tester | `tests/iphone-duo.mjs`, `tests/iphone-duo-layout.mjs`, `tests/duo-device.mjs` |
