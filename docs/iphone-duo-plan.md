# iPhone Duo — plan (revidert etter plattform-review)

**Oppdatert:** 2026-10-30 (fase 2 / revidert P0)  
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

## Duo-scope (bredde + høyde)

Én tilstand eier alt: `src/lib/shellMode.js` (modul-singleton + `useSyncExternalStore`).

- **Inn i wide:** `DUO_MEDIA_QUERY` matcher (`src/lib/duoBreakpoint.js`).
- **Ut av wide:** bredde &lt; 700, eller kald start uten media-match.
- **Sticky:** allerede wide + høyde krymper (tastatur) mens bredde ≥ 700 → forblir wide.

Ved modul-load (før første React-render) settes `html[data-shell="wide"|"narrow"]`. Samme attributt driver:

| Forbruker | Kilde |
|---|---|
| Shell-CSS | `html[data-shell="wide"] …` i `index.css` (én kopi) |
| Tailwind `duo:` | `addVariant('duo', 'html[data-shell="wide"] &')` |
| `useDesktop` | `useShellWide()` (alle instanser samme store) |

```text
DUO_MEDIA_QUERY =
  (min-width: 700px) and (min-height: 600px),
  (min-width: 1024px)
```

**Path-avhengighet (viktig):** sticky husker forrige wide-tilstand innen sesjonen, men kald start har ingen minne.

| Viewport / path | Shell |
|---|---|
| 390×844 (lukket portrett) | Bottom nav |
| 932×430 (lukket telefon landskap) | Bottom nav |
| 700×599 (kald start) | Bottom nav |
| 900×550 (kald start) | Bottom nav (media matcher ikke; ingen sticky) |
| 700×600 / iPad-portrett / Duo unfolded | Sidebar |
| 900×760 → 900×400 (tastatur) | Sidebar beholdes (sticky / `data-shell="wide"`) |
| 900×400 → 650×400 | Bottom nav (exit under 700) |
| 1280×550 (kort desktop) | Sidebar (`min-width: 1024px`) |

`max-width` ved ≥1024 er **uendret**.

**Spesifisitet:** `duo:` er attributt-variant og slår `sm:` når begge matcher (f.eks. sticky 900×400 → rating forblir 2×5). Stablet `lg:duo:` får ikke lg-media med denne parent-varianten — bruk `duo-lg:` (wide + ≥1024) der lg skal overstyre, f.eks. `duo:grid-cols-5 duo-lg:grid-cols-10`.

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

- Hinge-alignet shell via **native-injisert** `html[data-duo]` / `--fold-left` fra `SceneDelegate` (ikke WebKit segment-env).
- Master-detail-paneler, typografi-skalering, compare/galleri hinge-gutter.
- Marketing/onboarding fold-tilpasning.

---

## Infrastruktur (én shell-tilstand)

| Del | Fil |
|---|---|
| Sticky store + `data-shell` | `src/lib/shellMode.js` |
| `DUO_MEDIA_QUERY` (entry) | `src/lib/duoBreakpoint.js` |
| `duo:` / `duo-lg:` attribute variants | `tailwind.config.mjs` (`addVariant`) |
| `useDesktop` → `useShellWide` | `src/hooks.jsx` |
| Wide shell CSS (én kopi) | `src/index.css` (`html[data-shell="wide"]`) |
| `--fold-gap` + `.duo-split-grid` | `src/index.css` |
| Nav/header | `Navigation.jsx`, `Header.jsx` |
| Tester | `tests/iphone-duo.mjs`, `tests/iphone-duo-layout.mjs` |
