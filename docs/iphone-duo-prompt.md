# Prompt: iPhone Duo — rail-meny foldet og utfoldet

Kopier alt under streken inn til agenten.

---

Du jobber i `jnm-coaching` (React + Vite + Tailwind, pakket med Capacitor til iOS). Målet er at appen fungerer helt på **iPhone Duo**, både **foldet** (én smal skjerm) og **utfoldet** (stor skjerm). På begge skal navigasjonen bruke Duo-menystilen: en **flytende kolonne med piller langs høyre kant** (Outlook-stil), ikke bunnmeny og ikke venstre sidebar.

## Les dette først (finnes allerede, bygg videre på det, ikke lag det på nytt)

- `docs/iphone-duo-plan.md`: plattformfakta, shell-modi og hvilke beslutninger som er tatt. **Viktig:** WebKit/WKWebView støtter *ikke* Viewport Segments / Device Posture i produksjon, så hengselposisjon og segmenter er ukjente. Ikke bruk `env(viewport-segment-*)` eller `horizontal-viewport-segments`.
- `src/lib/shellMode.js`: én tilstand `narrow | wide | rail`. Duo får `rail` kun i landskapsform + wide-terskel (`DUO_RAIL_MEDIA_QUERY`); portrett-Duo bruker bunnmeny. Den setter `html[data-shell]`.
- `src/lib/duoBreakpoint.js`, `tailwind.config.mjs`: variantene `duo:` (wide, eller rail ≥700px) og `duo-lg:`.
- `src/components/Navigation.jsx`: `.app-rail`, `.app-rail-inner`, `.app-rail-pill`, tilbake-pillen øverst.
- `src/index.css` (søk etter `data-shell="rail"`): rail-CSS, `--app-rail-width` / `--app-rail-reserve`, og plass til save-bar og toasts.
- `src/lib/railBack.jsx` + `getBackAction()` i `src/App.jsx`: én felles tilbake-handling for header, sveip og rail.
- Native: `ios/App/App/DuoDevice.swift`, `DuoBridgeViewController.swift`, `src/lib/duoDeviceModels.js` (`decideIsDuo`). Simulator-only force: `-ForceDuoDevice` / `JNM_FORCE_DUO=1` under `#if targetEnvironment(simulator)` (fysisk Debug-iPhone ignorerer alltid). Aldri prefiks-match på `iPhone19` — 18 Pro er `iPhone19,2`.
- Tester: `tests/iphone-duo.mjs`, `tests/iphone-duo-layout.mjs`, `tests/duo-device.mjs`.

Start med å kjøre appen med `?device=duo` på viewportene under. Skriv ned hva som er feil eller mangler **før** du endrer noe.

## Krav: foldet (smal, omtrent 390×844 portrett og 844×390 landskap)

1. Railen står til høyre, bunnmenyen er skjult, og telefon-tettheten beholdes (ingen `duo:`-density under 700px).
2. Pillene viser bare ikoner, med `aria-label` og tooltip/long-press-label. Treffflaten er minst 44×44 pt. Aktiv fane skal være tydelig markert.
3. Tilbake-pillen ligger øverst når du er inne i en undervisning (drill-down), og bruker samme `getBackAction()`.
4. **Overflyt:** Hvis det ikke er plass til alle pillene i høyden (landskap, tastatur oppe), legg resten bak en «Mer»-pille med et ark eller en meny. Ingen piller skal klippes eller havne under safe area.
5. Innholdet skal aldri ligge under railen: `--app-rail-reserve` skal gjelde for alle views, modaler, bunnark, sticky save-bars, FAB-er, toasts og fullskjermsvisninger (galleri/sammenligning). Gå gjennom alle views i `src/views/`.
6. Tastaturet: railen skal ikke hoppe eller dekke input når tastaturet åpnes. Skjul eller kompakter den om nødvendig, og test sjekk-inn og chat/meldingsfelt.
7. Sveip tilbake fra venstre kant skal fortsatt virke.

## Krav: utfoldet (bred, omtrent 760×900 og 900×760 – bruk begge)

1. Følg [Apple HIG for iPhone Duo](https://developer.apple.com/design/human-interface-guidelines/designing-for-iphone-duo): i landskap står railen til høyre, og i portrett blir den en horisontal kapsel nederst. Det skal ikke være noen venstre sidebar. Pillene viser bare symboler, ikke tekst.
2. Innholdet bruker `duo:`- og `duo-lg:`-density og bruker bredden fornuftig. Ingen strukket tekstlinje over hele bredden: sett maks lesebredde på tekstinnhold, og la grids/lister bruke flere kolonner der det gir mening (dashboard, galleri, coach-oversikt).
3. Siden hengselen er ukjent, skal ingen viktige knapper, inputfelt eller bildekanter ligge midt på skjermen ved et tilfelle. Bruk `--fold-gap` / `.duo-split-grid` for to-kolonne-layout, så midten blir en gutter.
4. Modaler og ark skal ha en fornuftig maksbredde og være sentrert i innholdsområdet (venstre for railen), ikke strukket over hele skjermen.

## Krav: overgang mellom foldet og utfoldet

- Folding og utfolding mens appen er åpen skal skje live uten reload: samme rute, samme scrollposisjon (så godt det lar seg gjøre), åpne skjemaer beholder data, og ingen blink av bunnmeny eller sidebar underveis.
- Bekreft at `shellMode` reagerer på `resize`/`orientationchange`, og at `duo:` slår av og på riktig rundt 700px.

## Må ikke endres

- Vanlig iPhone (bunnmeny), iPad og desktop (sidebar) skal oppføre seg nøyaktig som før. Path-tabellen i `docs/iphone-duo-plan.md` må fortsatt stemme.
- Ingen nye avhengigheter uten god grunn.

## Native / Xcode

- Bygg i Xcode med `-ForceDuoDevice` og test både foldet og utfoldet størrelse (bruk en iPad- eller stor simulator for utfoldet hvis det ikke finnes en Duo-simulator, og si fra hva du brukte).
- Hvis det finnes en Duo-simulator eller et SDK-API for fold-tilstand i Xcode: bruk det. Vurder å injisere `html[data-duo-posture="folded|unfolded"]` nativt fra `DuoBridgeViewController` hvis UIKit gir et pålitelig signal. Ellers skal bredde være kilden.
- Ikke endre Release-oppførselen til `-ForceDuoDevice`, som skal ignoreres i Release.

## Tester og verifisering

- Utvid `tests/iphone-duo-layout.mjs` (Playwright) med disse Duo-viewportene: 390×844, 844×390, 760×900, 900×760, og en overgang 390→760→390 i samme side. Sjekk at:
  - railen er synlig, og bunnmeny og sidebar er skjult
  - ingen interaktive elementer overlapper railen (bounding-box-test på alle views)
  - «Mer»-pillen dukker opp i 844×390
  - tilbake-pillen virker
  - 44px treffflater
- Sørg for at testene for ikke-Duo-viewport fortsatt passerer.
- Kjør `node --test tests/*.cjs tests/*.mjs` og `npm run build`. Begge skal passere.
- Ta skjermbilder av hver viewport (foldet portrett, foldet landskap, utfoldet portrett og utfoldet landskap) og legg dem ved i svaret.

## Leveranse

- Oppdater `docs/iphone-duo-plan.md`: hva som er gjort, hva som fortsatt er P1, og hvilke antakelser du har tatt om skjermstørrelser.
- Commit og push direkte til `main` etter CLAUDE.md (ingen branch/PR, ingen Claude-attribusjon).
- Avslutt med en kort liste over hva som er verifisert i nettleser, hva som er verifisert i Simulator, og hva som bare kan bekreftes på en fysisk Duo (f.eks. `utsname.machine`, faktisk hengselposisjon).
