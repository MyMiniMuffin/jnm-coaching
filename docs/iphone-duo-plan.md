# iPhone Duo — Fase 1 audit og prioritert plan

**Dato:** 2026-10-30  
**Scope:** Kun audit + plan (ingen produktkode i denne fasen).  
**Utgangspunkt:** PR #10 (Duo-infrastruktur) og #11 (cascade/padding/fold-gap-oppfølging).  
**Prinsipp:** Modeller domenet først · trekk fra før du legger til · gjenbruk eksisterende duo-infrastruktur.

---

## 1. Eksisterende infrastruktur (gjenbruk — ikke nye lag)

| Del | Fil | Rolle |
|---|---|---|
| Breakpoint `duo: 700px` | `tailwind.config.js` | Unfolded-bredde mellom `sm` og `md` |
| `DESKTOP_QUERY` / `useDesktop` | `src/hooks.jsx` | `(min-width: 700px), (horizontal-viewport-segments: 2)` — skrur av swipe/pull |
| `--fold-gap` + segment-media | `src/index.css` | Default `1.25rem`; med 2 horisontale segments = hinge-bredde via `env(viewport-segment-*)` |
| `.duo-split-grid` | `src/index.css` | Setter `column-gap: var(--fold-gap)` |
| Shell @700 / @1024 | `src/index.css` | Sidebar 12.5rem → 15.5rem, stage/content, save-bar `left` |
| Nav/header chrome | `Navigation.jsx`, `Header.jsx` | Sidebar `duo:flex` / bottom nav `duo:hidden` |
| View-tilpasninger | Coach/Plan/Dashboard/CheckIn/Gallery/Weight | Delvis `duo:` + noen `duo-split-grid` |
| iOS scene | `SceneDelegate.swift`, LaunchScreen, Info.plist | Relayout ved unfold; portrett+landskap |
| Regresjonstester | `tests/iphone-duo.mjs` | Breakpoint, CSS, klasser, iOS |

**Mangler i domenemodellen i dag:** geometri for *hvor* hinge/segmentene ligger relativt til sidebar + innhold. `--fold-gap` styrer bare *avstand mellom grid-kolonner*, ikke at kolonnegrensen treffer fysisk hinge.

---

## 2. Audit-metode

App kjørt lokalt (`npm run dev`). Skjermbilder i tre moduser med mock-session/API (ingen produktendring):

| Modus | Viewport | Fold-sim |
|---|---|---|
| Lukket | 390×844 | Nei |
| Utfoldet portrett | 760×900 | Rød hinge-overlay midt i viewport + `--fold-gap` |
| Utfoldet landskap | 900×760 | Samme |

Viktige flater: login, coaching-landing, oppstart, athlete hjem/galleri/sammenlign/mat/trening/rapport, coach-dashboard + klientvisning. Artifacts: `/opt/cursor/artifacts/iphone-duo-audit/` (se sluttrapport).

Målinger (Playwright): sidebar 200px @duo; bottom nav skjult ≥700; sidebar-nav `h≈40` (<44); rating-knapper ≈43×44; `duo-split-grid` på trening får kolonner ~223px (portrett) / ~293px (landskap).

---

## 3. Rotårsak (domene)

```
[ segment 0 | hinge | segment 1 ]   ← fysisk Duo / viewport midtpunkt
[ sidebar 200px |     stage (innhold full bredde)     ]
                      ↑ hinge skjærer midt i stage
```

Ved 760px er hinge ≈380px fra venstre. Sidebar tar 0–200px. Stage (200–760) har hinge ~180px inn i innholdet. `.duo-split-grid` med to like kolonner plasserer sitt gap midt i *stage*, ikke midt i *viewport* — gap og hinge treffer ikke hverandre. Fullbredde-kort/skjema/login sentreres over hinge.

**Konsekvens:** Mer `duo:grid-cols-2` uten segment-geometri forverrer klemming (treningsplan) uten å løse hinge-kollisjon. Trekk fra feilplasserte to-kolonne-layouts før du legger til flere.

---

## 4. Domenemodell (før UI-fikser)

Én geometri-kilde i CSS (utvid `src/index.css`, ikke nytt abstraksjonslag):

```text
--fold-left      : midtpunkt / env(viewport-segment-left 1 0)
--fold-gap       : allerede finnes
--segment-0-width / --segment-1-width : env(...) med fallback @duo
--shell-chrome   : sidebar-bredde (0 lukket, 12.5rem duo, 15.5rem lg)
--content-in-segment-0 : max(0, segment-0 − chrome)
```

**Layoutstrategier (velg per flate, gjenbruk klasser):**

1. **`duo-pane-single`** — alt primærinnhold i ett segment (typisk segment 1 når sidebar fyller/deler segment 0). Ingen fullbredde over hinge.
2. **`duo-split-grid` (forbedret)** — to paneler der gap *sammenfaller* med hinge (grid-template basert på segment-bredder, ikke `1fr 1fr` i stage alene).
3. **`duo-stack`** — én kolonne i stage når to kolonner blir < ~280px nyttig bredde (trekk fra `duo:grid-cols-2` på plan-seksjoner).

Shell-regel: ved `(horizontal-viewport-segments: 2)` (og speilet fallback `@media (min-width: 700px) and (max-width: 1023px)` for simulator): sidebar skal ikke «stjele» bare deler av segment 0 uten at innholdets hinge-matematikk oppdateres. Foretrukket: **sidebar bredde = segment 0** (chrome fyller venstre skjerm), stage = segment 1 — da forsvinner hinge fra midten av kortene. Alternativ hvis chrome skal være smalere: beholde 12.5rem men tvinge stage-innhold til `duo-pane-single` / segment-alignet split.

---

## 5. Prioritert plan

### P0 — Blokkerer lesbarhet / hinge midt i primær UI

#### P0.1 Shell: segment-alignert chrome + stage
- **Filer:** `src/index.css`, evt. `Navigation.jsx` (ingen ny shell-komponent)
- **Problem:** Sidebar 12.5rem + full stage → hinge gjennom alt innhold (hjem, rapport, login, coach-banner, søk).
- **Løsning:** Under dual-segment / duo-bredde: sett `.app-sidebar { width: var(--segment-0-width, 12.5rem) }` **eller** eksplisitt `width: env(viewport-segment-width 0 0)` med fallback; `.app-stage` begrenses visuelt til segment 1 via margin/width fra `--fold-left` + `--fold-gap`. Oppdater `.app-frame-nav .plan-save-bar { left: … }` til samme chrome-bredde. Speil fallback uten ekte segments (DevTools/simulator) med `@media (min-width: 700px)`.
- **Trekk fra:** Unngå parallell «fold layout manager» i JS; `useDesktop` beholder kun gesture-gate.

#### P0.2 Login sentrert over hinge
- **Filer:** `src/components/LoginScreen.jsx`, `src/index.css` (`.login-page` / `.login-card`)
- **Problem:** Ikon, tittel, felter og CTA deles midt over i unfolded.
- **Løsning:** `@media (min-width: 700px)` / segments: plasser `.login-card` i ett pane (høyre eller venstre segment) med `max-w-sm`; ikke `items-center` over hele viewport-bredden. Evt. brand i segment 0, skjema i segment 1 (`duo-split` uten å strekke input over hinge).
- **Trekk fra:** Ingen ekstra marketing-layout på login.

#### P0.3 Dashboard: fullbredde-kort over hinge
- **Filer:** `src/views/DashboardView.jsx`
- **Problem:** Periode-hero, «Din reise» (4-kolonne stats), uke-CTA og total-endring skjæres; `grid-cols-2` quick actions har `gap-4` (16px) < meningsfull hinge når kortene ligger midt i stage.
- **Løsning:** Etter P0.1 (stage i ett segment) er mye løst. Hvis stage fortsatt spenner to segments: bruk `duo-split-grid` kun på quick-actions med gap = `--fold-gap`, og hold hero + «Din reise» som `duo-stack` (én kolonne) — **ikke** gjeninnfør fjernet `duo:grid-cols-2` rundt reise/uke (#11).
- **Trekk fra:** Bekreft at #11-fjerningen av reise-wrapper forblir.

#### P0.4 Trenings-/matplan: ødelagt to-kolonne under duo
- **Filer:** `src/views/PlanSection.jsx` (ca. linje med `duo:grid duo:grid-cols-2 … duo-split-grid`)
- **Problem:** To seksjonskolonner à ~223px; sett/reps-tabell (`grid-cols-[minmax(0,1fr)_3.75rem_5rem]`) klemmer øvelsesnavn; hinge skjærer fortsatt gjennom «Dag 1»-tabellen fordi split ikke er segment-alignet.
- **Løsning:** **Trekk fra** `duo:grid-cols-2` på seksjonslisten inntil stage er ett segment *eller* erstatt med segment-template. Kort sikt: `duo:grid-cols-1` (stack) når nyttig kolonnebredde < ~280px; behold `duo-split-grid` kun når begge paneler lander i hvert sitt segment. Tabell: `min-w-0` + unngå `break-words` som fragmenterer navn; evt. stable sett/reps under navn under `max-sm` / smal kolonne.
- **Tester:** Oppdater `tests/iphone-duo.mjs` forventning hvis klasseendring.

#### P0.5 Galleri sammenlign + galleri-grid over hinge
- **Filer:** `src/views/GalleryView.jsx`, evt. compare-CSS i `src/index.css`
- **Problem:** Før/etter-kort møtes i midten med for lite gutter; meta-rad og «Se i fullskjerm» er fullbredde over hinge; i grid lander et bildekort *på* hinge.
- **Løsning:** Compare-rad: `grid-cols-2` + `column-gap: var(--fold-gap)` (samme mønster som `.duo-split-grid`); CTA/meta enten stack (`grid-cols-1`) eller to celler med fold-gap. Thumb-grid: bruk `duo:grid-cols-*` slik at ingen cell sentreres på `--fold-left` (odd antall kolonner er risikabelt når hinge ≈ midt). Fullskjerm-compare (`safe-area` finnes): vurder pane-split per segment i unfolded.

#### P0.6 Rapportskjema: inputs og skala over hinge
- **Filer:** `src/views/CheckInView.jsx`, `src/components/ui.jsx` (`ToggleGroup` / rating)
- **Problem:** Vektfelt, 1–10-skalaer, sticky save-bar og kommentar krysser hinge; skala-knapper ~43px brede.
- **Løsning:** Etter P0.1: skjema i ett pane. Ellers: del skjema i to paneler (venstre: vekt+skalaer, høyre: økter+toggles+kommentar) med `duo-split-grid`. Sticky bar: ikke én sentrert tekst+knapp over hinge — `duo:flex` med gap/`justify-between` per pane, eller bar kun i segment 1. Rating: sørg for `min-w-[44px]` (ikke bare `min-h`).

#### P0.7 Coach-dashboard: banner, søk og klientkort i hinge
- **Filer:** `src/views/CoachDashboard.jsx`
- **Problem:** Sletteforespørsel-banner og hero «Utøvere» fullbredde; søkefelt kuttet; `duo-split-grid` på klientliste aligner ikke med viewport-hinge (samme rotårsak).
- **Løsning:** P0.1 først. Deretter: søk+sort i én rad som ikke krysser hinge (stack under duo, eller split med fold-gap). Klientgrid: behold `duo-split-grid` men koble til segment-template; hero/stats: unngå tekst midt i fullbredde — `duo:flex` med blokker i hver ende er OK hvis midten er tom (gap).

---

### P1 — Utnyttelse, marginer, tap targets, overgang

#### P1.1 Typografi og tetthet @duo
- **Filer:** `DashboardView.jsx`, `Header.jsx`, `PlanSection.jsx`, `index.css`
- **Problem:** Display-titler og body skalerer ikke med bredde; unfolded portrett føles som «utstrakt mobil».
- **Løsning:** Bruk eksisterende tokens: `duo:text-*` / `duo:leading-*` sparsomt på hero-titler; ikke nytt typescale-system. Begrens linjelengde (`max-w-prose` / content max) inne i pane.

#### P1.2 Ujevne marginer og letterboxing
- **Filer:** `src/index.css` (`.app-content`, 640–699 boxed frame, ≥1024 `max-width: 56rem`)
- **Problem:** Hopp i padding `1rem` → `1.25rem 1.5rem` → `1.75rem 2rem`; ved ≥1024 smalnes content til 56rem (fra 68) — merkbart ved unfold→desktop. Arkiv-header i `App.jsx` bruker `lg:px-8` uten `duo:`.
- **Løsning:** Harmoniser horizontal padding med `duo:px-6 lg:px-8` (samme mønster som Header/Plan). Vurder å ikke redusere max-width mellom 700 og 1024. Fiks arkiv-header til `duo:px-6 duo:py-3.5 lg:px-8 lg:py-4`.

#### P1.3 Tap targets < 44px
- **Filer:** `Navigation.jsx` (sidebar `py-2.5` → høyde ~40), `ui.jsx` rating (`min-h-[44px]` men bredde ~43 i smal rad), CheckIn historikk-rad `h≈40`
- **Løsning:** Sidebar-lenker: `min-h-11`. Rating: `min-w-[44px]` + gap som tillater det (evt. `grid-cols-5` wrap på smal pane i stedet for 10 i én rad). Historikk-rader: `min-h-11`.

#### P1.4 Layout-hopp lukket ↔ utfoldet
- **Filer:** `Navigation.jsx`, `hooks.jsx`, views med `pb-32 duo:pb-8`
- **Problem:** Bottom nav ↔ sidebar unmount/hide endrer padding og scroll-anchoring; hero-padding hopper `lg:` uten duo-steg (`CoachDashboard` / `DashboardView` `lg:px-7`).
- **Løsning:** Behold CSS `hidden duo:flex` (ikke remount routes). Legg `duo:`-mellomsteg der bare `lg:` finnes. Verifiser at `activeTab` / skjemastate bevares (allerede via App state — ingen router). Valgfritt: `content-visibility` / unngå `display:none` på scroll-container hvis hopp observeres (mål før endring).

#### P1.5 Safe-area vs fold
- **Filer:** `src/index.css`, `ImageModal.jsx`, `GalleryView.jsx`
- **Problem:** Horisontal safe-area på `.app-frame` / `.mobile-bottom-nav` er på plass; fold er *ikke* safe-area. I landskap kan home-indicator + fold samvirke. ImageModal bruker egne insets, ikke segments.
- **Løsning:** Behandle fold via segment-variabler (P0.1), ikke bland inn i `safe-area-inset-*`. Documenter invariant i denne filen. Fullscreen viewers: ved 2 segments, begrens chrome til segment-kanter.

#### P1.6 Landskap spesifikke paneler
- **Filer:** `DashboardView.jsx`, `CheckInView.jsx`, `GalleryView.jsx`
- **Problem:** 900×760 med sidebar gir lav stage-høyde; lange skjema krever mye scroll; compare-kort er høydebegrenset (`max-w-[min(42vh,22rem)]`) — OK, men tomrom under utnyttes dårlig.
- **Løsning:** I landskap/duo: master-detail der det er naturlig (rapport liste | skjema; galleri thumbs | compare) med eksisterende state — ikke nye routes. Kun hvis P0.1 gir to brukbare paner.

---

### P2 — Polering og sekundære flater

#### P2.1 Marketing / onboarding
- **Filer:** `src/coaching/CoachingLandingPage.jsx`, `src/onboarding/OnboardingPage.jsx`, `onboarding.css`
- **Problem:** Tung `md:`/`lg:`; ingen duo/fold. Lavere prioritet (ikke innlogget app-shell).
- **Løsning:** Etter app-shell: speil login-strategi (innhold i pane); unngå full-bleed tekst over hinge.

#### P2.2 WeightProgressView
- **Filer:** `src/views/WeightProgressView.jsx`
- **Problem:** Primært `duo:pb-8` + chart ticks; lite hinge-spesifikt. Metrics `grid-cols-2` kan krysse hinge hvis stage spenner.
- **Løsning:** Samme pane-regel som dashboard; chart full bredde *inne i* pane.

#### P2.3 Toast / floating chrome
- **Filer:** `src/components/Toast.jsx`, `index.css` (`.toast-stack`)
- **Problem:** Fast midt-nederst kan lande nær hinge i dual-landscape.
- **Løsning:** Forskyv toast til segment 1 midt/bunn via `left`/`right` fra segment-env.

#### P2.4 Simulator / DevTools for hinge
- **Filer:** `tests/iphone-duo.mjs`, evt. kort snutt i `docs/` eller Story-agnostisk CSS fallback
- **Problem:** Chromium mangler ofte ekte `horizontal-viewport-segments`.
- **Løsning:** Behold CSS-fallbacks @700–1023; utvid tester til å assert’e segment-CSS-variabler / sidebar-bredde-regel / fravær av `duo:grid-cols-2` på plan når stack er valgt. Ingen Playwright i CI-produktkrav med mindre ønsket senere.

#### P2.5 Coach søk-grid uten duo-steg
- **Filer:** `CoachDashboard.jsx` (`sm:grid-cols-[1fr_12rem] lg:grid-cols-[…]`)
- **Løsning:** Legg `duo:`-kolonnebredder; gap = `--fold-gap` når to kolonner speiler segments.

---

## 6. Anbefalt rekkefølge (implementasjonsfaser etter denne auditen)

1. **Geometri + shell (P0.1)** — låser hingematte for alle views.  
2. **Trekk fra skadelig duo-two-col (P0.4)** — plan lesbar igjen.  
3. **Login + dashboard + coach chrome (P0.2, P0.3, P0.7)** — kritiske first screens.  
4. **Galleri + rapport (P0.5, P0.6)** — interaksjonstunge flater.  
5. **P1 tap targets, padding, hopp, landskap.**  
6. **P2 polering + tester.**

Hver del-PR: oppdater `tests/iphone-duo.mjs`, kjør `node --test tests/*.cjs tests/*.mjs` og `npm run build`. Ta nye skjermbilder i samme tre moduser før merge.

---

## 7. Explicit non-goals (fase 2+)

- Ny design-systempakke eller eget FoldProvider-rammeverk.
- Endre breakpoints bort fra `duo: 700px` uten ny audit.
- Native iOS split-view API utenom allerede levert SceneDelegate-relayout.
- Redesign av coaching-landing før app-shell P0 er ferdig.

---

## 8. Kort sjekkliste for «ferdig» Duo-flate

- [ ] Ingen primærtekst eller primær CTA krysser `--fold-left` ± `--fold-gap`/2  
- [ ] Interaktive target ≥ 44×44 CSS-px  
- [ ] Plan-tabeller lesbare (ingen én-bokstav-linjer)  
- [ ] Lukket 390 og unfolded 760/900 beholder samme tab/skjemastate  
- [ ] `tests/iphone-duo.mjs` grønn + manuelle artifacts oppdatert  
