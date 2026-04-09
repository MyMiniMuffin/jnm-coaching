# Ytelsesoptimalisering: Code splitting + lucide-react + dynamiske imports

## Nåværende tilstand
- **1 JS-bundle**: 328 KB (101 KB gzip) — alt lastes ved oppstart
- **lucide-react v0.263.1**: gammel, dårlig tree-shaking (1645 KB kilde for 32 ikoner)
- **marked** (226 KB) importeres i `config.js` → havner i hovedbundlen selv om den kun brukes i PlanSection
- **react-zoom-pan-pinch** (187 KB) lastes selv om den kun brukes i ImageModal/GalleryView

## Mål
Redusere initial load ved å:
1. Kun laste det brukeren trenger ved oppstart (Dashboard)
2. Lazy-loade tunge views og biblioteker
3. Bruke nyeste lucide-react for bedre tree-shaking

---

## Fase 1: Flytt `marked` ut av hovedbundlen
- **config.js**: Fjern `import { marked }` og `marked.setOptions()`
- **PlanSection.jsx**: Legg til `marked.setOptions({ breaks: true, gfm: true })` her (eneste bruker)
- Resultat: `marked` + `dompurify` trekkes ikke inn i hovedbundlen

## Fase 2: Oppgrader lucide-react
- `npm install lucide-react@latest` (0.263.1 → 0.575.0)
- Kjent breaking change: `Edit2` er deprecated → erstattes med `Pencil`
- Sjekk andre deprecations, build og verifiser
- Ingen andre av våre 32 ikoner er fjernet (Activity, AlertCircle, etc. finnes fortsatt)

## Fase 3: React.lazy() code splitting i App.jsx
Erstatt statiske imports med lazy loading:
```jsx
const DashboardView = React.lazy(() => import('./views/DashboardView'));
const GalleryView = React.lazy(() => import('./views/GalleryView'));
const CheckInView = React.lazy(() => import('./views/CheckInView'));
const PlanSection = React.lazy(() => import('./views/PlanSection'));
const WeightProgressView = React.lazy(() => import('./views/WeightProgressView'));
const CoachDashboard = React.lazy(() => import('./views/CoachDashboard'));
```
- Wrap rendering i `<Suspense fallback={<LoadingSpinner />}>`
- **Beholder** eager loading for: components/ (små, brukes overalt), lib/, hooks

## Fase 4: Vite manual chunk-splitting
Konfigurer `vite.config.js` med `manualChunks` for bedre caching:
```js
manualChunks: {
  'react-vendor': ['react', 'react-dom'],
  'markdown': ['marked', 'dompurify'],
  'zoom': ['react-zoom-pan-pinch'],
}
```
- Vendor-chunks endres sjelden → caches lenge av browser
- Heavy libs ender i egne chunks som kun lastes ved behov

## Fase 5: Build, verifiser og sammenlign
- Kjør `npm run build` og sammenlign chunk-størrelser
- Sjekk at lazy loading fungerer (views lastes on-demand)
- Commit og push

## Forventet resultat
| | Før | Etter |
|---|---|---|
| Initial JS | 328 KB (101 KB gz) | ~150-180 KB (50-60 KB gz) |
| Chunks | 1 | 5-7 (lastes on-demand) |
| lucide-react | v0.263.1 | v0.575.0 (bedre tree-shaking) |

## Filer som endres
- `src/lib/config.js` — fjern marked import
- `src/views/PlanSection.jsx` — legg til marked.setOptions
- `src/App.jsx` — React.lazy imports + Suspense
- `src/views/DashboardView.jsx` — Edit2 → Pencil
- `src/views/PlanSection.jsx` — Edit2 → Pencil
- `vite.config.js` — manualChunks config
- `package.json` — lucide-react versjon
